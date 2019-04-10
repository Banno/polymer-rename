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
    super(url, placeholder, start, end, elementAttribute, false, null, elementType);
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
        `(polymerRename.createElement('${this.elementTagName}'));`);
    output.push(`${indent}  polymerRename.attribute(${JSON.stringify(this.url)}, ${JSON.stringify(this.placeholder)}, ${this.start}, ${this.end}, ${varName}, ${varName}.${propName});`);
    output.push(`${indent}}`);
    return output.join('\n');
  }

  // /** @override */
  // getRenamingStatement() {
  //   let propName = this.getMethodName();
  //   let propNameParts = propName.split('.');
  //   let results = [];
  //   let reflectedTypeExpr = `/** @type {!${propName[0]}} */({})`;
  //   for (let i = this.isElementProperty ? 1 : 0; i < propNameParts.length; i++) {
  //     results.push(`JSCompiler_renameProperty('${propNameParts[i]}', ${reflectedTypeExpr}).replace(/[A-Z]/g, (letter, offset, originalString) => letter.toLowerCase() + (offset < originalString.length - 1 ? '-' + ''))`);
  //     reflectedTypeExpr += `.${propNameParts[i]}`;
  //   }
  //   return results.join(' + ');
  // }
}

module.exports = Attribute;

