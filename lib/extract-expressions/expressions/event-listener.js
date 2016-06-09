'use strict';

const RenambleMethod = require('./method');

class RenambleEventListener extends RenambleMethod {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} methodName
   */
  constructor(start, end, methodName) {
    super(start, end, methodName, []);
  }

  get SINK_METHOD() {
    return 'polymerRename.eventListener';
  }
}

module.exports = RenambleEventListener;
