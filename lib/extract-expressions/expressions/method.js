'use strict';

const BaseExpression = require('./base');

class RenambleMethod extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} methodName
   * @param {!Array<!RenameableProperty>} args
   */
  constructor(start, end, methodName, args) {
    super(start, end);
    this.methodName = methodName;
    this.args = args;
  }

  get SINK_METHOD() {
    return 'polymerRename.method';
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let output = `${indent}${this.SINK_METHOD}(${this.start}, ${this.end}, this.${this.methodName});`;
    for (let i = 0; i < this.args.length; i++) {
      output += this.args[i].toString('\n' + indent);
    }
    return output;
  }
}

module.exports = RenambleMethod;
