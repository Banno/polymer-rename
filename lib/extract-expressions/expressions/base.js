'use strict';

/**
 * Base expression class
 */
class BaseExpression {
  /**
   * @param {string} url
   * @param {string} placeholder
   * @param {number} start index
   * @param {number} end index
   */
  constructor(url, placeholder, start, end) {
    this.url = url;
    this.placeholder = placeholder;
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

  /** @return {string|null} */
  getRenamingStatement() {
    return null;
  }
}

module.exports = BaseExpression;
