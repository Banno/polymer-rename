/**
 * @fileoverview Externs for the polymer-rename package
 *
 * @externs
 */

/** @const */
var polymerRename = {};

/**
 * @param {number} start
 * @param {number} end
 * @param {!Function} identifier
 * @param {*=} baseObject
 * @param {string=} baseObjectName
 */
polymerRename.method = function(start, end, identifier, baseObject, baseObjectName) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {*} identifier
 * @param {*=} baseObject
 * @param {string=} baseObjectName
 */
polymerRename.identifier = function(start, end, identifier, baseObject, baseObjectName) {};

/** @param {boolean} filter */
polymerRename.domRepeatFilter = function(filter) {};

/** @param {number} compare */
polymerRename.domRepeatSort = function(compare) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {*} identifier
 * @param {*} baseObject
 * @param {string} baseObjectName
 */
polymerRename.domRepeatObserve = function(start, end, identifier, baseObject, baseObjectName) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {Element} customElement
 * @param {*} prop
 */
polymerRename.attribute = function(start, end, customElement, prop) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {EventListener|function(!Event):(boolean|undefined)} listener
 */
polymerRename.eventListener = function(start, end, listener) {};
