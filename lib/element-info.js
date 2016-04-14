'use strict';
let walk = require('tree-walk');
let renameInfo = require('./renameable');

function attributeIs(name) {
  return function(attribute) {
    return attribute.name === name;
  };
}

/** @constructor */
function PolymerElementInfo(domModule, tagName, originalHtml) {
  this.domModule = domModule;
  this.tagName = tagName;
  this.typeName = this.tagName.replace(this.HYPHENATED_EXPR, this.hyphenatedToCamelCaseReplacement) + 'Element';
  this.documentHtmlString = originalHtml;

  this.renameableItems = [];

  this.domRepeatStack_ = [];

  walk(this.walkDom).walk(this.domModule,
      this.visitNodePre, this.visitNodePost, this);
}

PolymerElementInfo.prototype.addRenameable = function(renameable) {
  if (this.domRepeatStack_.length) {
    this.domRepeatStack_[this.domRepeatStack_.length - 1].renameables.push(renameable);
  } else {
    this.renameableItems.push(renameable);
  }
};

PolymerElementInfo.prototype.walkDom = function(element) {
  let childNodes = element.childNodes || [];

  if (element.content && element.content.nodeName === '#document-fragment') {
    childNodes = childNodes.concat(element.content.childNodes);
  }

  return childNodes;
};

PolymerElementInfo.prototype.HYPHENATED_EXPR = /(?:^|-)([a-z])/g;
PolymerElementInfo.prototype.hyphenatedToCamelCaseReplacement = function(match, g1) {
  return g1.toUpperCase();
};

PolymerElementInfo.prototype.visitNodePre = function(value, key, parent) {
  if (value.tagName) {
    let tagLocationInfo = value.__location;

    value.attrs.forEach(this.visitAttribute.bind(this, tagLocationInfo));

    let isAttr = value.attrs.find(attributeIs('is'));
    if (value.tagName === 'template' && isAttr && isAttr.value === 'dom-repeat') {
      let specialAttrs = [];

      let asAttr = value.attrs.find(attributeIs('as'));
      asAttr = asAttr ? this.getAttributeValue(tagLocationInfo, asAttr) : null;
      let itemsAttr = value.attrs.find(attributeIs('items'));
      itemsAttr = itemsAttr ? this.getAttributeValue(tagLocationInfo, itemsAttr) : null;
      let indexAttr = value.attrs.find(attributeIs('index-as'));
      indexAttr = indexAttr ? this.getAttributeValue(tagLocationInfo, indexAttr) : null;
      let filterAttr = value.attrs.find(attributeIs('filter'));
      filterAttr = filterAttr ? this.getAttributeValue(tagLocationInfo, filterAttr) : null;
      let observeAttr = value.attrs.find(attributeIs('observe'));
      observeAttr = observeAttr ? this.getAttributeValue(tagLocationInfo, observeAttr) : null;
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

      let sortAttr = value.attrs.find(attributeIs('sort'));
      if (sortAttr) {
        sortAttr = this.getAttributeValue(tagLocationInfo, sortAttr);
        specialAttrs.push(this.getAttributeValue(tagLocationInfo, sortAttr));
      }

      for(let i = 0; i < specialAttrs.length; i++) {
        this.addRenameable(this.processDataBindingExpression(specialAttrs[i].value, specialAttrs[i].start,
            specialAttrs[i].end));
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
  } else if (value.nodeName === '#text') {
    this.visitTextNode(value);
  }
};

PolymerElementInfo.prototype.visitNodePost = function(value, key, parent) {
  if (value.tagName  === 'template') {
    let isAttr = value.attrs.find(attributeIs('is'));
    if (isAttr && isAttr.value === 'dom-repeat') {
      this.domRepeatStack_.pop();
    }
  }
};

PolymerElementInfo.prototype.DATABINDING_START_EXPR = /(\[\[|\{\{)!?/;

PolymerElementInfo.prototype.visitAttribute = function(tagLocationInfo, attr, index, arr) {
  let attributeInfo = this.getAttributeValue(tagLocationInfo, attr);
  let isEventAttribute = false;
  let dataBindingMatches = this.DATABINDING_START_EXPR.exec(attributeInfo.value);

  // Look for event attributes or attributes with data-binding expressions
  if (/^on-/.test(attributeInfo.name)) {
    isEventAttribute = true;
  } else if (dataBindingMatches === null) {
    return;
  }

  if (!attributeInfo.value || attributeInfo.value.length < 3) {
    return;
  }

  // If the attribute contains a data-binding expression, hone in on just the renameable parts
  if (dataBindingMatches) {
    let dataBindingInfo = this.extractRenameableDataBindingProperties(attributeInfo.value, attributeInfo.start, attributeInfo.end);
    this.addRenameable(this.processDataBindingExpression(dataBindingInfo.value, dataBindingInfo.start, dataBindingInfo.end));
  } else if (isEventAttribute) {
    this.addRenameable(new renameInfo.RenambleEventListener(attributeInfo.start, attributeInfo.end + 1, attributeInfo.value));
  } else {
    this.addRenameable(new renameInfo.RenameableProperty(attributeInfo.start, attributeInfo.end + 1, attributeInfo.value));
  }
};

PolymerElementInfo.prototype.getAttributeValue  = function(tagLocationInfo, attr) {
  let attrsLocationInfo = (tagLocationInfo.startTag || tagLocationInfo || {}).attrs || {};

  if (!(attr.name.toLowerCase() in attrsLocationInfo)) {
    console.log(tagLocationInfo);

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
};

PolymerElementInfo.prototype.visitTextNode = function(node) {
  let dataBindingMatches = this.DATABINDING_START_EXPR.exec(node.value);
  if (dataBindingMatches === null) {
    return;
  }

  let dataBindingInfo = this.extractRenameableDataBindingProperties(node.value, node.__location.startOffset,
      node.__location.endOffset - 1);
  this.addRenameable(this.processDataBindingExpression(dataBindingInfo.value, dataBindingInfo.start,
      dataBindingInfo.end));
};

PolymerElementInfo.prototype.METHOD_MATCH_EXPR = /^([^\s]+)\((.*)\)$/;

PolymerElementInfo.prototype.processDataBindingExpression = function(dataBoundExpression, startIndex, endIndex) {
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

    let params = methodParts[2].split(',');
    let args = [];
    for (let i = 0; i < params.length; i++) {
      args.push(new renameInfo.RenameableProperty(startIndex, startIndex + params[i].length, params[i]));
      startIndex += params[i].length + 1;
    }
    return new renameInfo.RenambleMethod(methodInfo.start, methodInfo.end, methodInfo.method, args);
  } else {
    return new renameInfo.RenameableProperty(startIndex, endIndex + 1, dataBoundExpression);
  }
};

PolymerElementInfo.prototype.extractRenameableDataBindingProperties = function(contentWithExpression, startIndex, endIndex) {
  let dataBindingMatches = this.DATABINDING_START_EXPR.exec(contentWithExpression);
  let dataBindingExprEndIndex;
  if (dataBindingMatches[1] === '{{') {
    dataBindingExprEndIndex = contentWithExpression.indexOf('}}');
  } else {
    dataBindingExprEndIndex = contentWithExpression.indexOf(']]');
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

  //return this.processDataBindingExpression(value, startIndex, endIndex);
};

module.exports = PolymerElementInfo;
