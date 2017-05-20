'use strict';

const BaseExpression = require('./base');

class DomRepeatSort extends BaseExpression {
  constructor(start, end, fnStatement, itemsStatement) {
    super(start, end);
    this.fnStatement = fnStatement;
    this.itemsStatement = itemsStatement;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    return `${indent}polymerRename.domRepeatSort(${this.fnStatement}(${this.itemsStatement}[0], ${this.itemsStatement}[1]));`;
  }
}

module.exports = DomRepeatSort;
