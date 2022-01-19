'use strict';
const treeWalker = require('tree-walk');
const IdentifierExpr = require('./expressions/identifier');
const AttributeExpr = require('./expressions/attribute');
const MethodExpr = require('./expressions/method');
const EventListenerExpr = require('./expressions/event-listener');
const DomRepeatExpr = require('./expressions/dom-repeat');
const DomRepeatFilterExpr = require('./expressions/dom-repeat-filter');
const DomRepeatIdentifierExpr = require('./expressions/dom-repeat-identifier');
const DomRepeatSortExpr = require('./expressions/dom-repeat-sort');
const DataBindingExpr = require('./expressions/data-binding');
const DomRepeatObserveExpr = require('./expressions/dom-repeat-observe');
const dom5 = require('dom5');

/** @enum {number} */
const NodeTraversalType = {
  ALL: 0,
  ATTRIBUTES_ONLY: 1,
  NON_TEXT_CHILDREN: 2,
  NONE: 3
};

const traversalTypeByElement = {
  style: NodeTraversalType.ATTRIBUTES_ONLY,
  script: NodeTraversalType.ATTRIBUTES_ONLY
};

function getNodeTagName(node) {
  if (node.tagName !== 'template') {
    return node.tagName;
  }
  let isAttr = node.attrs ? node.attrs.find(attr => attr.name === 'is') : null;
  if (isAttr) {
    return isAttr.value;
  }
  return node.tagName;
}

function getDocument(htmlDocument) {
  if (htmlDocument.isInline) {
    return htmlDocument.parsedDocument;
  }
  return htmlDocument.astNode.containingDocument
}

const injectedTagNames = new Set(['html', 'head', 'body']);
function removeFakeNodes(ast) {
  const children = (ast.childNodes || []).slice();
  if (ast.parentNode && isFakeNode(ast)) {
    for (const child of children) {
      dom5.insertBefore(ast.parentNode, ast, child);
    }
    dom5.remove(ast);
  }
  for (const child of children) {
    removeFakeNodes(child);
  }
}

function isFakeNode(ast) {
  return !ast.__location && injectedTagNames.has(ast.nodeName);
}

/** Class to walk a dom-tree starting from a dom-module and extract data binding expressions */
class PolymerTemplateExpressions {
  /**
   * @param {string} tagName to retrieve type
   * @return {string} element type name
   */
  static defaultTypeNameForTag(tagName) {
    return tagName.replace(PolymerTemplateExpressions.HYPHENATED_EXPR,
        PolymerTemplateExpressions.hyphenatedToCamelCaseReplacement) + 'Element';
  }

  /**
   * @param {Node} node HTML node
   * @return {boolean} whether the node is a `dom-repeat`
   */
  static isNodeDomRepeat(node) {
    if (node.tagName === 'dom-repeat') {
      return true;
    }
    return getNodeTagName(node) === 'dom-repeat';
  }

