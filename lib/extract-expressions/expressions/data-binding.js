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
    super(-1, -1);
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
    let output = [`${indent}{
${indent}  let ${varName} = /** @type {!${this.subElementType}} */(document.createElement('${this.subElementTagName}'));
${indent}  ${varName}.${propName} = ${this.mainElementStatement};`];

    if (this.isTwoWay) {
      output.push(`${indent}  ${this.mainElementStatement} = ${varName}.${propName};`);
    }

    output.push(`${indent}}`);

    return output.join('\n');
  }
}

module.exports = DataBinding;
