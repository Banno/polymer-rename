'use strict';

const Method = require('./method');

class EventListener extends Method {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} methodName
   * @param {boolean=} isRenameable
   */
  constructor(start, end, methodName, isRenameable = true) {
    super(start, end, methodName, isRenameable, ['new Event("event")'], true);
  }

  get SINK_METHOD() {
    return 'polymerRename.eventListener';
  }
}

module.exports = EventListener;
