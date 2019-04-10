'use strict';

const Identifier = require('./identifier');

/**
 * Expression class for special dom-repeat properties such as index-as and as
 */
class DomRepeatIdentifier extends Identifier {
  /**
   * @param {string} url
   * @param {string} placeholder
   * @param {number} start index
   * @param {number} end index
   * @param {string} identifier of the item
   */
  constructor(url, placeholder, start, end, identifier) {
    super(url, placeholder, start, end);

    if (!start || !end) {
      throw new Error('invalid start/end');
    }
    this.identifier = identifier;
    this.isElementProperty = false;
  }

  /** @override */
  getStatement() {
    return this.identifier;
  }

  /** @override */
  toString(indent) {
    return '';
  }

  /** @override */
  getRenamingStatement() {
    return null;
  }
}

module.exports = DomRepeatIdentifier;

