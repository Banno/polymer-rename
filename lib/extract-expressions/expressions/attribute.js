'use strict';

const Identifier = require('./identifier');

/** Expression class for attributes */
class Attribute extends Identifier {
  /**
   * @param {string} url
   * @param {string} placeholder
   * @param {number} start index
   * @param {number} end index
   * @param {string} tagName name
   * @param {string} elementType type name
   * @param {string} elementAttribute attribute name
   */
  constructor(url, placeholder, start, end, tagName, elementType, elementAttribute) {
    const identifier = Attribute.hyphenatedToCamelCase(elementAttribute);
    super(url, placeholder, start, end, identifier, false, null, elementType);
    this.elementTagName = tagName;
    this.elementTypeName = elementType;
    this.attribute = elementAttribute;
  }

  /** @override */
  toString(indent) {
    indent = indent || '';

    let varName = 'polymerRename_' + this.elementTagName.replace(/-/g, '_') + 'Element';
    let propName = this.identifier;

    let output = [`${indent}{`];
    output.push(`${indent}  let ${varName} = /** @type {!${this.elementTypeName}} */ ` +
        `(polymerRename.createElement('${this.elementTagName}'));`);
    output.push(`${indent}  polymerRename.attribute(${JSON.stringify(this.url)}, ${JSON.stringify(this.placeholder)}, ${this.start}, ${this.end}, ${varName}, ${varName}.${propName});`);
    output.push(`${indent}}`);
    return output.join('\n');
  }

  /** @override */
  getRenamingStatement() {
    return `${super.getRenamingStatement()}.replace(/[A-Z]/g, match => '-' + match.toLowerCase())`;
  }
}

module.exports = Attribute;

