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
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let prefix = this.isElementProperty ? 'this.' : '';

    return `${indent}polymerRename.symbol(${this.start}, ${this.end}, ${prefix}${this.symbol});`;
  }
}

module.exports = RenameableSymbol;

