'use strict';

const BaseExpression = require('./base');
const Identifier = require('./identifier'); // eslint-disable-line no-unused-vars
const Method = require('./method'); // eslint-disable-line no-unused-vars
const Attribute = require('./attribute'); // eslint-disable-line no-unused-vars

/**
 * @typedef {{
 *     name: string,
 *     base: string,
 *     elementTypeName: string,
 *     instanceProperty: boolean,
 *     renameable: boolean
 *   }}
 */
var DomRepeatProperty; // eslint-disable-line no-unused-vars, no-var

/**
 * Expression class dom-repeat elements
 */
class DomRepeat extends BaseExpression {
  /**
   * @param {number} start index
   * @param {number} end index
   * @param {!DomRepeatProperty} items expression which returns provides the items array
   * @param {!DomRepeatProperty=} alias referencing the current item in the items array
   * @param {!DomRepeatProperty=} index referencing the current item index in the items array
   */
  constructor(start, end, items, alias, index) {
    super(start, end, false);
    this.items = items;
    this.alias = alias;
    this.index = index;
    this.subExpressions = [];
  }

  /** @override */
  toString(indent) {
    indent = indent || '';
    let output = [];

    let index = this.index.name;
    let items = this.items.getStatement();

    output.push(`${indent}for (let ${index} = 0; ${index} < ${items}.length; ${index}++) {`,
        `  ${indent}let ${this.alias.name} = ${items}[${index}];`);

    return output.join('\n');
  }

  /** @override */
  toClosingString(indent) {
    indent = indent || '';
    return `${indent}}`;
  }
}

module.exports = DomRepeat;
