'use strict';
let treeWalker = require('tree-walk');
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

/** @enum {number} */
const NodeTraversalType = {
  ALL: 0,
  ATTRIBUTES_ONLY: 1,
  NON_TEXT_CHILDREN: 2,
  NONE: 3
};

const traversalTypeByElement = {
  'style': NodeTraversalType.ATTRIBUTES_ONLY,
  'script': NodeTraversalType.ATTRIBUTES_ONLY
};

class PolymerTemplateExpressions {

  /**
   * @param {tagName} string
   * @return {string}
   */
  static defaultTypeNameForTag(tagName) {
    return tagName.replace(PolymerTemplateExpressions.HYPHENATED_EXPR,
        PolymerTemplateExpressions.hyphenatedToCamelCaseReplacement) + 'Element';
  }

  /**
   * @param {Node} node
   * @return {boolean}
   */
  static isNodeDomRepeat(node) {
    if (node.tagName === 'dom-repeat') {
      return true;
    }
    if (node.tagName !== 'template') {
      return false;
    }
    let isAttr = node.attrs ? node.attrs.find(attr => attr.name === 'is') : null;
    return isAttr && isAttr.value === 'dom-repeat';
  }

  /**
   * Information on a polymer-element and it's children's data
   * binding expressions which need forwarded to closure-compiler
   * for renaming
   *
   * @param {Element} domModule
   * @param {string} tagName
   * @param {string} originalHtmlDocument
   * @param {Map<string, Array<string>} elementProperties
   * @param {function(string):string} typeNameLookup
   */
  constructor(domModule, tagName, originalHtml, typeNamesByTagName, elementProperties, typeNameLookup) {
    this.domModule = domModule;
    this.tagName = tagName;

    this.elementProperties = elementProperties;

    this.typeNameLookup = typeNameLookup;

    this.typeName = this.typeNameLookup(tagName);
    if (!this.typeName) {
      throw new Error(`Unable to determine type of tag ${tagName}`);
    }

    this.documentHtmlString = originalHtml;

    this.subExpressions = [];

    this.scopeStack = [{
      tagName,
      expression: {
        subExpressions: this.subExpressions
      },
      properties: this.elementProperties.get(tagName).properties
    }];

    this.rootTemplate_ = null;

    this.DATABINDING_START_EXPR = /(\[\[|\{\{)\s*!?\s*/g;

    this.warnings = [];

    treeWalker(this.walkDom.bind(this)).walk(this.domModule,
        this.visitNodePre, this.visitNodePost, this);
  }

  /**
   * Walks up the scope chain to locate a property definition
   *
   * @param {string} propName
   * @returns {?{
   *     name: string,
   *     base: string,
   *     elementTypeName: string,
   *     instanceProperty: boolean
   *     renameable: boolean
   *   }}
   */
  lookupProperty(propName) {
    if (!propName) {
      throw new Error('Propname was not defined');
    }

    let propBase = propName.split('.')[0];
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      let scope = this.scopeStack[i];
      let property = scope.properties.find(property => property.name === propBase);
      if (!property) {
        continue;
      }

      const elementTypeName = scope.tagName === 'dom-repeat' ? 'DomRepeatElement' : this.typeNameLookup(scope.tagName);

      let isRenameable = false;
      if (scope.tagName === 'dom-repeat') {
        isRenameable = !property.defaultName;
      } else if (property.astNode && property.astNode.key) {
        isRenameable = property.astNode.key.type === 'Identifier';
      }

      return {
        name: propName,
        base: propBase,
        elementTypeName,
        instanceProperty: scope.tagName !== 'dom-repeat',
        renameable: isRenameable
      };

    }
    return null;
  }

  /**
   * Default property info for cases where the analyzer fails to locate a property or method.
   * @param {string} propName
   * @return {{name: *, base, elementTypeName: (string|*), instanceProperty: boolean, renameable: boolean}}
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
   * @param {string} propName
   * @returns {?{
   *     name: string,
   *     base: string,
   *     elementTypeName: string,
   *     instanceProperty: boolean
   *     renameable: boolean
   *   }}
   */
  lookupMethod(propName) {
    // TODO: Handle method calls where propName !== propBase
    let propBase = propName.split('.')[0];
    let feature = this.elementProperties.get(this.tagName);
    let method = feature.methods.find(method => method.name === propBase);

    if (!method) {
      method = feature.properties.find(prop => prop.name === propBase && prop.type === 'Function');
    }

    if (!method) {
      return null;
    }

    return {
      name: propName,
      base: propBase,
      elementTypeName: this.typeNameLookup(this.tagName),
      instanceProperty: true,
      renameable: method.astNode.key.type === 'Identifier'
    };
  }

  /**
   * Add sub expressions to the last expression on the stack.
   * If the expression is a DomRepeatExpr, add it to the stack.
   *
   * @param {!BaseExpr|!Array<!BaseExpr>} expression
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
        properties: [expression.alias, expression.index],
        expression
      });
    }
  }

  /**
   * Helper function for the treeWalker. Returns an array of
   * child nodes.
   * @param {Element} element
   * @returns {Array<Element>}
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
   * @param {Node} node
   */
  visitNodePre(node) {
    if (node.nodeName === '#text') {
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

    if (node.tagName === 'template' && !this.rootTemplate_) {
      this.rootTemplate_ = node;
      return;
    } else if (!this.rootTemplate_) {
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
      attributeExpressions.set(attr.name, expressions);
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
   * This is used to remove dom-repeat items
   * from our stack.
   *
   * @param {Node} node
   */
  visitNodePost(node) {
    if (PolymerTemplateExpressions.isNodeDomRepeat(node)) {
      this.scopeStack.pop();
    } else if (node.tagName  === 'template' && node === this.rootTemplate_) {
      this.rootTemplate_ = null;
      return;
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
   * @param node
   * @param attributeExpressions
   */
  visitDomRepeat(node, attributeExpressions) {
    let tagLocationInfo = node.__location;

    let items = attributeExpressions.get('items');
    if (!items || items.length === 0) {
      this.warnings.push(`Unable to locate dom-repeat items property 'items' in template ${this.scopeStack[0].tagName}`);
      return;
    }
    items = items[0];

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
          items.getStatement()));
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
          items.getStatement()));
    }


    let aliasProperty = this.getDomRepeatProperty(node, 'as', 'item', false);
    let indexProperty = this.getDomRepeatProperty(node, 'index-as', 'index', false);

    let domRepeatable = new DomRepeatExpr(tagLocationInfo.startOffset, tagLocationInfo.endOffset + 1,
        items,
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
          const value = this.getAttributeValue(tagLocationInfo, domRepeatProp.node);
          this.addExpressions(new IdentifierExpr(value.start, value.end + 1,
              domRepeatProp.info.name, domRepeatProp.info.instanceProperty));
        });

    // Add observe attribute inside of the new dom-repeat scope as the properties
    // are bound to the item itself.
    let observeAttr = node.attrs.find(attr => attr.name === 'observe');
    if (observeAttr) {
      observeAttr = this.getAttributeValue(tagLocationInfo, observeAttr);
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
        const observerExpr = this.expressionFromPropertyName(`${aliasProperty.name}.${observer}`, start, end - 1);
        if (observerExpr) {
          this.addExpressions(new DomRepeatObserveExpr(
              observerExpr.start,
              observerExpr.end,
              observerExpr.identifier,
              observerExpr.isElementProperty,
              observerExpr.basePropertyName));
        }
      });
    }
  }

