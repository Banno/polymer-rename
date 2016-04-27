'use strict';

var acorn = require('acorn');
var walk = require('acorn/dist/walk');

class findReplacementExpressions {
  constructor(src) {
    this.src = src;
    this.replacements = [];
    this.parseAndWalkScript();

    this.replacements.sort((a, b) => a.start - b.start);
  }

  parseAndWalkScript() {
    var ast = acorn.parse(this.src, {
      ecmaVersion: 6,
      sourceType: 'script',
      ranges: false,
      locations: false,
      allowReserved: true,
      allowReturnOutsideFunction: false,
      allowHashBang: false
    });

    walk.simple(ast, {
      Statement: this.visit.bind(this),
      Expression: this.visit.bind(this)
    });
  }

  visit(node) {
    if (node.type === "CallExpression" &&
        node.callee.type === "MemberExpression" && node.callee.object.name === "polymerRename") {
      if (node.callee.property.name !== 'domRepeatItem') {
        if (node.callee.property.name === 'domRepeatProperty'){
          // The 3rd argument to a domRepeatProperty call is the item reference.
          let prefix = node.arguments[2].arguments[0].name;
          this.visitBasicRenamable(node.arguments[0].value, node.arguments[1].value, node.arguments[3], prefix, 'item');
        } else {
          this.visitBasicRenamable(node.arguments[0].value, node.arguments[1].value, node.arguments[2], 'this');
        }
      }
    }
  }

  visitBasicRenamable(start, end, prop, removePrefix, replacementPrefix) {
    let addDot = false;
    let value = findReplacementExpressions.getPropertyString(prop);

    if (replacementPrefix && replacementPrefix.length > 0) {
      if (value !== removePrefix) {
        addDot = true;
      }
    } else {
      replacementPrefix = '';
    }
    if (value.indexOf(removePrefix + '.') === 0) {
      value = replacementPrefix + (addDot ? '.' : '') + value.substr(removePrefix.length + 1);
    } else if (value === removePrefix) {
      value = replacementPrefix;
    }
    this.replacements.push({
      start,
      end,
      value
    });
  }

  static getPropertyString(prop) {
    switch(prop.type) {
      case 'ThisExpression':
        return 'this';
      case 'MemberExpression':
        return findReplacementExpressions.getPropertyString(prop.object) + '.' +
            findReplacementExpressions.getPropertyString(prop.property);
      case 'Identifier':
        return prop.name;
      default:
        throw new Error('Unknown property expression: ' +  prop.type);
    }
  }
}

module.exports = findReplacementExpressions;
