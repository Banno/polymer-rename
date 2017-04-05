'use strict';

const Identifier = require('./identifier');

class DomRepeatIdentifier extends Identifier {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} identifier
   */
  constructor(start, end, identifier) {
    super(start, end);

    if (!start || !end) {
      throw new Error('invalid start/end');
    }
    this.identifier = identifier;
    this.isElementProperty = false;
  }

  /** @return {string} */
  getStatement() {
    return this.identifier;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    return '';
  }
}

module.exports = DomRepeatIdentifier;

