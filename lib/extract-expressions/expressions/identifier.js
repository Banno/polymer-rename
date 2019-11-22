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
   * @param {string=} basePropertyType
   */
  constructor(url, placeholder, start, end, identifier, isElementProperty = true, basePropertyName = null, basePropertyType = null) {
    super(url, placeholder, start, end);

    if (!start || !end) {
      throw new Error('invalid start/end');
    }
    this.identifier = identifier;
    this.isElementProperty = isElementProperty;
    this.basePropertyName = basePropertyName;
    this.basePropertyType = basePropertyType;
    this.domRepeatItemsExpression = null;

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

  getDomRepeatStatement() {
    if (this.isElementProperty || !this.domRepeatItemsExpression) {
      return `/** @type {!${this.basePropertyType}} */({}).${this.identifier}`;
    }

    const propParts = this.identifier.split('.');
    const tempIdentifier = new Identifier(
        this.url,
        this.placeholder,
        this.start,
        this.end,
        this.domRepeatItemsExpression.name,
        this.domRepeatItemsExpression.instanceProperty,
        this.domRepeatItemsExpression.base,
        this.domRepeatItemsExpression.elementTypeName);
    if (this.domRepeatItemsExpression.domRepeatItemsExpression) {
      tempIdentifier.domRepeatItemsExpression = this.domRepeatItemsExpression.domRepeatItemsExpression;
    }
    propParts[0] = `${tempIdentifier.getDomRepeatStatement()}[0]`;
    return propParts.join('.');
  }

  getDomRepeatRenamingStatement(propertySegmentCount = 1) {
    let reflectedTypeExpr = this.getDomRepeatStatement().split('.');
    if (reflectedTypeExpr.length > 0) {
      reflectedTypeExpr = reflectedTypeExpr.slice(0, reflectedTypeExpr.length - propertySegmentCount);
    }
    reflectedTypeExpr = reflectedTypeExpr.join('.');

    let propName = this.getStatement();
    let propNameParts = propName.split('.');
    let results = [];
    for (let i = 1; i < propNameParts.length; i++) {
      results.push(`JSCompiler_renameProperty('${propNameParts[i]}', ${reflectedTypeExpr})`);
      reflectedTypeExpr += `.${propNameParts[i]}`;
    }
    results.unshift(`"${propNameParts[0]}"`);
    return results.join(' + "." + ');
  }

  /** @override */
  getRenamingStatement() {
    let propName = this.getStatement();
    let propNameParts = propName.split('.');
    if (this.domRepeatItemsExpression) {
      if (propNameParts.length > 1) {
        return this.getDomRepeatRenamingStatement(propNameParts.length - 1);
      } else {
        return JSON.stringify(propName);
      }
    }

    let results = [];
    let reflectedTypeExpr = `/** @type {!${this.basePropertyType}} */({})`;
    for (let i = this.isElementProperty ? 1 : 0; i < propNameParts.length; i++) {
      results.push(`JSCompiler_renameProperty('${propNameParts[i]}', ${reflectedTypeExpr})`);
      reflectedTypeExpr += `.${propNameParts[i]}`;
    }
    return results.join(' + "." + ');
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

