'use strict';

const BaseExpression = require('./base');

class DomRepeatFilter extends BaseExpression {
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
    return `${indent}polymerRename.domRepeatFilter(${this.fnStatement}(${this.itemsStatement}[0]));`;
  }
}

module.exports = DomRepeatFilter;
