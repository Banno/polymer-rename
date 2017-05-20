'use strict';

const Identifier = require('./identifier');

/** Expression class for attributes */
class Attribute extends Identifier {
  /**
   * @param {number} start index
   * @param {number} end index
   * @param {string} tagName name
   * @param {string} elementType type name
   * @param {string} elementAttribute attribute name
   */
  constructor(start, end, tagName, elementType, elementAttribute) {
    super(start, end, elementAttribute, false);
    this.elementTagName = tagName;
    this.elementTypeName = elementType;
  }

  /** @override */
  toString(indent) {
    indent = indent || '';

    let varName = 'polymerRename_' + this.elementTagName.replace(/-/g, '_') + 'Element';
    let propName = Attribute.hyphenatedToCamelCase(this.identifier);

    let output = [`${indent}{`];
    output.push(`${indent}  let ${varName} = /** @type {!${this.elementTypeName}} */ ` +
        `(document.createElement('${this.elementTagName}'));`);
    output.push(`${indent}  polymerRename.attribute(${this.start}, ${this.end}, ${varName}, ${varName}.${propName});`);
    output.push(`${indent}}`);
    return output.join('\n');
  }
}

module.exports = Attribute;

