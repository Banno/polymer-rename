'use strict';

const BaseExpression = require('./base');

class RenameableSymbol extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} property
   * @param {boolean=} isElementProperty
   */
  constructor(start, end, symbol, isElementProperty) {
    super(start, end);
    this.symbol = symbol;
    this.isElementProperty = isElementProperty === undefined ? true : isElementProperty;

    /** @type {string|undefined} */
    this.elementTagName = undefined;
    /** @type {string|undefined} */
    this.elementTypeName = undefined;
    /** @type {string|undefined} */
    this.elementAttribute = undefined;

    /** @type {boolean|undefined} */
    this.twoWayBinding = undefined;
  }

  /** @override */
  getTypeCheckingStatements(indent) {
    let prefix = this.isElementProperty ? 'this.' : '';
    let output = '';
    if (this.elementTagName && this.elementTypeName && this.elementAttribute) {
      let varName = 'polymerRename_' + this.elementTagName.replace(/-/g, '_') + 'Element';
      let attrName = RenameableSymbol.hyphenatedToCamelCase(this.elementAttribute);
      output = `${indent}{
${indent}  let ${varName} = /** @type {${this.elementTypeName}} */(document.createElement('${this.elementTagName}'));
${indent}  ${varName}.${attrName} = ${prefix}${this.symbol};`;

      if (this.twoWayBinding) {
        output += `\n${indent}  ${prefix}${this.symbol} = ${varName}.${attrName};`;
      }

      output += `\n${indent}}\n`;
    }
    return output;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let prefix = this.isElementProperty ? 'this.' : '';
    let output = this.getTypeCheckingStatements(indent);

    return `${output}${indent}polymerRename.symbol(${this.start}, ${this.end}, ${prefix}${this.symbol});`;
  }

  static hyphenatedToCamelCase(input) {
    return input.replace(/-([a-z])/g, function(match, letter) {
      return letter.toUpperCase();
    });
  }
}

module.exports = RenameableSymbol;

