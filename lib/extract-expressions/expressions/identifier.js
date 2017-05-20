'use strict';

const BaseExpression = require('./base');

/**
 * Expression class for generic identifier references
 */
class Identifier extends BaseExpression {
  /**
   * @param {number} start index
   * @param {number} end index
   * @param {string} identifier property or method name
   * @param {boolean=} isElementProperty is reference an instance property
   * @param {string=} basePropertyName for complex paths, the root property
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

  /** @override */
  getStatement() {
    return (this.isElementProperty ? 'this.' : '') + this.identifier;
  }

  /** @override */
  toString(indent) {
    indent = indent || '';
    let propName = this.getStatement();
    let basenameString = '';
    if (this.basePropertyName) {
      basenameString = `, ${this.basePropertyName}, '${this.basePropertyName}'`;
    }

    return `${indent}polymerRename.identifier(${this.start}, ${this.end}, ${propName}${basenameString});`;
  }

  /**
   * Helper method to convert a hyphenated attribute name to camel case
   * @param {string} input to convert
   * @return {string} hyphenated string
   */
  static hyphenatedToCamelCase(input) {
    return input.replace(/-([a-z])/g, function(match, letter) {
      return letter.toUpperCase();
    });
  }
}

module.exports = Identifier;