  /** Sort attributes without explicit data bindings are references to a function name. */
  getDomRepeatSortImplicit(node, attribute) {
    let tagLocationInfo = node.__location;
    let attrName = attribute.name;
    let expressions = [];

    const attrValue = this.getAttributeValue(tagLocationInfo, attribute);
    const propInfo = this.lookupMethod(attrValue.value);
    if (propInfo) {
      expressions.push(new IdentifierExpr(attrValue.start, attrValue.end + 1, attrValue.value));
    }

    return expressions;
  }

  /** Filter attributes without explicit data bindings are references to a function name. */
  getDomRepeatFilterImplicit(node, attribute) {
    let tagLocationInfo = node.__location;
    let attrName = attribute.name;
    let expressions = [];

    const attrValue = this.getAttributeValue(tagLocationInfo, attribute);
    const propInfo = this.lookupMethod(attrValue.value);
    if (propInfo) {
      expressions.push(new IdentifierExpr(attrValue.start, attrValue.end + 1, attrValue.value));
    }

    return expressions;
  }

  getDomRepeatProperty(node, attributeName, defaultPropertyName, lookupProperty = true) {
    let property = null;
    let attribute = node.attrs.find(attr => attr.name === attributeName);
    if (attribute) {
      let tagLocationInfo = node.__location;
      let attributeInfo = this.getAttributeValue(tagLocationInfo, attribute);
      let attributeValue = attributeInfo.value;

      let attributeDataBindingExpr = this.extractDataBindingProperties(attributeInfo.value,
          attributeInfo.start, attributeInfo.end);
      if (attributeDataBindingExpr) {
        attributeValue = attributeDataBindingExpr.value;
      }

      if (lookupProperty) {
        property = this.lookupProperty(attributeValue);
        if (property === null) {
          this.warnings.push(`Unable to locate property '${attributeValue}' in template for '${this.scopeStack[0].tagName}'`);
        }
      }

      if (property == null) {
        property = {
          name: attributeValue,
          base: attributeValue,
          elementTypeName: 'DomRepeatElement',
          instanceProperty: false,
          defaultName: false,
          renameable: true
        };
      }
    } else if (defaultPropertyName) {
      property = {
        name: defaultPropertyName,
        base: defaultPropertyName,
        elementTypeName: 'DomRepeatElement',
        instanceProperty: false,
        defaultName: true,
        renameable: false
      };
    }

    return property;
  }

