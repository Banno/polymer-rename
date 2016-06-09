'use strict';
const RenameableSymbol = require('./symbol');

class DomRepeatSymbolNonRenameable extends RenameableSymbol {
  /**
   * @param {RenameableSymbol} renameable
   */
  constructor(renameable, prefix) {
    super(renameable.start, renameable.end, renameable.symbol, false);

    this.prefix = prefix;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    return `${indent}polymerRename.domRepeatSymbol(${this.start}, ${this.end}, '${this.prefix}', ${this.symbol});`;
  }
}

module.exports = DomRepeatSymbolNonRenameable;
