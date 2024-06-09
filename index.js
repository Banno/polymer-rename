'use strict';

// Patch babylon to support newer ECMAScript syntax
const babylon = require('babylon');
const originalParse = babylon.parse;
babylon.parse = function parse(input, options) {
  const newOptions = Object.assign({}, options);
  newOptions.plugins = newOptions.plugins
      .concat([
        'optionalChaining',
        'nullishCoalescingOperator',
        'optionalCatchBinding',
        'classProperties',
        'logicalAssignment',
      ]);
  return originalParse.call(babylon, input, newOptions);
};

const extractExpressions = require('./lib/gulp-polymer-rename-extract');
const removeExpressions = require('./lib/gulp-polymer-rename-remove');

module.exports = {
  extract: extractExpressions,
  remove: removeExpressions
};
