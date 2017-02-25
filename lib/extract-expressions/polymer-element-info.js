'use strict';
let treeWalker = require('tree-walk');
const BaseExpr = require('./expressions/base');
const IdentifierExpr = require('./expressions/identifier');
const AttributeExpr = require('./expressions/attribute');
const MethodExpr = require('./expressions/method');
const EventListenerExpr = require('./expressions/event-listener');
const DomRepeatExpr = require('./expressions/dom-repeat');
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

class PolymerElementInfo {

  /**
   * @param {tagName} string
   * @return {string}
   */
  static defaultTypeNameForTag(tagName) {
    return tagName.replace(PolymerElementInfo.HYPHENATED_EXPR, PolymerElementInfo.hyphenatedToCamelCaseReplacement)
        + 'Element';
  }

  /**
   * Information on a polymer-element and it's children's data
   * binding expressions which need forwarded to closure-compiler
   * for renaming
   *
   * @param {Element} domModule
   * @param {string} tagName
   * @param {string} originalHtmlDocument
   * @param {function(string):string=} customTypeNameLookup given a tag name, returns the
   *     type name
   * @param {Map<string, Array<string>} elementProperties
   */
  constructor(domModule, tagName, originalHtml, customTypeNameLookup, elementProperties) {
    this.domModule = domModule;
    this.tagName = tagName;

    /** @type {(function(string):string|undefined)} */
    this.customTypeNameLookup = customTypeNameLookup;

    this.elementProperties = elementProperties;

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

    treeWalker(this.walkDom.bind(this)).walk(this.domModule,
        this.visitNodePre, this.visitNodePost, this);
  }

  /**
   * @param {string} tagName
   * @return {string}
   */
  typeNameLookup(tagName) {
    if (this.customTypeNameLookup) {
      let typeName = this.customTypeNameLookup(tagName);
      if (typeName) {
        return typeName;
      }
    }

    if (tagName.indexOf('-') > 0) {
      return PolymerElementInfo.defaultTypeNameForTag(tagName)
    }

    return undefined;
  }

