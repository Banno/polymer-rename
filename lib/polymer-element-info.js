'use strict';
let treeWalker = require('tree-walk');
let renameInfo = require('./renameables');

function attributeIs(name) {
  return function(attribute) {
    return attribute.name === name;
  };
}

/** @enum {number} */
let NodeTraversalType = {
  ALL: 0,
  ATTRIBUTES_ONLY: 1,
  NON_TEXT_CHILDREN: 2,
  NONE: 3
};

let traversalTypeByElement = {
  'style': NodeTraversalType.ATTRIBUTES_ONLY,
  'script': NodeTraversalType.ATTRIBUTES_ONLY
};

class PolymerElementInfo {
  /**
   * Information on a polymer-element and it's children's data
   * binding expressions which need forwarded to closure-compiler
   * for renaming
   *
   * @param {Element} domModule
   * @param {string} tagName
   * @param {string} originalHtmlDocument
   */
  constructor(domModule, tagName, originalHtml) {
    this.domModule = domModule;
    this.tagName = tagName;
    this.typeName = this.tagName.replace(this.HYPHENATED_EXPR, PolymerElementInfo.hyphenatedToCamelCaseReplacement)
        + 'Element';
    this.documentHtmlString = originalHtml;

    this.renameableItems = [];

    this.domRepeatStack_ = [];

    this.rootTemplate_ = null;

    treeWalker(this.walkDom.bind(this)).walk(this.domModule,
        this.visitNodePre, this.visitNodePost, this);
  }

