'use strict';

const BaseExpression = require('./base');

class LiteralArgument extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} literal
   */
  constructor(start, end, literal) {
    super(start, end);
    this.symbol = literal;
    this.isElementProperty = false;
  }

  /**
   * @param {string} indent
   * @return {string}
   */
  getReference(indent) {
    indent = indent || '';
    return `${indent}${this.symbol}`;
  }
}

module.exports = LiteralArgument;