  /**
   * Visit a tag attribute. Handles attributes
   * with data-binding expressions.
   *
   * The primary expression for type-checking statements will be the first expression.
   *
   * @param {node} node the host tag
   * @param {node} attr
   * @return {!Array<!BaseExpression>}
   */
  getExpressionsForAttribute(node, attr) {
    let tagLocationInfo = node.__location;
    let attrName = attr.name;
    let expressions = [];

    // Attribute (vs property) binding expressions are of the form attr$="val"
    if (attrName.substr(-1) === '$') {
      attrName = attrName.substr(0, attrName.length - 1);
    }

    // See if we are binding to a known custom element
    if (this.elementProperties.has(node.tagName)) {
      let isAttributeRenameable = this.isAttributeRenamable(node.tagName, attrName);
      let attributeNameSubstring = attrName;
      let attrsLocationInfo = (tagLocationInfo.startTag || tagLocationInfo || {}).attrs || {};
      let attrNameStart = attrsLocationInfo[attr.name].startOffset;

      if (isAttributeRenameable) {
        expressions.push(
            new AttributeExpr(
                attrNameStart,
                attrNameStart + attributeNameSubstring.length,
                node.tagName,
                this.typeNameLookup(node.tagName),
                attributeNameSubstring));
      }
    }

    let attributeValueInfo = this.getAttributeValue(tagLocationInfo, attr);
    if (!attributeValueInfo.value || attributeValueInfo.value.length < 3) {
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
        const subElementType = this.typeNameLookup(node.tagName);
        if (subElementType) {
          expressions.push(
              new DataBindingExpr(
                  primaryExpression.getStatement(),
                  node.tagName,
                  subElementType,
                  attr.name,
                  dataBindingInfo.twoWay));
        }
      }
    }
    return expressions;
  }

  /**
   * Visit a tag event attribute.
   *
   * The primary expression for type-checking statements will be the first expression.
   *
   * @param {node} node the host tag
   * @param {node} attr
   * @return {!Array<!BaseExpression>}
   */
  getExpressionsForEventAttribute(node, attr) {
    let tagLocationInfo = node.__location;
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

    const attrValue = this.getAttributeValue(tagLocationInfo, attr);
    let propInfo = this.lookupMethod(attrValue.value);
    if (!propInfo) {
      this.warnings.push(`Unable to find event listener '${attrValue.value}' on tag '${node.tagName}' in element ${this.tagName}`);
      propInfo = this.getRenameablePropertyInfo(attrValue.value);
    }

    expressions.push(new EventListenerExpr(attrValue.start, attrValue.end + 1, attrValue.value));

    // on-prop-changed event
    if (isChangedEvent && this.isAttributeRenamable(node.tagName, attrName)) {
      const propName = attrName.replace(/-([a-z])/g, PolymerTemplateExpressions.hyphenatedToCamelCaseReplacement);
      const elementProps = this.elementProperties.get(node.tagName);
      if (elementProps) {
        let propInfo = elementProps.properties.find(prop => prop.name === propName);
        if (!propInfo) {
          this.warnings.push(`Unable to find property '${propName}' on tag '${node.tagName}' in element ${this.tagName}`);
          propInfo = this.getRenameablePropertyInfo(propName);
        }

        const subElementTypeName = this.typeNameLookup(node.tagName);
        let attrsLocationInfo = (tagLocationInfo.startTag || tagLocationInfo || {}).attrs || {};
        let attrNameStart = attrsLocationInfo[attr.name].startOffset;

        expressions.push(
            new AttributeExpr(
                attrNameStart + 3,
                attrNameStart + attrName.length + 3,
                node.tagName,
                subElementTypeName,
                propName));
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
   * @param {?} tagLocationInfo location data for the host tag
   * @param {?} attr
   */
  getAttributeValue(tagLocationInfo, attr) {
    let attrsLocationInfo = (tagLocationInfo.startTag || tagLocationInfo || {}).attrs || {};

    if (!(attr.name.toLowerCase() in attrsLocationInfo)) {
      throw new Error('Element ' + this.tagName + ' has an attribute ' + attr.name + ' missing location information');
    }

    let attrLocationInfo = attrsLocationInfo[attr.name.toLowerCase()];

    let startIndex = attrLocationInfo.startOffset, endIndex = attrLocationInfo.endOffset;
    let attributeContent = this.documentHtmlString.substring(startIndex, endIndex + 1);
    startIndex += attributeContent.indexOf(attr.value, attr.name.length);
    endIndex = startIndex + attr.value.length - 1;
    let value = this.documentHtmlString.substring(startIndex, endIndex + 1);

    return {
      name: attr.name,
      value,
      start: startIndex,
      end: endIndex
    };
  }

  /**
   * Visit a text node. May contain embeded data binding expressions.
   *
   * @param {Node} node
   */
  visitTextNode(node) {
    let callCount = 0, dataBindingInfo;
    let start = node.__location.startOffset, end = node.__location.endOffset - 1,
        content = node.value;
    while((dataBindingInfo = this.extractDataBindingProperties(content, start, end, callCount++)) !== null) {
      this.addExpressions(this.parseDataBinding(dataBindingInfo));
    }
  }

  /**
   * Given a data-binding value, return the parsed expressions. Function calls result in multiple expressions.
   *
   * The primary expression for deriving a type-checking statement will always be the first expression returned.
   *
   * @param {{value: string, start: (number|undefined), end: (number|undefined)}} dataBoundExpression
   * @returns {!Array<!BasicExpr>|!BasicExpr}
   */
  parseDataBinding(dataBoundExpression) {
    const expressions = [];

    let startIndex = dataBoundExpression.start;

    // Check if the data binding expressions has a method call
    // We'll separate information for the method name and
    // each argument
    let methodParts = dataBoundExpression.value.match(PolymerTemplateExpressions.METHOD_MATCH_EXPR);
    if (methodParts !== null) {
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
        const parameterExpression = this.expressionFromPropertyName(parameterName, paramStartIndex, paramEndIndex - 1);
        if (parameterExpression) {
          scopedMethodParameters.push(parameterExpression.getStatement());
          expressions.push(parameterExpression);
        } else {
          this.warnings.push(`Unable to find parameter '${parameterName}' of method '${methodParts[1]}' in template for '${this.tagName}'`);
        }
        startIndex += methodParameters[i].length + 1;
      }

      // TODO: Handle creating the type checking statement with correct argument references

      expressions.unshift(
          new MethodExpr(
              methodStartIndex,
              methodStartIndex + methodParts[1].length,
              methodParts[1],
              methodInfo.renameable,
              scopedMethodParameters.join(', '),
              methodInfo.instanceProperty));

    } else {
      const expression = this.expressionFromPropertyName(dataBoundExpression.value, startIndex, dataBoundExpression.end);
      if (expression) {
        expressions.push(expression);
      }
    }

    return expressions;
  }

  expressionFromPropertyName(propName, startIndex, endIndex, isMethod = false) {
    let propertyInfo;
    if (isMethod) {
      propertyInfo = this.lookupMethod(propName);
    } else {
      propertyInfo = this.lookupProperty(propName) || this.lookupMethod(propName);
    }

    if (!propertyInfo) {
      this.warnings.push(`Unable to find ${isMethod ? 'method' : 'property'} '${propName}' in element ${this.tagName}`);
      return null;
    }

    if (propertyInfo.elementTypeName === 'DomRepeatElement') {
      if (!propertyInfo.renameable && propertyInfo.base !== propertyInfo.name) {
        return new IdentifierExpr(startIndex, endIndex + 1, propertyInfo.name, false, propertyInfo.base);
      } else if (propertyInfo.renameable) {
        return new IdentifierExpr(startIndex, endIndex + 1, propertyInfo.name, false);
      }
      return new DomRepeatIdentifierExpr(startIndex, endIndex + 1, propertyInfo.name);
    } else if (propertyInfo.renameable) {
      return new IdentifierExpr(startIndex, endIndex + 1, propertyInfo.name, propertyInfo.instanceProperty);
    }
  }

  /**
   * Given a string (such as a text node content or an attribute value)
   * find the content of a data binding expression.
   *
   * @param {string} contentWithExpression
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {number=} callCount used to reset regex match indexes
   * @returns {?{value: string, start: *, end: (number|*), twoWay: boolean}}
   */
  extractDataBindingProperties(contentWithExpression, startIndex, endIndex, callCount) {
    if (callCount === undefined || callCount === 0) {
      this.DATABINDING_START_EXPR.lastIndex = 0;
    }
    let dataBindingMatches = this.DATABINDING_START_EXPR.exec(contentWithExpression);
    if (dataBindingMatches === null) {
      return null;
    }

    let dataBindingExprEndIndex, twoWay = false;
    if (dataBindingMatches[1] === '{{') {
      twoWay = true;
      dataBindingExprEndIndex = contentWithExpression.indexOf('}}', dataBindingMatches.index);
    } else {
      dataBindingExprEndIndex = contentWithExpression.indexOf(']]', dataBindingMatches.index);
    }
    endIndex -= contentWithExpression.length - dataBindingExprEndIndex;
    startIndex += dataBindingMatches.index + dataBindingMatches[0].length;
    let value = this.documentHtmlString.substring(startIndex, endIndex + 1);

    let whitespaceMatches = /\s*$/.exec(value);
    if (whitespaceMatches !== null) {
      value = value.trim();
      endIndex -= whitespaceMatches[0].length;
    }

    // databinding expressions can have an optional event name suffix - remove this
    let eventExprIndex = value.indexOf('::');
    if (eventExprIndex > 1) {
      endIndex -= value.length - eventExprIndex;
    }
    value = this.documentHtmlString.substring(startIndex, endIndex + 1);

    return {
      value,
      start: startIndex,
      end: endIndex,
      twoWay
    };
  }

  /**
   * @param {string} tagName
   * @param {string} attrName
   * @returns {boolean}
   */
  isAttributeRenamable(tagName, attrName, onlyIfNotifyTrue = false) {
    tagName = tagName.toLowerCase();
    const propName = attrName.replace(/-([a-z])/g, PolymerTemplateExpressions.hyphenatedToCamelCaseReplacement);
    return this.isPropertyRenameable(tagName, propName, onlyIfNotifyTrue);
  }

  isPropertyRenameable(tagName, propName, onlyIfNotifyTrue = false) {
    if (this.elementProperties.has(tagName)) {
      const propInfo = this.elementProperties.get(tagName).properties.find(prop => prop.name === propName);
      if (propInfo && propInfo.astNode.key.type === 'Identifier' && (!onlyIfNotifyTrue || propInfo.notify)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper function
   * Convert hyphenated tag matches to camel-case
   *
   * @param {string} match
   * @param {string} letter
   * @returns {string}
   */
  static camelCaseToHyphenatedReplacement(match, letter) {
    return '-' + letter.toLowerCase();
  }

  /**
   * Helper function
   * Convert hyphenated tag matches to camel-case
   *
   * @param {string} match
   * @param {string} letter
   * @returns {string}
   */
  static hyphenatedToCamelCaseReplacement(match, letter) {
    return letter.toUpperCase();
  }

  static isLiteral(input) {
    // test for quoted string
    if (/^'.*'$/.test(input) || /^".*"$/.test(input)) {
      return true;
    }

    // test for numeric literal
    if (/^[+-]?[\.]?\d/.test(input)) {
      return true;
    }

    return false;
  };
}

PolymerTemplateExpressions.HYPHENATED_EXPR = /(?:^|-)([a-z])/g;
PolymerTemplateExpressions.METHOD_MATCH_EXPR = /^([^\s]+)\s*\((.*)\)$/;

module.exports = PolymerTemplateExpressions;
