'use strict';

const BaseExpression = require('./base');

/**
 * Expression class for generic identifier references
 */
class Identifier extends BaseExpression {
  /**
   * @param {string} url
   * @param {string} placeholder
   * @param {number} start index
   * @param {number} end index
   * @param {string} identifier property or method name
   * @param {boolean=} isElementProperty is reference an instance property
   * @param {string=} basePropertyName for complex paths, the root property
   */
  constructor(url, placeholder, start, end, identifier, isElementProperty = true, basePropertyName = null) {
    super(url, placeholder, start, end);

    if (!start || !end) {
      throw new Error('invalid start/end');
    }
    this.identifier = identifier;
    this.isElementProperty = isElementProperty;
    this.basePropertyName = basePropertyName;

    this.removePathSuffixes();
  }

  /**
   * @protected
   * Remove polymer path suffixes ".*" and ".splices" - they shouldn't be renamed or type-checked.
   */
  removePathSuffixes() {
    if (/\.\*$/.test(this.identifier)) {
      this.identifier = this.identifier.substr(0, this.identifier.length - 2);
      this.end -= 2;
    } else if (/\.splices$/.test(this.identifier)) {
      this.identifier = this.identifier.substr(0, this.identifier.length - '.splices'.length);
      this.end -= '.splices'.length;
    }
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

    return `${indent}polymerRename.identifier(${JSON.stringify(this.url)}, ${JSON.stringify(this.placeholder)}, ${this.start}, ${this.end}, ${propName}${basenameString});`;
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

