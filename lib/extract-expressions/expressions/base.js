'use strict';

class BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   */
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    return '';
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toClosingString(indent) {
    return '';
  }
}

module.exports = BaseExpression;
