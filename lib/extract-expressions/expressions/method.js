'use strict';

const BaseExpression = require('./base');

class RenambleMethod extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} methodName
   * @param {!Array<!RenameableSymbol>} args
   */
  constructor(start, end, methodName, args) {
    super(start, end);
    this.methodName = methodName;
    this.args = args;
  }

  get SINK_METHOD() {
    return 'polymerRename.method';
  }

  /** @override */
  getTypeCheckingStatements(indent) {
    indent = indent || '';
    let argNames = [];
    for (let i = 0; i < this.args.length; i++) {
      let prefix = this.args[i].isElementProperty ? 'this.' : '';
      argNames.push(`${prefix}${this.args[i].symbol}`);
    }

    return `${indent}this.${this.methodName}(${argNames.join(', ')});\n`;
  }

  /**
   * @param {string} indent
   * @return {string}
   */
  getReference(indent) {
    indent = indent || '';
    let args = '';
    for (let i = 0; i < this.args.length; i++) {
      if (i !== 0) {
        args += ', ';
      }
      args += this.args[i].getReference();
    }
    let prefix = this.isElementProperty ? 'this.' : '';
    return `${indent}this.${this.methodName}(${args})`;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';

    let output = `${this.getTypeCheckingStatements(indent)}`;

    output += `${indent}${this.SINK_METHOD}(${this.start}, ${this.end}, this.${this.methodName});`;
    for (let i = 0; i < this.args.length; i++) {
      output += this.args[i].toString('\n' + indent);
    }

    return output;
  }
}

module.exports = RenambleMethod;
