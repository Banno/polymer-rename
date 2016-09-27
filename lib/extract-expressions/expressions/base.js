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
   * @param {string} indent
   * @return {string}
   */
  getTypeCheckingStatements(indent) {
    return '';
  }

  /**
   * @param {string} indent
   * @return {string}
   */
  getReference(indent) {
    return '';
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    return '';
  }
}

module.exports = BaseExpression;
