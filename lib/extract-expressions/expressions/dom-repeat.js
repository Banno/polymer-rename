'use strict';

const BaseExpression = require('./base');
const RenameableSymbol = require('./symbol');
const RenameableMethod = require('./method');
const DomRepeatSymbolNonRenameable = require('./dom-repeat-non-renameable');

class RenameableRepeat extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {RenameableRepeat} parent
   * @param {!BaseExpression} items
   * @param {!Array<RenameableSymbol>=} observers
   * @param {!RenameableSymbol=} alias
   * @param {!RenameableSymbol=} index
   */
  constructor(start, end, parent, items, observers, alias, index) {
    super(start, end);
    this.parent = parent;
    this.items = items;
    this.alias = alias;
    this.index = index;

    /** @type {!Array<!BasicRenameable>} */
    this.renameables = observers || [];
  }

  /**
   * @param {string} symbol
   * @return {string}
   */
  getSymbolQualifiedName(symbol) {
    let symbolParts = symbol.split('.');

    if (symbolParts[0] === 'item' && !this.alias) {
      return symbol;
    }

    if (symbolParts[0] === 'index' && !this.index) {
      return symbol;
    }

    if (this.alias === symbolParts[0]) {
      return symbol;
    }

    if (this.index === symbolParts[0]) {
      return symbol;
    }

    if (!this.parent) {
      return 'this.' + symbol;
    }

    return this.parent.getSymbolQualifiedName(symbol);
  }

  /**
   * @param {string} symbol
   * @return {boolean}
   */
  isSymbolRenamable(symbol) {
    let symbolParts = symbol.split('.');

    if (symbolParts[0] === 'item' && !this.alias) {
      return false;
    }

    if (symbolParts[0] === 'index' && !this.index) {
      return false;
    }

    if (this.alias === symbolParts[0]) {
      return true;
    }

    if (this.index === symbolParts[0]) {
      return true;
    }

    if (!this.parent) {
      return true;
    }

    return this.parent.isSymbolRenamable(symbol);
  }

  /**
   * @param {!BasicRenameable} renameable
   * @return {!Array<BasicRenameable>}
   */
  rescopeChildElements(renameable) {
    // don't recurse into another dom-repeat
    if (renameable instanceof RenameableRepeat) {
      return renameable;
    }

    if (renameable instanceof RenameableMethod) {
      for (let i = 0; i < renameable.args.length; i++) {
        renameable.args[i] = this.correctChildSymbolScope(renameable.args[i]);
      }
      return renameable;
    } else {
      return this.correctChildSymbolScope(renameable);
    }
  }

  correctChildSymbolScope(renameable) {
    let symbolNameParts = this.getSymbolQualifiedName(renameable.symbol).split('.');
    if (this.isSymbolRenamable(renameable.symbol)) {
      renameable.isElementProperty = symbolNameParts[0] === 'this';
      return renameable;
    } else {
      return new DomRepeatSymbolNonRenameable(renameable, symbolNameParts[0]);
    }
  }

  updateReferencesTo(oldRenameable, newRenameable) {
    this.renameables.forEach(renameable => {
      if (renameable instanceof RenameableRepeat) {
        if (renameable.items === oldRenameable) {
          renameable.items = newRenameable;
        }
        renameable.updateReferencesTo(oldRenameable, newRenameable);
      }
    });
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let output = [];

    let alias = this.alias !== undefined ? this.alias : 'item';
    let index = this.index !== undefined ? this.index : 'index';

    let itemsName = this.items.getReference();
    output.push(`${indent}for (let ${index} = 0; ${index} < ${itemsName}.length; ${index}++) {`,
        `  ${indent}let ${alias} = ${itemsName}[${index}];`);

    for (let i = 0; i < this.renameables.length; i++) {
      output.push(this.renameables[i].toString(indent + '  '));
    }

    output.push(`${indent}}`);

    return output.join('\n');
  }
}

module.exports = RenameableRepeat;
