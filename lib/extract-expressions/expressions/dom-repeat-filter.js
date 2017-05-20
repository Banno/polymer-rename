'use strict';

const BaseExpression = require('./base');

/**
 * Expression class for dom-repeat filter attributes
 */
class DomRepeatFilter extends BaseExpression {
  /**
   * @param {number} start index
   * @param {number} end index
   * @param {string} fnStatement type checking JS string for the filter function
   * @param {string} itemsStatement type checking JS string for the items array
   */
  constructor(start, end, fnStatement, itemsStatement) {
    super(start, end);
    this.fnStatement = fnStatement;
    this.itemsStatement = itemsStatement;
  }

  /** @override */
  toString(indent) {
    return `${indent}polymerRename.domRepeatFilter(${this.fnStatement}(${this.itemsStatement}[0]));`;
  }
}

module.exports = DomRepeatFilter;
