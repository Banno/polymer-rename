'use strict';

const BaseExpression = require('./base');

class DataBinding extends BaseExpression {
  /**
   * @param {string} mainElementProperty
   * @param {string} subElementType
   * @param {string} subElementProperty
   * @param {boolean=} isTwoWay
   */
  constructor(
      mainElementProperty,
      subElementTagName,
      subElementType,
      subElementProperty,
      isTwoWay = false) {
    super(-1, -1);
    this.mainElementProperty = mainElementProperty;
    this.subElementTagName = subElementTagName;
    this.subElementType = subElementType;
    this.subElementProperty = subElementProperty;
    this.isTwoWay = isTwoWay;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';

    let typeNameParts = this.subElementType.split('.');
    typeNameParts.map(part => {
      return part.replace(/[^a-z0-9_\$]+/, '_');
    });

    let varName = 'polymerRename_' + typeNameParts.join('$');
    let propName = this.subElementProperty.replace(/-([a-z])/g, (match, g1) => g1.toUpperCase());
    let output = [`${indent}{
${indent}  let ${varName} = /** @type {!${this.subElementType}} */(document.createElement('${this.subElementTagName}'));
${indent}  ${varName}.${propName} = ${this.mainElementProperty};`];

    if (this.isTwoWay) {
      output.push(`${indent}  ${this.mainElementProperty} = ${varName}.${propName};`);
    }

    output.push(`${indent}}`);

    return output.join('\n');
  }

  static hyphenatedToCamelCase(input) {
    return input.replace(/-([a-z])/g, function(match, letter) {
      return letter.toUpperCase();
    });
  }
}

module.exports = DataBinding;
