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

  /** @return {string} */
  getStatement() {
    return '';
  }

  /**
   * @param {string=} indent
   * @return {string}
   */
  toString(indent) {
    return '';
  }

  /**
   * @param {string=} indent
   * @return {string}
   */
  toClosingString(indent) {
    return '';
  }
}

module.exports = BaseExpression;
