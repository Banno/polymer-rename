'use strict';

const BaseExpression = require('./base');

/**
 * Expression class for methods
 */
class Method extends BaseExpression {
  /**
   * @param {string} url
   * @param {string} placeholder
   * @param {number} start index
   * @param {number} end index
   * @param {string} methodName indentifier
   * @param {boolean} renameable whether the method itself is renameable
   * @param {string} args for type checking statement
   * @param {boolean=} isElementProperty whether the method is an instance property
   */
  constructor(url, placeholder, start, end, methodName, renameable, args, isElementProperty) {
    super(url, placeholder, start, end);
    this.methodName = methodName;
    this.renameable = renameable;
    this.args = args;
    this.isElementProperty = isElementProperty;
  }

  /** @return {string} externs method name */
  get SINK_METHOD() {
    return 'polymerRename.method';
  }

  /** @return {string} method name */
  getMethodName() {
    return (this.isElementProperty ? 'this.' : '') + this.methodName;
  }

  /** @override */
  getStatement() {
    return `${this.getMethodName()}(${this.args})`;
  }

  /** @override */
  toString(indent) {
    indent = indent || '';
    let basenameString = '';
    if (this.basePropertyName) {
      basenameString = `, ${this.basePropertyName}, '${this.basePropertyName}'`;
    }

    let output = [`${indent}${this.getStatement()};`];

    if (this.renameable) {
      output.push(
          `${indent}${this.SINK_METHOD}(${JSON.stringify(this.url)}, ${JSON.stringify(this.placeholder)}, ${this.start}, ${this.end}, ${this.getMethodName()}${basenameString});`);
    }
    return output.join('\n');
  }
}

module.exports = Method;
