'use strict';
const RenameableSymbol = require('./symbol');

class DomRepeatObserverRenameable extends RenameableSymbol {
  /**
   * @param {RenameableSymbol} renameable
   * @param {string} itemName
   */
  constructor(renameable, itemName) {
    super(renameable.start, renameable.end, renameable.symbol, false);

    this.itemName = itemName;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    const itemName = (this.itemName ? this.itemName : 'item');

    return `${indent}polymerRename.domRepeatObserver(${this.start}, ${this.end}, ${itemName}.${this.symbol});`;
  }
}

module.exports = DomRepeatObserverRenameable;
