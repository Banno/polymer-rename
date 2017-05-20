'use strict';

const Identifier = require('./identifier');

/**
 * Expression class for special dom-repeat properties such as index-as and as
 */
class DomRepeatIdentifier extends Identifier {
  /**
   * @param {number} start index
   * @param {number} end index
   * @param {string} identifier of the item
   */
  constructor(start, end, identifier) {
    super(start, end);

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
}

module.exports = DomRepeatIdentifier;