  /**
   * Add a renameable object to the list of expressions. If the renameable
   * expression is
   *
   * @param {BasicRenameable} renameable
   */
  addRenameable(renameable) {
    if (this.domRepeatStack_.length) {
      this.domRepeatStack_[this.domRepeatStack_.length - 1].renameables.push(renameable);
    } else {
      this.renameableItems.push(renameable);
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
    if (node.tagName) {
      if (node.tagName === 'template' && !this.rootTemplate_) {
        this.rootTemplate_ = node;
        return;
      } else if (!this.rootTemplate_) {
        return;
      }

      let tagLocationInfo = node.__location;

      // Handle events and data-binding expression in attributes on the element
      node.attrs.forEach(this.visitAttribute.bind(this, tagLocationInfo));

      let isAttr = node.attrs.find(attributeIs('is'));

      // dom-repeat templates have many special attributes and require creating
      // nested scopes
      if (node.tagName === 'template' && isAttr && isAttr.value === 'dom-repeat') {
        let asAttr = node.attrs.find(attributeIs('as'));
        asAttr = asAttr ? this.getAttributeValue(tagLocationInfo, asAttr) : null;

        let itemsAttr = node.attrs.find(attributeIs('items'));
        itemsAttr = itemsAttr ? this.getAttributeValue(tagLocationInfo, itemsAttr) : null;

        let indexAttr = node.attrs.find(attributeIs('index-as'));
        indexAttr = indexAttr ? this.getAttributeValue(tagLocationInfo, indexAttr) : null;

        let specialAttrs = [];

        let observeAttr = node.attrs.find(attributeIs('observe'));
        if (observeAttr) {
          observeAttr = this.getAttributeValue(tagLocationInfo, sortAttr);
          let observers = observeAttr.value.split(/\s+/g);
          for (let i = 0; i < observers.length; i++) {
            if (observers[i].length < 1) {
              continue;
            }

            let start = observeAttr.start + observeAttr.value.indexOf(observers[i]);
            let end = start + observers[i].end - 1;
            specialAttrs.push({
              name: 'observe',
              value: observers[i],
              start,
              end
            });
          }
        }

        let sortAttr = node.attrs.find(attributeIs('sort'));
        if (sortAttr) {
          specialAttrs.push(this.getAttributeValue(tagLocationInfo, sortAttr));
        }
        let filterAttr = node.attrs.find(attributeIs('filter'));
        if (filterAttr) {
          specialAttrs.push(this.getAttributeValue(tagLocationInfo, filterAttr));
        }

        for(let i = 0; i < specialAttrs.length; i++) {
          let dataBindingInfo = this.extractRenameableDataBindingProperties(specialAttrs[i].start, specialAttrs[i].end,
              specialAttrs[i].value);

          if (!dataBindingInfo) {
            this.addRenameable(this.processDataBindingExpression(specialAttrs[i].value, specialAttrs[i].start,
                specialAttrs[i].end));
          }
        }

        let itemsInfo = this.extractRenameableDataBindingProperties(itemsAttr.value, itemsAttr.start, itemsAttr.end);
        let domRepeatParent = null;
        if (this.domRepeatStack_.length > 0) {
          domRepeatParent = this.domRepeatStack_[this.domRepeatStack_.length - 1];
        }

        let domRepeatable = new renameInfo.RenameableRepeat(tagLocationInfo.startOffset, tagLocationInfo.endOffset + 1,
            domRepeatParent, itemsInfo.value, asAttr ? asAttr.value : undefined,
            indexAttr ? indexAttr.value : undefined);

        this.domRepeatStack_.push(domRepeatable);
        this.renameableItems.push(domRepeatable);
      }
    } else if (node.nodeName === '#text') {
      let traversalType = traversalTypeByElement[node.parentNode.tagName] || NodeTraversalType.ALL;
      if (traversalType === NodeTraversalType.NONE || traversalType === NodeTraversalType.ATTRIBUTES_ONLY ||
          traversalType === NodeTraversalType.NON_TEXT_CHILDREN) {
        return;
      }

      this.visitTextNode(node);
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

      let isAttr = node.attrs.find(attributeIs('is'));
      if (isAttr && isAttr.value === 'dom-repeat') {
        this.domRepeatStack_.pop();
      }
    }
  }

  /**
   * Visit a tag attribute. Handles attributes
   * with data-binding expressions and event attributes
   *
   * @param {?} tagLocationInfo location data for the host tag
   * @param {?} attr
   */
  visitAttribute(tagLocationInfo, attr) {
    let attributeInfo = this.getAttributeValue(tagLocationInfo, attr);
    let isEventAttribute = false;

    // Look for event attributes or attributes with data-binding expressions
    if (/^on-/.test(attributeInfo.name)) {
      isEventAttribute = true;
    }
    if (!attributeInfo.value || attributeInfo.value.length < 3) {
      return;
    }

    // If the attribute contains a data-binding expression, hone in on just the renameable parts
    let dataBindingInfo = this.extractRenameableDataBindingProperties(attributeInfo.value,
        attributeInfo.start, attributeInfo.end);

    if (dataBindingInfo) {
      this.addRenameable(this.processDataBindingExpression(dataBindingInfo.value,
          dataBindingInfo.start, dataBindingInfo.end));
    } else if (isEventAttribute) {
      this.addRenameable(new renameInfo.RenambleEventListener(attributeInfo.start,
          attributeInfo.end + 1, attributeInfo.value));
    }
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
    startIndex += attributeContent.indexOf(attr.value);
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
    while((dataBindingInfo = this.extractRenameableDataBindingProperties(content, start, end, callCount++)) !== null) {
      this.addRenameable(this.processDataBindingExpression(dataBindingInfo.value, dataBindingInfo.start,
          dataBindingInfo.end));
    }
  }

  /**
   * @param {string} dataBoundExpression
   * @param {number} startIndex
   * @param {number} endIndex
   * @returns {!BasicRenameable}
   */
  processDataBindingExpression(dataBoundExpression, startIndex, endIndex) {
    // Check if the data binding expressions has a method call
    // We'll separate information for the method name and
    // each argument
    let methodParts = this.METHOD_MATCH_EXPR.exec(dataBoundExpression);
    if (methodParts !== null) {
      let methodInfo = {
        method: methodParts[1],
        start: startIndex,
        end: startIndex + methodParts[1].length
      };
      startIndex += methodParts[1].length + 1;

      let params = methodParts[2].split(/\s*,\s*/g);
      let args = [];
      for (let i = 0; i < params.length; i++) {
        args.push(new renameInfo.RenameableProperty(startIndex, startIndex + params[i].length, params[i]));
        startIndex += params[i].length + 1;
      }
      return new renameInfo.RenambleMethod(methodInfo.start, methodInfo.end, methodInfo.method, args);
    } else {
      return new renameInfo.RenameableProperty(startIndex, endIndex + 1, dataBoundExpression);
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
   * @returns {?{value: string, start: *, end: (number|*)}}
   */
  extractRenameableDataBindingProperties(contentWithExpression, startIndex, endIndex, callCount) {
    if (callCount === undefined || callCount === 0) {
      this.DATABINDING_START_EXPR.lastIndex = 0;
    }
    let dataBindingMatches = this.DATABINDING_START_EXPR.exec(contentWithExpression);
    if (dataBindingMatches === null) {
      return null;
    }

    let dataBindingExprEndIndex;
    if (dataBindingMatches[1] === '{{') {
      dataBindingExprEndIndex = contentWithExpression.indexOf('}}', dataBindingMatches.index);
    } else {
      dataBindingExprEndIndex = contentWithExpression.indexOf(']]', dataBindingMatches.index);
    }
    endIndex -= contentWithExpression.length - dataBindingExprEndIndex;
    startIndex += dataBindingMatches.index + dataBindingMatches[0].length;
    let value = this.documentHtmlString.substring(startIndex, endIndex + 1);

    // databinding expressions can have an optional event name suffix - remove this
    let eventExprIndex = value.indexOf('::');
    if (eventExprIndex > 1) {
      endIndex -= value.length - eventExprIndex;
    }
    value = this.documentHtmlString.substring(startIndex, endIndex + 1);

    return {
      value,
      start: startIndex,
      end: endIndex
    };
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
}

PolymerElementInfo.prototype.HYPHENATED_EXPR = /(?:^|-)([a-z])/g;
PolymerElementInfo.prototype.METHOD_MATCH_EXPR = /^([^\s]+)\((.*)\)$/;
PolymerElementInfo.prototype.DATABINDING_START_EXPR = /(\[\[|\{\{)!?/g;

module.exports = PolymerElementInfo;
