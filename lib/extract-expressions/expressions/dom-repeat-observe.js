'use strict';

const IdentifierExpression = require('./identifier');

class DomRepeatObserve extends IdentifierExpression {
  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let basenameString = '';
    if (this.basePropertyName) {
      basenameString = `, ${this.basePropertyName}, '${this.basePropertyName}'`;
    }
    return `${indent}polymerRename.domRepeatObserve(${this.start}, ${this.end}, ${this.identifier}${basenameString});`;
  }
}

module.exports = DomRepeatObserve;

