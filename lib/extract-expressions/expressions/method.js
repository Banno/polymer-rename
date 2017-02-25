'use strict';

const BaseExpression = require('./base');

class Method extends BaseExpression {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} methodName
   * @param {boolean} renameable
   * @param {string} args
   * @param {boolean=} isElementProperty
   * @param {string=} basePropertyName
   */
  constructor(start, end, methodName, renameable, args, isElementProperty, baseObject) {
    super(start, end);
    this.methodName = methodName;
    this.renameable = renameable;
    this.args = args;
    this.isElementProperty = isElementProperty;
    this.basenameString = baseObject;
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

    let methodName = (this.isElementProperty ? 'this.' : '') + this.methodName;
    let basenameString = '';
    if (this.basePropertyName) {
      basenameString = `, ${this.basePropertyName}, '${this.basePropertyName}'`;
    }

    let output = [`${indent}${methodName}(${this.args});`];

    if (this.renameable) {
      output.push(`${indent}${this.SINK_METHOD}(${this.start}, ${this.end}, ${methodName}${basenameString});`);
    }
    return output.join('\n');
  }
}

module.exports = Method;
