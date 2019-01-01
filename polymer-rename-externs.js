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
 * @template T
 * @param {!Array<T>|null|undefined} arr
 * @return {!Array<T>}
 */
PolymerRename.prototype.restrictNull = function(arr) {};

/**
 * @param {string} url
 * @param {string} placeholder
 * @param {number} start
 * @param {number} end
 * @param {!Function} identifier
 * @param {*=} baseObject
 * @param {string=} baseObjectName
 */
PolymerRename.prototype.method = function(url, placeholder, start, end, identifier, baseObject, baseObjectName) {};

/**
 * @param {string} url
 * @param {string} placeholder
 * @param {number} start
 * @param {number} end
 * @param {*} identifier
 * @param {*=} baseObject
 * @param {string=} baseObjectName
 */
PolymerRename.prototype.identifier = function(url, placeholder, start, end, identifier, baseObject, baseObjectName) {};

/** @param {boolean} filter */
PolymerRename.prototype.domRepeatFilter = function(filter) {};

/** @param {number} compare */
PolymerRename.prototype.domRepeatSort = function(compare) {};

/**
 * @param {string} url
 * @param {string} placeholder
 * @param {number} start
 * @param {number} end
 * @param {*} identifier
 * @param {*} baseObject
 * @param {string} baseObjectName
 */
PolymerRename.prototype.domRepeatObserve = function(url, placeholder, start, end, identifier, baseObject, baseObjectName) {};

/**
 * @param {string} url
 * @param {string} placeholder
 * @param {number} start
 * @param {number} end
 * @param {Element} customElement
 * @param {*} prop
 */
PolymerRename.prototype.attribute = function(url, placeholder, start, end, customElement, prop) {};

/**
 * @param {string} url
 * @param {string} placeholder
 * @param {number} start
 * @param {number} end
 * @param {EventListener|function(!Event):(boolean|undefined)} listener
 */
PolymerRename.prototype.eventListener = function(url, placeholder, start, end, listener) {};

/**
 * @param {string} tagName
 * @return {!Element}
 */
PolymerRename.prototype.createElement = function(tagName) {};

/**
 * @const
 * @type {!PolymerRename}
 */
var polymerRename;
