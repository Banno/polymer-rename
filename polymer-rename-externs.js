/**
 * @fileoverview Externs for the polymer-rename package
 *
 * @externs
 */

/** @interface */
function PolymerRename() {} 

/** @param {!Function} fn */
PolymerRename.prototype.sink = function(fn) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {!Function} identifier
 * @param {*=} baseObject
 * @param {string=} baseObjectName
 */
PolymerRename.prototype.method = function(start, end, identifier, baseObject, baseObjectName) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {*} identifier
 * @param {*=} baseObject
 * @param {string=} baseObjectName
 */
PolymerRename.prototype.identifier = function(start, end, identifier, baseObject, baseObjectName) {};

/** @param {boolean} filter */
PolymerRename.prototype.domRepeatFilter = function(filter) {};

/** @param {number} compare */
PolymerRename.prototype.domRepeatSort = function(compare) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {*} identifier
 * @param {*} baseObject
 * @param {string} baseObjectName
 */
PolymerRename.prototype.domRepeatObserve = function(start, end, identifier, baseObject, baseObjectName) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {Element} customElement
 * @param {*} prop
 */
PolymerRename.prototype.attribute = function(start, end, customElement, prop) {};

/**
 * @param {number} start
 * @param {number} end
 * @param {EventListener|function(!Event):(boolean|undefined)} listener
 */
PolymerRename.prototype.eventListener = function(start, end, listener) {};

/**
 * @const
 * @type {!PolymerRename}
 */
var polymerRename;
