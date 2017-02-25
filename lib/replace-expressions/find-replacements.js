'use strict';

const acorn = require('acorn');
const walk = require('acorn/dist/walk');

const recognizedMethods = new Set();
recognizedMethods.add('identifier');
recognizedMethods.add('attribute');
recognizedMethods.add('method');
recognizedMethods.add('eventListener');
recognizedMethods.add('domRepeatObserve');

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
      if (node.callee.property.name === 'attribute') {
        this.visitAttributeRenamable(node.arguments[0].value, node.arguments[1].value, node.arguments[2],
            node.arguments[3]);
      } else if (node.callee.property.name === 'domRepeatObserve') {
        this.visitObserveRenamable(node.arguments[0].value, node.arguments[1].value, node.arguments[2],
            node.arguments[3], node.arguments[4]);
      } else  {
        this.visitBasicRenamable(node.arguments[0].value, node.arguments[1].value, node.arguments[2],
            node.arguments[3], node.arguments[4]);
      }
    }
  }

  visitAttributeRenamable(start, end, elem, prop) {
    let propParts = FindReplacementExpressions.getPropertyString(prop).split('.');
    if (propParts[0] !== elem.name) {
      console.error(propParts, elem);
      return;
    }
    let propName = propParts.slice(1).join('.');

    const firstLetter = propName.substr(0, 1);
    if (firstLetter === firstLetter.toUpperCase()) {
      console.error('Property name begins with upper: ', propName);
    }

    this.replacements.push({
      start,
      end,
      value: FindReplacementExpressions.camelToHyphenated(propName)
    });
  }

  visitObserveRenamable(start, end, prop, baseProp, basePropName) {
    let propParts = FindReplacementExpressions.getPropertyString(prop).split('.');

    if (baseProp && basePropName) {
      if (propParts[0] === baseProp.name) {
        propParts.shift();
      } else {
        console.error(baseProp);
        throw new Error(`Unexpected observable property: ${propParts.join('.')}, ${baseProp.name}`);
      }
    } else if (propParts[0] === 'this') {
      propParts.shift();
    }

    this.replacements.push({
      start,
      end,
      value: propParts.join('.')
    });
  }

  visitBasicRenamable(start, end, prop, baseProp, basePropName) {
    let propParts = FindReplacementExpressions.getPropertyString(prop).split('.');

    if (baseProp && basePropName) {
      if (propParts[0] === baseProp.name) {
        propParts[0] = basePropName.value;
      } else {
        console.error(baseProp);
        throw new Error(`Unexpected property format: ${propParts.join('.')}, ${baseProp.name}`);
      }
    } else if (propParts[0] === 'this') {
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

  static camelToHyphenated(input) {
    return input.replace(/[A-Z]/g, '-$&');
  }
}

module.exports = FindReplacementExpressions;