  /**
   * Information on a polymer-element and it's children's data
   * binding expressions which need forwarded to closure-compiler
   * for renaming
   *
   * @param {Object} htmlDocument feature from polymer-analyzer
   * @param {string} tagName of the element
   * @param {!Map<string, Map<string, Object>>} elementProperties lookup map by tag name to retrieve analyzer provided
   *     meta information on element properties defined in JS
   * @param {function(string):string} typeNameLookup helper function that given an element tag name, returns its
   *     type name
   */
  constructor(htmlDocument, tagName, elementProperties, typeNameLookup, placeholderPrefix) {
    this.htmlDocument = htmlDocument;
    removeFakeNodes(this.htmlDocument.parsedDocument.ast);
    this.url = htmlDocument.astNode.containingDocument.url;
    this.tagName = tagName;

    this.elementProperties = elementProperties;

    this.typeNameLookup = typeNameLookup;

    this.typeName = this.typeNameLookup(tagName);
    if (!this.typeName) {
      throw new Error(`Unable to determine type of tag ${tagName}`);
    }

    this.subExpressions = [];

    this.scopeStack = [{
      tagName,
      expression: {
        subExpressions: this.subExpressions
      },
      properties: this.elementProperties.get(tagName).properties
    }];

    this.rootTemplate = this.htmlDocument.parsedDocument.ast;
    this.rootTemplate_ = null;

    this.DATABINDING_START_EXPR = /(\[\[|\{\{)\s*!?\s*/g;

    this.warnings = [];

    this.placeholderPrefix = (placeholderPrefix || '').toString();
    this.placeholderIndex = 1;

    treeWalker(this.walkDom.bind(this))
        .walk(
            this.htmlDocument.parsedDocument.ast,
            this.visitNodePre,
            this.visitNodePost,
            this);
  }

  getPlaceholderProperty() {
    const placeholder = `polymerRename${this.placeholderPrefix}A${this.placeholderIndex}`;
    this.placeholderIndex += 1;
    return placeholder;
  }

  /**
   * Walks up the scope chain to locate a property definition
   *
   * @param {string} propName to locate
   * @return {?{
   *     name: string,
   *     base: string,
   *     elementTypeName: string,
   *     instanceProperty: boolean,
   *     renameable: boolean,
   *     domRepeatItemsExpression: ?IdentifierExpr
   *   }} Object with information on a located property or null if not found in scope
   */
  lookupProperty(propName) {
    if (!propName) {
      throw new Error('Propname was not defined: ' + propName);
    }

    let propBase = propName.split('.')[0];
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      let scope = this.scopeStack[i];
      let property = scope.properties.get(propBase);
      if (!property) {
        continue;
      }

      let elementTypeName = scope.tagName === 'dom-repeat' ? 'DomRepeat' : this.typeNameLookup(scope.tagName);
      let domRepeatItemsExpression = null;

      let isRenameable = false;
      if (scope.tagName === 'dom-repeat') {
        if (property.name === scope.expression.alias.name) {
          const propArrayExpression = scope.expression.items.methodName ?
              this.lookupMethod(scope.expression.items.methodName) :
              this.lookupProperty(scope.expression.items.identifier);
          if (!propArrayExpression) {
            throw new Error('Propname was not defined: ' + propName);
          }
          domRepeatItemsExpression = propArrayExpression;
        }
        isRenameable = false;
      } else if (property.astNode && property.astNode.node) {
        isRenameable = (property.astNode.node.key || property.astNode.node.property).type === 'Identifier';
      }

      return {
        name: propName,
        base: propBase,
        elementTypeName,
        domRepeatItemsExpression,
        instanceProperty: scope.tagName !== 'dom-repeat',
        renameable: isRenameable
      };
    }
    return null;
  }

  /**
   * Default property info for cases where the analyzer fails to locate a property or method.
   *
   * @param {string} propName to provide information on
   * @return {!{
   *     name: string,
   *     base: string,
   *     elementTypeName: string,
   *     instanceProperty: boolean,
   *     renameable: boolean
   *   }} Object with default information on a property
   */
  getRenameablePropertyInfo(propName) {
    let propBase = propName.split('.')[0];
    return {
      name: propName,
      base: propBase,
      elementTypeName: this.typeName,
      instanceProperty: true,
      renameable: true
    };
  }

  /**
   * Locate a method definition on the element
   *
   * @param {string} methodName to locate
   * @return {!{
   *     name: string,
   *     base: string,
   *     elementTypeName: string,
   *     instanceProperty: boolean,
   *     renameable: boolean
   *   }} Object with information on a located method or null if not found in scope
   */
  lookupMethod(methodName) {
    // TODO: Handle method calls where propName !== propBase
    let propBase = methodName.split('.')[0];
    let feature = this.elementProperties.get(this.tagName);
    let method = feature.methods.get(propBase);

    if (!method) {
      method = feature.properties.get(propBase);
      if (method && method.type !== 'Function') {
        method = null;
      }
    }

    if (!method) {
      return null;
    }

    return {
      name: methodName,
      base: propBase,
      elementTypeName: this.typeNameLookup(this.tagName),
      instanceProperty: true,
      renameable: method.astNode.node.key.type === 'Identifier'
    };
  }

  /**
   * Add sub expressions to the last expression on the stack.
   * If the expression is a DomRepeatExpr, add it to the stack.
   *
   * @param {!BaseExpr|!Array<!BaseExpr>} expression or array of expressions to add to the tree
   */
  addExpressions(expression) {
    if (Array.isArray(expression)) {
      expression.forEach(item => {
        this.addExpressions(item);
      });
      return;
    }

    expression.indentLevel = this.scopeStack.length;
    this.scopeStack[this.scopeStack.length - 1].expression.subExpressions.push(expression);
    if (expression instanceof DomRepeatExpr) {
      this.scopeStack.push({
        tagName: 'dom-repeat',
        properties: new Map([[expression.alias.name, expression.alias], [expression.index.name, expression.index]]),
        expression
      });
    }
  }

  /**
   * Helper function for the treeWalker. Returns an array of
   * child nodes. Used to prevent traversing the contents of <script> or <style> elements.
   *
   * @param {!Element} element to query
   * @return {!Array<!Element>} array of child nodes
   */
  walkDom(element) {
    let traversalType = traversalTypeByElement[element.tagName] || NodeTraversalType.ALL;

    if (traversalType === NodeTraversalType.NONE || traversalType === NodeTraversalType.ATTRIBUTES_ONLY) {
      return [];
    }

    let childNodes = (element.childNodes || []);
    if (element.content && element.content.nodeName === '#document-fragment') {
      childNodes = childNodes.concat(element.content.childNodes);
    }

    childNodes = childNodes.filter(child => {
      if (child.nodeName === '#text' && traversalType === NodeTraversalType.NON_TEXT_CHILDREN) {
        return false;
      }
      return true;
    });

    return childNodes;
  }

  /**
   * Visit a node prior to traversing its children
   *
   * @param {!Node} node to visit
   * @return {undefined}
   */
  visitNodePre(node) {
    if (!this.rootTemplate_) {
      if (node === this.rootTemplate) {
        this.rootTemplate_ = node;
      }
      return;
    }

    if (node.nodeName === '#text') {
      if (!this.rootTemplate_) {
        return;
      }
      // If the parent is a style or script tag, we don't want to traverse the contents
      let traversalType = traversalTypeByElement[node.parentNode.tagName] || NodeTraversalType.ALL;
      if (traversalType === NodeTraversalType.NONE || traversalType === NodeTraversalType.ATTRIBUTES_ONLY ||
          traversalType === NodeTraversalType.NON_TEXT_CHILDREN) {
        return;
      }

      return this.visitTextNode(node);
    } else if (!node.tagName) {
      return;
    }

    // Handle events and data-binding expression in attributes on the element
    const attributeExpressions = new Map();
    node.attrs.forEach(attr => {
      let expressions = this.getExpressionsForAttribute(node, attr);
      if (attr.name.match(/^on-/)) {
        expressions = expressions.filter(expr => !(expr instanceof DataBindingExpr));
        expressions = expressions.concat(this.getExpressionsForEventAttribute(node, attr));
      }
      attributeExpressions.set(attr.name, expressions.filter(attrExpr => !(attrExpr instanceof AttributeExpr)));
      this.addExpressions(expressions.filter(expr => !(expr instanceof DomRepeatIdentifierExpr)));
    });

    // dom-repeat templates have many special attributes and require creating
    // nested scopes
    if (PolymerTemplateExpressions.isNodeDomRepeat(node)) {
      this.visitDomRepeat(node, attributeExpressions);
    }
  }

  /**
   * Visit a node after traversing its children.
   * Used to remove dom-repeat items from the scope stack.
   *
   * @param {Node} node to visit
   */
  visitNodePost(node) {
    if (node === this.rootTemplate) {
      this.rootTemplate_ = null;
      return;
    } else if (PolymerTemplateExpressions.isNodeDomRepeat(node)) {
      this.scopeStack.pop();
    }
  }

  /**
   * Visit a dom-repeat element. Dom repeat elements create a new scope.
   *
   * Dom repeat filter and sort attributes may be either implicit or explict
   * data bindings. The implicit case is handled here (explicit bindings have
   * already been handled).
   *
   * Dom repeat observe is a whitespace delimited list of properties inside
   * the new scope and requires special logic.
   *
   * @param {!Element} node the <dom-repeat> element or <template>
   * @param {!Map<string, !AttrExpression>} attributeExpressions lookup map to locate
   *     the existing expressions for an attribute.
   */
  visitDomRepeat(node, attributeExpressions) {
    let items = attributeExpressions.get('items');
    if (!items || items.length === 0) {
      this.warnings.push(
          `Unable to locate dom-repeat items property 'items' in template ${this.scopeStack[0].tagName}`);
      return;
    }
    const item = items[0];

    let sortExpression = attributeExpressions.get('sort');
    if (sortExpression) {
      // Attribute exists, but isn't an explicit data binding
      if (sortExpression.length === 0) {
        sortExpression = this.getDomRepeatSortImplicit(node, node.attrs.find(attr => attr.name === 'sort'));
        this.addExpressions(sortExpression);
      }
      this.addExpressions(new DomRepeatSortExpr(
          sortExpression[0].start,
          sortExpression[0].end,
          sortExpression[0].getStatement(),
          item.getStatement()));
    }

    let filterExpression = attributeExpressions.get('filter');
    if (filterExpression) {
      // Attribute exists, but isn't an explicit data binding
      if (filterExpression.length === 0) {
        filterExpression = this.getDomRepeatFilterImplicit(node, node.attrs.find(attr => attr.name === 'filter'));
        this.addExpressions(filterExpression);
      }
      this.addExpressions(new DomRepeatFilterExpr(
          filterExpression[0].start,
          filterExpression[0].end,
          filterExpression[0].getStatement(),
          item.getStatement()));
    }

    let aliasProperty = this.getDomRepeatProperty(node, 'as', 'item', false);
    let indexProperty = this.getDomRepeatProperty(node, 'index-as', 'index', false);

    const document = getDocument(this.htmlDocument);
    const tagRange = document.sourceRangeForStartTag(node);
    let domRepeatable = new DomRepeatExpr(
        document.astNode.containingDocument.sourcePositionToOffset(tagRange.start),
        document.astNode.containingDocument.sourcePositionToOffset(tagRange.end),
        item,
        aliasProperty,
        indexProperty);

    this.addExpressions(domRepeatable);

    [
      {propName: 'as', node: node.attrs.find(attr => attr.name === 'as'), info: aliasProperty},
      {propName: 'index-as', node: node.attrs.find(attr => attr.name === 'index-as'), info: indexProperty}
    ].forEach(domRepeatProp => {
      if (!domRepeatProp.info.renameable) {
        return;
      }
      const value = this.getAttributeValue(node, domRepeatProp.node);
      if (value) {
        this.addExpressions(
            new IdentifierExpr(
                this.url,
                this.getPlaceholderProperty(),
                value.start,
                value.end,
                domRepeatProp.info.name,
                domRepeatProp.info.instanceProperty,
                null,
                domRepeatProp.info.elementTypeName));
      }
    });

    // Add observe attribute inside of the new dom-repeat scope as the properties
    // are bound to the item itself.
    let observeAttr = node.attrs.find(attr => attr.name === 'observe');
    if (observeAttr) {
      observeAttr = this.getAttributeValue(node, observeAttr);
      if (observeAttr) {
        let observers = observeAttr.value.split(/\s/g);
        let attrIndex = -1;
        observers.forEach(observer => {
          attrIndex++;
          if (observer.length < 1) {
            return;
          }

          let start = observeAttr.start + attrIndex;
          let end = start + observer.length;
          attrIndex += observer.length;

          // Observe attributes are properties on the model...
          const observerExpr = this.expressionFromPropertyName(`${aliasProperty.name}.${observer}`, start, end);
          if (observerExpr) {
            this.addExpressions(new DomRepeatObserveExpr(
                this.url,
                this.getPlaceholderProperty(),
                observerExpr.start,
                observerExpr.end,
                observerExpr.identifier,
                observerExpr.isElementProperty,
                observerExpr.basePropertyName));
          }
        });
      }
    }
  }

  /**
   * Sort attributes without explicit data bindings are references to a function name.
   *
   * @param {!Element} node dom-repeat element with a sort attribute
   * @param {!Object} attribute object provided by the parser for the sort
   * @return {!Array<!IdentifierExpr>} expressions
   */
  getDomRepeatSortImplicit(node, attribute) {
    let expressions = [];

    const attrValue = this.getAttributeValue(node, attribute);
    if (attrValue) {
      const propInfo = this.lookupMethod(attrValue.value);
      if (propInfo) {
        expressions.push(
            new IdentifierExpr(
                this.url,
                this.getPlaceholderProperty(),
                attrValue.start,
                attrValue.end,
                attrValue.value,
                true,
                null,
                propInfo.elementTypeName));
      }
    }

    return expressions;
  }

  /**
   * Filter attributes without explicit data bindings are references to a function name.
   *
   * @param {!Element} node dom-repeat element with a filter attribute
   * @param {!Object} attribute object provided by the parser for the filter
   * @return {!Array<!IdentifierExpr>} expressions
   */
  getDomRepeatFilterImplicit(node, attribute) {
    let expressions = [];

    const attrValue = this.getAttributeValue(node, attribute);
    if (attrValue) {
      const propInfo = this.lookupMethod(attrValue.value);
      if (propInfo) {
        expressions.push(
            new IdentifierExpr(
                this.url,
                this.getPlaceholderProperty(),
                attrValue.start,
                attrValue.end,
                attrValue.value,
                true,
                null,
                propInfo.elementTypeName));
      }
    }

    return expressions;
  }

  /**
   * Retrieve information for the special dom-repeat properties index-as and alias.
   * If these attributes are missing, default values are used but are not renamable.
   *
   * @param {!Element} node dom-repeat element
   * @param {string} attributeName to lookup
   * @param {string} defaultPropertyName to use if the attribute is missing
   * @param {boolean=} lookupProperty whether the property should be located on within the scope chain
   * @return {!{
   *     name: string,
   *     base: string,
   *     elementTypeName: string,
   *     instanceProperty: boolean,
   *     renameable: boolean,
   *     defaultName: boolean,
   *     domRepeatItemsExpression: ?IdentifierExpr
   *   }} Object with information on the property
   */
  getDomRepeatProperty(node, attributeName, defaultPropertyName, lookupProperty = true) {
    let property = null;
    let attribute = node.attrs.find(attr => attr.name === attributeName);
    if (attribute) {
      let attributeInfo = this.getAttributeValue(node, attribute);
      if (attributeInfo) {
        let attributeValue = attributeInfo.value;

        let attributeDataBindingExpr = this.extractDataBindingProperties(attributeInfo.value,
            attributeInfo.start, attributeInfo.end);
        if (attributeDataBindingExpr) {
          attributeValue = attributeDataBindingExpr.value;
        }

        if (lookupProperty) {
          property = this.lookupProperty(attributeValue);
          if (property === null) {
            this.warnings.push(
                `Unable to locate property '${attributeValue}' in template for '${this.scopeStack[0].tagName}'`);
          }
        }

        if (!property) {
          property = {
            name: attributeValue,
            base: attributeValue,
            elementTypeName: 'DomRepeat',
            instanceProperty: false,
            defaultName: false,
            renameable: false
          };
        }
      }
    } else if (defaultPropertyName) {
      property = {
        name: defaultPropertyName,
        base: defaultPropertyName,
        elementTypeName: 'DomRepeat',
        instanceProperty: false,
        defaultName: true,
        renameable: false
      };
    }

    return property;
  }

  /**
   * Visit a tag attribute. Handles attributes with data-binding expressions.
   * The primary expression for type-checking statements will be the first expression.
   *
   * @param {!Element} node the host tag
   * @param {!Object} attr information provided by the parser
   * @return {!Array<!BaseExpression>} array of expressions
   */
  getExpressionsForAttribute(node, attr) {
    let attrName = attr.name;
    let expressions = [];
    let isAttributePropertyBinding = true;

    // Attribute (vs property) binding expressions are of the form attr$="val"
    let attrLocEndOffset = 0;
    if (attrName.substr(-1) === '$') {
      isAttributePropertyBinding = false;
      attrName = attrName.substr(0, attrName.length - 1);
      attrLocEndOffset -= 1;
    }
    let isAttributeRenameable = false;

    // See if we are binding to a known custom element
    if (this.elementProperties.has(getNodeTagName(node))) {
      const document = getDocument(this.htmlDocument);
      const attributeNameRange = document.sourceRangeForAttributeName(node, attr.name);
      isAttributeRenameable = this.isAttributeRenamable(getNodeTagName(node), attrName);

      if (isAttributeRenameable) {
        expressions.push(
            new AttributeExpr(
                this.url,
                this.getPlaceholderProperty(),
                document.astNode.containingDocument.sourcePositionToOffset(attributeNameRange.start),
                document.astNode.containingDocument.sourcePositionToOffset(attributeNameRange.end) +
                    attrLocEndOffset,
                getNodeTagName(node),
                this.typeNameLookup(getNodeTagName(node)),
                attrName));
      }
    }

    let attributeValueInfo = this.getAttributeValue(node, attr);
    if (!attributeValueInfo || !attributeValueInfo.value || attributeValueInfo.value.length < 3) {
      return expressions;
    }

    // If the attribute contains a data-binding expression, hone in on just the actual value
    let dataBindingInfo = this.extractDataBindingProperties(attributeValueInfo.value,
        attributeValueInfo.start, attributeValueInfo.end);

    if (dataBindingInfo) {
      const dataBoundExpressions = this.parseDataBinding(dataBindingInfo);
      if (dataBoundExpressions.length > 0) {
        expressions = expressions.concat(dataBoundExpressions);
        const primaryExpression = dataBoundExpressions[0];

        // If an attribute binding name isn't defined as a property on the element,
        // then don't include it as an expression and don't generate type checking statements.
        // These can be used to add properties for css styling or locating elements via querySelector.
        if (isAttributePropertyBinding || isAttributeRenameable) {
          const subElementType = this.typeNameLookup(getNodeTagName(node));
          if (subElementType) {
            expressions.push(
                new DataBindingExpr(
                    primaryExpression.getStatement(),
                    getNodeTagName(node),
                    subElementType,
                    attrName,
                    dataBindingInfo.twoWay));
          }
        }
      }
    }
    return expressions;
  }

  /**
   * Visit a tag event attributes.
   * The primary expression for type-checking statements will be the first expression.
   *
   * @param {!Element} node the host tag
   * @param {!Object} attr information provided by the parser
   * @return {!Array<!BaseExpression>} array of expressions
   */
  getExpressionsForEventAttribute(node, attr) {
    let attrName = attr.name;
    let expressions = [];

    // Attribute (vs property) binding expressions are of the form attr$="val"
    if (attrName.substr(-1) === '$') {
      attrName = attrName.substr(0, attrName.length - 1);
    }

    if (attrName.substr(0, 3) !== 'on-') {
      throw new Error(`Invalid Event Attribute ${attrName}`);
    }
    attrName = attrName.substr(3);

    const isChangedEvent = attrName.match(/-changed$/);
    if (isChangedEvent) {
      attrName = attrName.substr(0, attrName.length - '-changed'.length);
    }

    const attrValue = this.getAttributeValue(node, attr);
    let propInfo = attrValue && this.lookupMethod(attrValue.value);
    if (!propInfo) {
      this.warnings.push(
          `Unable to find event listener '${(attrValue || {}).value}' on tag '${node.tagName}' in element ${this.tagName}`);
    }

    expressions.push(
        new EventListenerExpr(
            this.url,
            this.getPlaceholderProperty(),
            attrValue.start,
            attrValue.end,
            attrValue.value,
            true,
            (propInfo || {}).elementTypeName || '?'));

    // on-prop-changed event
    if (isChangedEvent && this.isAttributeRenamable(getNodeTagName(node), attrName)) {
      const propName = attrName.replace(/-([a-z])/g, PolymerTemplateExpressions.hyphenatedToCamelCaseReplacement);
      const elementProps = this.elementProperties.get(getNodeTagName(node));
      if (elementProps) {
        let propInfo = elementProps.properties.get(propName);
        if (propInfo) {
          const subElementTypeName = this.typeNameLookup(getNodeTagName(node));
          const document = getDocument(this.htmlDocument);
          const attributeNameRange = document.sourceRangeForAttributeName(node, attr.name);
          const attrNameStart = document.astNode.containingDocument.sourcePositionToOffset(attributeNameRange.start) + 3;
          expressions.push(
              new AttributeExpr(
                  this.url,
                  this.getPlaceholderProperty(),
                  attrNameStart,
                  attrNameStart + attrName.length,
                  getNodeTagName(node),
                  subElementTypeName,
                  propName));

        // dom-repeat elements emit a `dom-changed` event, but unfortunately don't have a 'dom' property
        } else if (!(PolymerTemplateExpressions.isNodeDomRepeat(node) && propName === 'dom')) {
          this.warnings.push(
              `Unable to find property '${propName}' on tag '${node.tagName}' in element ${this.tagName}`);
        }
      } else {
        this.warnings.push(`Unable to find property '${propName}' on tag '${node.tagName}' in element ${this.tagName}`);
      }
    }

    return expressions;
  }

  /**
   * Given an attribute, return a record with the name, value
   * start index of the value and end index of the value.
   *
   * @param {Node} node the host tag
   * @param {Object} attr information provided by the parser
   * @return {{
   *     name: string,
   *     value: string,
   *     start: number,
   *     end: number
   *   }} attribute information
   */
  getAttributeValue(node, attr) {
    const document = getDocument(this.htmlDocument);
    let valueRange = document.sourceRangeForAttributeValue(node, attr.name, true);

    if (!valueRange && attr.value) {
      let attrRange = document.sourceRangeForAttribute(node, attr.name);
      if (!attrRange) {
        return;
      }
      if (!((attrRange.start.line === attrRange.end.line) &&
          (attrRange.end.column - attrRange.start.column === attr.name.length))) {
        return undefined;
      }
      const docLines = document.contents.split('\n');
      if (this.htmlDocument.isInline) {
        for (let i = 0; i < this.htmlDocument.sourceRange.start.line; i++) {
          docLines.unshift('');
        }
        docLines[this.htmlDocument.sourceRange.start.line] =
            ''.padStart(this.htmlDocument.sourceRange.start.column, ' ') +
            docLines[this.htmlDocument.sourceRange.start.line];
      }
      if (docLines[attrRange.end.line][attrRange.end.column] === '=' &&
          (docLines[attrRange.end.line][attrRange.end.column + 1] === '"' ||
              docLines[attrRange.end.line][attrRange.end.column + 1] === "'")) {
        valueRange = {
          start: {
            line: attrRange.end.line,
            column: attrRange.end.column + 2
          },
          end: {
            line: attrRange.end.line,
            column: docLines[attrRange.end.line]
                .indexOf(docLines[attrRange.end.line][attrRange.end.column + 1], attrRange.end.column + 2) + 1
          }
        };
      }
    }

    if (!valueRange) {
      return;
    }

    return Object.assign({}, attr, {
      start: document.astNode.containingDocument.sourcePositionToOffset(valueRange.start),
      end: document.astNode.containingDocument.sourcePositionToOffset(valueRange.end) - 1,
    });
  }

  /**
   * Visit a text node. May contain embedded data binding expressions.
   *
   * @param {!Node} node to search for expressions
   */
  visitTextNode(node) {
    let callCount = 0;
    let dataBindingInfo;
    const document = getDocument(this.htmlDocument);
    const textRange = document._sourceRangeForNode(node);
    if (textRange === undefined) {
      return;
    }
    let start = document.astNode.containingDocument.sourcePositionToOffset(textRange.start);
    let end = document.astNode.containingDocument.sourcePositionToOffset(textRange.end);
    let content = node.value;
    while ((dataBindingInfo = this.extractDataBindingProperties(content, start, end, callCount++)) !== null) {
      this.addExpressions(this.parseDataBinding(dataBindingInfo));
    }
  }

  /**
   * Given a data-binding value, return the parsed expressions. Function calls result in multiple expressions.
   *
   * The primary expression for deriving a type-checking statement will always be the first expression returned.
   *
   * @param {{
   *     value: string,
   *     start: (number|undefined),
   *     end: (number|undefined)
   *   }} dataBoundExpression to parse
   * @return {!Array<!BasicExpr>|!BasicExpr} expressions
   */
  parseDataBinding(dataBoundExpression) {
    const expressions = [];

    let startIndex = dataBoundExpression.start;

    // Check if the data binding expressions has a method call
    // We'll separate information for the method name and
    // each argument
    let methodParts = dataBoundExpression.value.match(PolymerTemplateExpressions.METHOD_MATCH_EXPR);
    if (methodParts) {
      const methodStartIndex = startIndex;
      startIndex += methodParts[1].length + 1;

      let methodInfo = this.lookupMethod(methodParts[1]);
      if (methodInfo === null) {
        this.warnings.push(`Unable to find method '${methodParts[1]}' in element ${this.tagName}`);
        methodInfo = this.getRenameablePropertyInfo(methodParts[1]);
      }

      const methodParameters = methodParts[2] ? methodParts[2].split(/,/g) : [];
      const scopedMethodParameters = [];
      for (let i = 0; i < methodParameters.length; i++) {
        let paramStartIndex = methodParameters[i].search(/\S/);
        const parameterName = methodParameters[i].trim();

        if (paramStartIndex < 0) {
          scopedMethodParameters.push(parameterName);
          continue;
        } else if (PolymerTemplateExpressions.isLiteral(parameterName)) {
          scopedMethodParameters.push(parameterName);
          startIndex += methodParameters[i].length + 1;
          continue;
        }

        paramStartIndex += startIndex;
        const paramEndIndex = paramStartIndex + parameterName.length;
        const parameterExpression = this.expressionFromPropertyName(parameterName, paramStartIndex, paramEndIndex);
        if (parameterExpression) {
          scopedMethodParameters.push(parameterExpression.getStatement());
          expressions.push(parameterExpression);
        } else {
          scopedMethodParameters.push(`this.${parameterName}`);
          this.warnings.push(`Unable to find parameter '${parameterName}' of method ` +
              `'${methodParts[1]}' in template for '${this.tagName}'`);
        }
        startIndex += methodParameters[i].length + 1;
      }

      expressions.unshift(
          new MethodExpr(
              this.url,
              this.getPlaceholderProperty(),
              methodStartIndex,
              methodStartIndex + methodParts[1].length,
              methodParts[1],
              methodInfo.renameable,
              scopedMethodParameters.join(', '),
              methodInfo.instanceProperty,
              methodInfo.elementTypeName));
    } else {
      const expression = this.expressionFromPropertyName(
          dataBoundExpression.value, startIndex, dataBoundExpression.end);
      if (expression) {
        expressions.push(expression);
      }
    }

    return expressions;
  }

  /**
   * Given a property name and position indexes, return a renaming expression
   *
   * @param {string} propName to locate
   * @param {number} startIndex position
   * @param {number} endIndex position
   * @param {boolean} isMethod whether the property name must be a method
   * @return {!BaseExpression} expression
   */
  expressionFromPropertyName(propName, startIndex, endIndex, isMethod = false) {
    let propertyInfo;
    if (isMethod) {
      propertyInfo = this.lookupMethod(propName);
    } else {
      propertyInfo = this.lookupProperty(propName) || this.lookupMethod(propName);
    }

    if (!propertyInfo) {
      this.warnings.push(`Unable to find ${isMethod ? 'method' : 'property'} '${propName}' in element ${this.tagName}`);
      return new IdentifierExpr(
          this.url,
          this.getPlaceholderProperty(),
          startIndex,
          endIndex,
          propName,
          true,
          null,
          this.typeName);
    }

    if (propertyInfo.elementTypeName === 'DomRepeat') {
      if (!propertyInfo.renameable && propertyInfo.base !== propertyInfo.name) {
        let identifier =  new IdentifierExpr(
            this.url,
            this.getPlaceholderProperty(),
            startIndex,
            endIndex,
            propertyInfo.name,
            false,
            propertyInfo.base,
            propertyInfo.elementTypeName);
        identifier.domRepeatItemsExpression = propertyInfo.domRepeatItemsExpression;
        return identifier;
      } else if (propertyInfo.renameable) {
        return new IdentifierExpr(
            this.url,
            this.getPlaceholderProperty(),
            startIndex,
            endIndex,
            propertyInfo.name,
            false,
            null,
            propertyInfo.elementTypeName);
      }
      const identifier = new DomRepeatIdentifierExpr(
          this.url, this.getPlaceholderProperty(), startIndex, endIndex, propertyInfo.name);
      identifier.basePropertyType = propertyInfo.elementTypeName;
      identifier.domRepeatItemsExpression = propertyInfo.domRepeatItemsExpression;
      return identifier;
    } else if (propertyInfo.renameable) {
      const identifier = new IdentifierExpr(
          this.url,
          this.getPlaceholderProperty(),
          startIndex,
          endIndex,
          propertyInfo.name,
          propertyInfo.instanceProperty,
          null,
          propertyInfo.elementTypeName);
      identifier.domRepeatItemsExpression = propertyInfo.domRepeatItemsExpression;
      return identifier;
    }
  }

  /**
   * Given a string (such as a text node content or an attribute value)
   * find the content of a data binding expression.
   *
   * @param {string} contentWithExpression text with potential expressions
   * @param {number} startIndex position of the start of the text
   * @param {number} endIndex position of the end of the text
   * @param {number=} callCount used to reset regex match indexes
   * @return {?{
   *     value: string,
   *     start: number,
   *     end: number,
   *     twoWay: boolean
   *   }} found expression
   */
  extractDataBindingProperties(contentWithExpression, startIndex, endIndex, callCount) {
    if (callCount === undefined || callCount === 0) {
      this.DATABINDING_START_EXPR.lastIndex = 0;
    }
    let dataBindingMatches = this.DATABINDING_START_EXPR.exec(contentWithExpression);
    if (dataBindingMatches === null) {
      return null;
    }

    let dataBindingExprEndIndex;
    let twoWay = false;
    if (dataBindingMatches[1] === '{{') {
      twoWay = true;
      dataBindingExprEndIndex = contentWithExpression.indexOf('}}', dataBindingMatches.index);
    } else {
      dataBindingExprEndIndex = contentWithExpression.indexOf(']]', dataBindingMatches.index);
    }
    endIndex -= contentWithExpression.length - dataBindingExprEndIndex;
    startIndex += dataBindingMatches.index + dataBindingMatches[0].length;
    let value = contentWithExpression.substring(dataBindingMatches.index + dataBindingMatches[0].length, dataBindingExprEndIndex);

    let whitespaceMatches = /\s*$/.exec(value);
    if (whitespaceMatches !== null) {
      value = value.trim();
      endIndex -= whitespaceMatches[0].length;
    }

    // databinding expressions can have an optional event name suffix - remove this
    let eventExprIndex = value.indexOf('::');
    if (eventExprIndex > 1) {
      endIndex -= value.length - eventExprIndex;
      value = value.substring(0, eventExprIndex);
    }

    return {
      value,
      start: startIndex,
      end: endIndex,
      twoWay
    };
  }

  /**
   * Helper function to determine whether an attribute is renameable.
   *
   * @param {string} tagName with the attribute
   * @param {string} attrName to locate
   * @return {boolean} is renameable
   */
  isAttributeRenamable(tagName, attrName) {
    tagName = tagName.toLowerCase();
    const propName = attrName.replace(/-([a-z])/g, PolymerTemplateExpressions.hyphenatedToCamelCaseReplacement);

    if (this.elementProperties.has(tagName)) {
      const propInfo = this.elementProperties.get(tagName).properties.get(propName);
      // either a reactive property or standard class property
      if (propInfo && propInfo.astNode && propInfo.astNode.node &&
          (propInfo.astNode.node.key || propInfo.astNode.node.property).type === 'Identifier') {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper function
   * Convert hyphenated tag matches to camel-case
   * Used for regex replace method callback
   *
   * @param {string} match full text
   * @param {string} letter to convert
   * @return {string} hyphenated version
   */
  static hyphenatedToCamelCaseReplacement(match, letter) {
    return letter.toUpperCase();
  }

  /**
   * Helper function
   * Determine whether a data-bound method argument is a literal expression.
   *
   * @param {string} param to test
   * @return {boolean} whether the parameter is a literal
   */
  static isLiteral(param) {
    // test for quoted string
    if (/^'.*'$/.test(param) || /^".*"$/.test(param)) {
      return true;
    }

    // test for numeric literal
    if (/^[+-]?[\.]?\d/.test(param)) {
      return true;
    }

    return false;
  }
}

PolymerTemplateExpressions.HYPHENATED_EXPR = /(?:^|-)([a-z])/g;
PolymerTemplateExpressions.METHOD_MATCH_EXPR = /^([^\s]+)\s*\((.*)\)$/;

module.exports = PolymerTemplateExpressions;
