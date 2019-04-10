'use strict';

const BaseExpression = require('./base');

/**
 * Expression class for dom-repeat sort attributes
 */
class DomRepeatSort extends BaseExpression {
  /**
   * @param {number} start index
   * @param {number} end index
   * @param {string} fnStatement type checking JS string for the sort function
   * @param {string} itemsStatement type checking JS string for the items array
   */
  constructor(start, end, fnStatement, itemsStatement) {
    super(undefined, undefined, start, end);
    this.fnStatement = fnStatement;
    this.itemsStatement = itemsStatement;
  }

  /** @override */
  toString(indent) {
    return `${indent}polymerRename.domRepeatSort(${this.fnStatement}(${this.itemsStatement}[0], ` +
        `${this.itemsStatement}[1]));`;
  }
}

module.exports = DomRepeatSort;
