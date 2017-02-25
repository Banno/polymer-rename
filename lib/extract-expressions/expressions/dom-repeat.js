'use strict';

const BaseExpression = require('./base');
const Identifier = require('./identifier');
const Method = require('./method');
const Attribute = require('./attribute');

/**
 * @typedef {{
 *     name: string,
 *     base: string,
 *     elementTypeName: string,
 *     instanceProperty: boolean,
 *     renameable: boolean
 *   }}
 */
var DomRepeatProperty;

class DomRepeat extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {!DomRepeatProperty} items
   * @param {!DomRepeatProperty=} alias
   * @param {!DomRepeatProperty=} index
   */
  constructor(start, end, items, alias, index) {
    super(start, end, false);
    this.items = items;
    this.alias = alias;
    this.index = index;
    this.subExpressions = [];
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let output = [];

    let index = this.index.name;
    let items = (this.items.instanceProperty ? 'this.' : '') + this.items.name;

    output.push(`${indent}for (let ${index} = 0; ${index} < ${items}.length; ${index}++) {`,
        `  ${indent}let ${this.alias.name} = ${items}[${index}];`);

    return output.join('\n');
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toClosingString(indent) {
    indent = indent || '';
    return `${indent}}`;
  }
}

module.exports = DomRepeat;
