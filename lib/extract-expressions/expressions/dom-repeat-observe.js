'use strict';

const IdentifierExpression = require('./identifier');

/**
 * Expression class for dom-repeat observe attributes
 */
class DomRepeatObserve extends IdentifierExpression {
  /** @override */
  toString(indent) {
    indent = indent || '';
    let basenameString = '';
    if (this.basePropertyName) {
      basenameString = `, ${this.basePropertyName}, '${this.basePropertyName}'`;
    }
    return `${indent}polymerRename.domRepeatObserve(${JSON.stringify(this.url)}, ${JSON.stringify(this.placeholder)}, ${this.start}, ${this.end}, ${this.identifier}${basenameString});`;
  }
}

module.exports = DomRepeatObserve;
