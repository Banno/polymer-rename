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
}

module.exports = LiteralArgument;
