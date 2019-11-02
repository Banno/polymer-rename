'use strict';

const Method = require('./method');

/**
 * Expression class for event listener attributes
 */
class EventListener extends Method {
  /**
   * @param {string} url
   * @param {string} placeholder
   * @param {number} start index
   * @param {number} end index
   * @param {string} methodName property name
   * @param {boolean=} isRenameable whether the method is renameable
   * @param {string=} basePropertyType
   */
  constructor(url, placeholder, start, end, methodName, isRenameable = true, basePropertyType) {
    super(url, placeholder, start, end, methodName, isRenameable, 'new CustomEvent("event")', true, basePropertyType);
  }

  /** @override */
  get SINK_METHOD() {
    return 'polymerRename.eventListener';
  }
}

module.exports = EventListener;
