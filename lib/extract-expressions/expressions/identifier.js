'use strict';

const BaseExpression = require('./base');

class Identifier extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} identifier
   * @param {boolean=} isElementProperty
   * @param {string=} basePropertyName
   */
  constructor(start, end, identifier, isElementProperty = true, basePropertyName = null) {
    super(start, end);

    if (!start || !end) {
      throw new Error('invalid start/end');
    }
    this.identifier = identifier;
    this.isElementProperty = isElementProperty;
    this.basePropertyName = basePropertyName;
  }

  /** @return {string} */
  getStatement() {
    return (this.isElementProperty ? 'this.' : '') + this.identifier;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let propName = this.getStatement();
    let basenameString = '';
    if (this.basePropertyName) {
      basenameString = `, ${this.basePropertyName}, '${this.basePropertyName}'`;
    }

    return `${indent}polymerRename.identifier(${this.start}, ${this.end}, ${propName}${basenameString});`;
  }

  static hyphenatedToCamelCase(input) {
    return input.replace(/-([a-z])/g, function(match, letter) {
      return letter.toUpperCase();
    });
  }
}

module.exports = Identifier;

