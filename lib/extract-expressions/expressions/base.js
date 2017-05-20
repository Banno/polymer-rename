'use strict';

/**
 * Base expression class
 */
class BaseExpression {
  /**
   * @param {number} start index
   * @param {number} end index
   */
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  /** @return {string} type checking statement */
  getStatement() {
    return '';
  }

  /**
   * @param {string=} indent whitespace to indent the expression
   * @return {string} JS string for the expression
   */
  toString(indent) {
    return '';
  }

  /**
   * @param {string=} indent whitespace to indent the expression
   * @return {string} JS string for the expression
   */
  toClosingString(indent) {
    return '';
  }
}

module.exports = BaseExpression;
