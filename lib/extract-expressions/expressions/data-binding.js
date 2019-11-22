'use strict';

const BaseExpression = require('./base');

/**
 * Expression class data binding expressions
 */
class DataBinding extends BaseExpression {
  /**
   * @param {string} mainElementStatement primary data binding statement
   * @param {string} subElementTagName tag name of the element which the expression is attached
   * @param {string} subElementType type name of the element which the expression is attached
   * @param {string} subElementProperty property name of the element which the expression is attached
   * @param {boolean=} isTwoWay whether the binding is two-way vs one-way
   */
  constructor(
      mainElementStatement,
      subElementTagName,
      subElementType,
      subElementProperty,
      isTwoWay = false) {
    super(undefined, undefined, -1, -1);
    this.mainElementStatement = mainElementStatement;
    this.subElementTagName = subElementTagName;
    this.subElementType = subElementType;
    this.subElementProperty = subElementProperty;
    this.isTwoWay = isTwoWay;
  }

  /** @override */
  getStatement() {
    throw new Error('Not implemented');
  }

  /** @override */
  toString(indent) {
    indent = indent || '';

    let typeNameParts = this.subElementType.split('.');
    typeNameParts.map(part => part.replace(/[^a-z0-9_\$]+/, '_'));

    let varName = 'polymerRename_' + typeNameParts.join('$');
    let propName = this.subElementProperty.replace(/-([a-z])/g, (match, g1) => g1.toUpperCase());
    let mainElementStatement = this.mainElementStatement;
    if (this.subElementType === 'DomIf' && this.subElementProperty === 'if') {
      mainElementStatement = `Boolean(${mainElementStatement})`;
    } else if (this.subElementType === 'DomRepeat' && this.subElementProperty === 'items') {
      mainElementStatement = `polymerRename.restrictNull(${mainElementStatement})`;
    }
    let output = [`${indent}{
${indent}  let ${varName} = /** @type {!${this.subElementType}} */(` +
        `polymerRename.createElement('${this.subElementTagName}'));
${indent}  ${varName}.${propName} = ${mainElementStatement};`];

    if (this.isTwoWay) {
      output.push(`${indent}  ${this.mainElementStatement} = ${varName}.${propName};`);
    }

    output.push(`${indent}}`);

    return output.join('\n');
  }
}

module.exports = DataBinding;
