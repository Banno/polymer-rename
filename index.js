'use strict';
let parse5 = require('parse5');
let walk = require('tree-walk');
let PolymerElementInfo = require('./lib/element-info');

let domWalker = walk(function(element) {
  let children = element.childNodes.filter(filterNodes);

  if (element.content && element.content.nodeName === '#document-fragment') {
    children = children.concat(element.content.childNodes.filter(filterNodes));
  }

  return children;
});

function filterNodes(elem, index, arr) {
  if (elem.tagName) {
    return true;
  }
  return false;
}

function polymerRename(polymerTemplate) {
  let document = parse5.parse(polymerTemplate, {locationInfo: true});
  let polymerElements = [];
  domWalker.preorder(document, (value, key, parent) => {
    if (value.tagName === 'dom-module') {
      let id = value.attrs.find(attr => attr.name === 'id' ? true : false);
      if (!id) {
        throw new Error('<dom-module> element without id attribute at line ' + value.__location.line + ' col ' + value.__location.col);
      }
      polymerElements.push(new PolymerElementInfo(value, id.value, polymerTemplate));

    }
  });

  let output = [], elem;
  for (let i = 0; i < polymerElements.length; i++) {
    elem = polymerElements[i];
    if (elem.renameableItems.length === 0) {
      continue;
    }

    output.push('(/** @this {' + elem.typeName + '} */ function() {');

    for(let j = 0; j < elem.renameableItems.length; j++) {
      output.push(elem.renameableItems[j].toString());
    }
    output.push('}).call(/** @type {' + elem.typeName + '} */ (document.createElement("' + elem.tagName + '")))\n');
  }

  console.log(output.join('\n'));
}

module.exports = polymerRename;
