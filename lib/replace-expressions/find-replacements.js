'use strict';

const acorn = require('acorn');
const walk = require('acorn/dist/walk');

const recognizedMethods = new Set();
recognizedMethods.add('symbol');
recognizedMethods.add('method');
recognizedMethods.add('eventListener');
recognizedMethods.add('domRepeatSymbol');
recognizedMethods.add('domRepeatObserver');

class FindReplacementExpressions {
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
    if (node.type === "CallExpression"
        && node.callee.type === "MemberExpression"
        && node.callee.object.name === "polymerRename"
        && recognizedMethods.has(node.callee.property.name)) {
      if (node.callee.property.name === 'domRepeatSymbol'){
        this.visitDomRepeatSymbolRenameable(node.arguments[0].value, node.arguments[1].value, node.arguments[2].value,
            node.arguments[3], node.arguments[4]);
      } else if (node.callee.property.name === 'domRepeatObserver'){
        this.visitDomRepeatObserverRenameable(node.arguments[0].value, node.arguments[1].value, node.arguments[2]);
      } else  {
        this.visitBasicRenamable(node.arguments[0].value, node.arguments[1].value, node.arguments[2]);
      }
    }
  }

  visitDomRepeatSymbolRenameable(start, end, quotedPrefix, originalPrefix, prop) {
    let propQName = FindReplacementExpressions.getPropertyString(prop);
    if (/^this\./.test(propQName)) {
      propQName = propQName.substr(5);
    }
    let prefixQName = FindReplacementExpressions.getPropertyString(originalPrefix);
    if (/^this\./.test(prefixQName)) {
      prefixQName = prefixQName.substr(5);
    }

    if (propQName.indexOf(prefixQName) === 0) {
      propQName = quotedPrefix + propQName.substr(prefixQName.length);
    }

    this.replacements.push({
      start,
      end,
      value: propQName
    });
  }

  visitDomRepeatObserverRenameable(start, end, prop) {
    const propQName = FindReplacementExpressions.getPropertyString(prop);
    const dotIndex = propQName.indexOf('.');

    this.replacements.push({
      start,
      end,
      value: propQName.substr(dotIndex + 1)
    });
  }

  visitBasicRenamable(start, end, prop) {
    let propParts = FindReplacementExpressions.getPropertyString(prop).split('.');

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
        return FindReplacementExpressions.getPropertyString(prop.object) + '.' +
            FindReplacementExpressions.getPropertyString(prop.property);
      case 'Identifier':
        return prop.name;
      case 'Literal':
        return prop.value;
      default:
        throw new Error('Unknown property expression: ' +  prop.type);
    }
  }
}

module.exports = FindReplacementExpressions;
