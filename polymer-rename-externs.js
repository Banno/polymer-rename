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
polymerRename.symbol = function(start, end, prop) {}

/**
 * @param {number} start
 * @param {number} end
 * @param {EventListener|function(!Event):(boolean|undefined)} listener
 */
polymerRename.eventListener = function(start, end, listener) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {string} prefixQuoted
 * @param {*} prefix
 * @param {*} prop
 */
polymerRename.domRepeatSymbol = function(start, end, prefixQuoted, prefix, prop) {};
