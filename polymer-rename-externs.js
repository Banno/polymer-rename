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
 * @param {!Function} prop
 */
polymerRename.method = function(start, end, prop) {}

/**
 * @param {number} start
 * @param {number} end
 * @param {*} prop
 */
polymerRename.property = function(start, end, prop) {}

/**
 * @param {number} start
 * @param {number} end
 * @param {EventListener|function(!Event):(boolean|undefined)} listener
 */
polymerRename.eventListener = function(start, end, listener) {};

/**
 * @param {*} item
 */
polymerRename.domRepeatItem = function(item) {}

/**
 * @param {number} start
 * @param {number} end
 * @param {*} item
 * @param {*} prop
 */
polymerRename.domRepeatProperty = function(start, end, item, prop) {};