  /**
   * Walks up the scope chain to locate a property definition
   *
   * @param {string} propName
   * @returns {?{
   *     name: string
   *     hostType: string,
   *     instanceProperty: boolean
   *     renameable: boolean
   *   }}
   */
  lookupProperty(propName) {
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
   * Add a sub expression to the last expression on the stack.
   * If the expression is a DomRepeatExpr, add it to the stack.
   *
   * @param {!BaseExpr|!Array<!BaseExpr>} expression
   */
  addExpression(expression) {
    if (Array.isArray(expression)) {
      expression.forEach(item => {
        this.addExpression(item);
      });
      return;
    }

    expression.indentLevel = this.scopeStack.length;
    this.scopeStack[this.scopeStack.length - 1].expression.subExpressions.push(expression);
    if (expression instanceof DomRepeatExpr) {
      const itemsNameParts = expression.items.name.split('.');
      const domRepeatProperties = [{
        name: itemsNameParts[0],
        isDefaultName: expression.items.isDefaultName
      }];
      domRepeatProperties.push(expression.alias);
      domRepeatProperties.push(expression.index);

      this.scopeStack.push({
        tagName: 'dom-repeat',
        properties: domRepeatProperties,
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
    let attrs = {};
    node.attrs.forEach(attr => {
      attrs[attr.name] = this.visitAttribute(node, attr);
    });

    let isAttr = node.attrs ?
        node.attrs.find(attr => attr.name === 'is') :
        null;

    // dom-repeat templates have many special attributes and require creating
    // nested scopes
    if (node.tagName === 'template' && isAttr && isAttr.value === 'dom-repeat') {
      this.visitDomRepeat(node);
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
    if (node.tagName  === 'template') {
      if (node === this.rootTemplate_) {
        this.rootTemplate_ = null;
        return;
      }

      let isAttr = node.attrs.find(attr => attr.name === 'is');
      if (isAttr && isAttr.value === 'dom-repeat') {
        this.scopeStack.pop();
      }
    }
  }

  visitDomRepeat(node) {
    let tagLocationInfo = node.__location;

    // Add attributes that should be outside of the new dom repeat scope
    // Inlcudes sort, filter, items
    let specialAttributes = [];
    let sortAttr = node.attrs.find(attr => attr.name === 'sort');
    if (sortAttr) {
      specialAttributes.push(this.getAttributeValue(tagLocationInfo, sortAttr));
    }
    let filterAttr = node.attrs.find(attr => attr.name === 'filter');
    if (filterAttr) {
      specialAttributes.push(this.getAttributeValue(tagLocationInfo, filterAttr));
    }

    specialAttributes.forEach(attribute => {
      let dataBindingInfo = this.extractDataBindingProperties(attribute.value,
          attribute.start, attribute.end);

      if (!dataBindingInfo) {
        this.addExpression(this.processDataBindingExpression(attribute.value, attribute.start,
            attribute.end));
      }
    });

    let items = this.getDomRepeatProperty(node, 'items');
    if (items === null) {
      let itemsProp = node.attrs.find(attr => attr.name === 'items');
      throw new Error(`Unable to locate dom-repeat items property '${itemsProp.value}' in template ${this.scopeStack[0].tagName}`);
    }
    let aliasProperty = this.getDomRepeatProperty(node, 'as', 'item', false);
    let indexProperty = this.getDomRepeatProperty(node, 'index-as', 'index', false);

    let domRepeatable = new DomRepeatExpr(tagLocationInfo.startOffset, tagLocationInfo.endOffset + 1,
        items,
        aliasProperty,
        indexProperty);

    this.addExpression(domRepeatable);

    [
      {propName: 'as', node: node.attrs.find(attr => attr.name === 'as'), info: aliasProperty},
      {propName: 'index-as', node: node.attrs.find(attr => attr.name === 'index-as'), info: indexProperty}
    ].forEach(domRepeatProp => {
          if (!domRepeatProp.info.renameable) {
            return;
          }
          const value = this.getAttributeValue(tagLocationInfo, domRepeatProp.node);
          this.addExpression(new IdentifierExpr(value.start, value.end + 1,
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
        const observerExprInfo = this.expressionInfoFromPropertyName(start, end - 1,
            `${aliasProperty.name}.${observer}`);
        if (observerExprInfo.expression) {
          this.addExpression(
              new DomRepeatObserveExpr(
                  observerExprInfo.expression.start,
                  observerExprInfo.expression.end,
                  observerExprInfo.expression.identifier,
                  false,
                  observerExprInfo.expression.basePropertyName));
        }
      });
    }
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
        property = this.lookupProperty(attributeValue, true);
        if (property === null) {
          throw new Error(`Unable to locate property '${attributeValue}' in template for '${this.scopeStack[0].tagName}'`);
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
   * with data-binding expressions and event attributes
   *
   * @param {?} node the host tag
   * @param {?} attr
   */
  visitAttribute(node, attr) {
    let tagLocationInfo = node.__location;
    let attrName = attr.name;
    if (attrName.substr(-1) === '$') {
      attrName = attrName.substr(0, attrName.length - 1);
    }

    if (this.elementProperties.has(node.tagName) && this.isAttributeRenamable(node.tagName, attrName)) {
      let attrsLocationInfo = (tagLocationInfo.startTag || tagLocationInfo || {}).attrs || {};
      let attrNameStart = attrsLocationInfo[attr.name].startOffset;
      this.addExpression(
          new AttributeExpr(
              attrNameStart,
              attrNameStart + attrName.length,
              node.tagName,
              this.typeNameLookup(node.tagName),
              attrName));
    }

    let attributeInfo = this.getAttributeValue(tagLocationInfo, attr);
    let isEventAttribute = false;
    if (!attributeInfo.value || attributeInfo.value.length < 3) {
      return;
    }

    // Look for event attributes or attributes with data-binding expressions
    if (/^on-/.test(attributeInfo.name)) {
      isEventAttribute = true;
    }

    // If the attribute contains a data-binding expression, hone in on just the actual value
    let dataBindingInfo = this.extractDataBindingProperties(attributeInfo.value,
        attributeInfo.start, attributeInfo.end);

    let expression;
    if (dataBindingInfo) {
      let tagTypeName;
      if (!isEventAttribute) {
        tagTypeName = this.typeNameLookup(node.tagName);
      }

      expression = this.processDataBindingExpression(dataBindingInfo.value,
          dataBindingInfo.start, dataBindingInfo.end, node.tagName, tagTypeName, attributeInfo.name,
          dataBindingInfo.twoWay);
      this.addExpression(expression);

    } else if (isEventAttribute) {
      expression = new EventListenerExpr(attributeInfo.start, attributeInfo.end + 1, attributeInfo.value)
      this.addExpression(expression);
    }
    return expression;
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
      this.addExpression(this.processDataBindingExpression(dataBindingInfo.value, dataBindingInfo.start,
          dataBindingInfo.end));
    }
  }

  /**
   * @param {string} dataBoundExpression
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {string=} elementTagName
   * @param {string=} elementTypeName
   * @param {string=} elementAttribute
   * @param {boolean=} isTwoWayBinding
   * @returns {!Array<!BasicExpr>|!BasicExpr}
   */
  processDataBindingExpression(dataBoundExpression, startIndex, endIndex, elementTagName,
      elementTypeName, elementAttribute, isTwoWayBinding) {
    const expressions = [];

    // Check if the data binding expressions has a method call
    // We'll separate information for the method name and
    // each argument
    let methodParts = PolymerElementInfo.METHOD_MATCH_EXPR.exec(dataBoundExpression);
    if (methodParts !== null) {
      let methodPropInfo = this.lookupProperty(methodParts[1]);
      if (methodPropInfo === null) {
        throw new Error(`Unable to locate method '${methodParts[1]}' in template for '${this.scopeStack[0].tagName}'`);
        return [];
      }

      const methodStartIndex = startIndex;
      startIndex += methodParts[1].length + 1;
      const methodParameters = methodParts[2].split(/,/g);
      const scopedMethodParameters = [];
      for (let i = 0; i < methodParameters.length; i++) {
        let paramStartIndex = methodParameters[i].search(/\S/);
        const parameterName = methodParameters[i].trim();

        if (paramStartIndex < 0) {
          scopedMethodParameters.push(parameterName);
          continue;
        } else if (PolymerElementInfo.isLiteral(parameterName)) {
          scopedMethodParameters.push(parameterName);
          startIndex += methodParameters[i].length + 1;
          continue;
        }

        paramStartIndex += startIndex;
        const paramEndIndex = paramStartIndex + parameterName.length;
        const parameterInfo = this.expressionInfoFromPropertyName(paramStartIndex, paramEndIndex - 1, parameterName);

        if (parameterInfo.propertyInfo && parameterInfo.expression) {
          expressions.push(parameterInfo.expression);
          if (parameterInfo.propertyInfo.instanceProperty) {
            scopedMethodParameters.push('this.' + parameterName);
          } else {
            scopedMethodParameters.push(parameterName);
          }
        } else {
          scopedMethodParameters.push(parameterName);
        }

        startIndex += methodParameters[i].length + 1;
      }

      const isDomRepeatMethodReferenceRenameable =
          methodPropInfo.elementTypeName === 'DomRepeatElement' &&
          methodPropInfo.propertyInfo.base !== methodPropInfo.propertyInfo.name;

      expressions.push(
        new MethodExpr(
          methodStartIndex,
          methodStartIndex + methodParts[1].length,
          methodParts[1],
          methodPropInfo.renameable || isDomRepeatMethodReferenceRenameable,
          scopedMethodParameters.join(', '),
          methodPropInfo.instanceProperty,
          isDomRepeatMethodReferenceRenameable ? methodPropInfo.base : null));

    } else {
      const exprInfo = this.expressionInfoFromPropertyName(startIndex, endIndex, dataBoundExpression);
      if (exprInfo.propertyInfo === null) {
        return [];
      } else if (exprInfo.expression) {
        expressions.push(exprInfo.expression);
      }

      if (elementTypeName && elementTagName && elementAttribute) {
        let mainPropName = (exprInfo.propertyInfo.instanceProperty ? 'this.' : '') + exprInfo.propertyInfo.name;
        let attributeProperty = elementAttribute.replace(/[A-Z]/g, PolymerElementInfo.camelCaseToHyphenatedReplacement);
        expressions.push(
            new DataBindingExpr(mainPropName, elementTagName, elementTypeName, attributeProperty, isTwoWayBinding));
      }
    }

    return expressions;
  }

  expressionInfoFromPropertyName(startIndex, endIndex, propName) {
    let data = {
      propertyInfo: this.lookupProperty(propName)
    };
    if (!data.propertyInfo) {
      throw new Error(`Unable to locate property '${propName}' in template for '${this.scopeStack[0].tagName}'`);
    }

    if (data.propertyInfo.elementTypeName === 'DomRepeatElement') {
      if (!data.propertyInfo.renameable && data.propertyInfo.base !== data.propertyInfo.name) {
        data.expression = new IdentifierExpr(startIndex, endIndex + 1, data.propertyInfo.name, false,
            data.propertyInfo.base);
      } else if (data.propertyInfo.renameable) {
        data.expression = new IdentifierExpr(startIndex, endIndex + 1, data.propertyInfo.name, false);
      }
    } else if (data.propertyInfo.renameable) {
      data.expression = new IdentifierExpr(startIndex, endIndex + 1, data.propertyInfo.name,
          data.propertyInfo.instanceProperty);
    }
    return data;
  }

  /**
   * Given a string (such as a text node content or an attribute value)
   * find the content of a data binding expression.
   *
   * @param {string} contentWithExpression
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {number=} callCount used to reset regex match indexes
   * @returns {?{value: string, start: *, end: (number|*)}}
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
  isAttributeRenamable(tagName, attrName) {
    tagName = tagName.toLowerCase();
    const propName = attrName.replace(/-([a-z])/g, PolymerElementInfo.hyphenatedToCamelCaseReplacement);
    return this.isPropertyRenameable(tagName, propName);
  }

  isPropertyRenameable(tagName, propName) {
    if (this.elementProperties.has(tagName)) {
      const propInfo = this.elementProperties.get(tagName).properties.find(prop => prop.name === propName);
      if (propInfo && propInfo.astNode.key.type === 'Identifier') {
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

PolymerElementInfo.HYPHENATED_EXPR = /(?:^|-)([a-z])/g;
PolymerElementInfo.METHOD_MATCH_EXPR = /^([^\s]+)\s*\((.*)\)$/;

module.exports = PolymerElementInfo;
