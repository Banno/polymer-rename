'use strict';

const Identifier = require('./identifier');

class Attribute extends Identifier {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} elementTag
   * @param {string} elementType
   * @param {string} elementAttribute
   */
  constructor(start, end, tagName, elementType, elementAttribute) {
    super(start, end, elementAttribute, false);
    this.elementTagName = tagName;
    this.elementTypeName = elementType;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';

    let varName = 'polymerRename_' + this.elementTagName.replace(/-/g, '_') + 'Element';
    let propName = Attribute.hyphenatedToCamelCase(this.identifier);

    let output = [`${indent}{`];
    output.push(`${indent}  let ${varName} = /** @type {!${this.elementTypeName}} */ (document.createElement('${this.elementTagName}'));`);
    output.push(`${indent}  polymerRename.attribute(${this.start}, ${this.end}, ${varName}, ${varName}.${propName});`);
    output.push(`${indent}}`);
    return output.join('\n');
  }
}

module.exports = Attribute;

