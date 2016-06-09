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
      if (node.callee.property.name === 'domRepeatSymbol'){
        this.visitDomRepeatSymbolRenameable(node.arguments[0].value, node.arguments[1].value, node.arguments[2].value,
            node.arguments[3]);
      } else {
        this.visitBasicRenamable(node.arguments[0].value, node.arguments[1].value, node.arguments[2]);
      }
    }
  }

  visitDomRepeatSymbolRenameable(start, end, originalPrefix, prop) {
    let propParts = findReplacementExpressions.getPropertyString(prop).split('.');
    propParts[0] = originalPrefix;
    this.replacements.push({
      start,
      end,
      value: propParts.join('.')
    });
  }

  visitBasicRenamable(start, end, prop) {
    let propParts = findReplacementExpressions.getPropertyString(prop).split('.');

    if (propParts[0] === 'this') {
      propParts.shift();
    }

    this.replacements.push({
      start,
      end,
      value: propParts.join('.')
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
