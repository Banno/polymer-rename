'use strict';

const extractExpressions = require('./lib/gulp-polymer-rename-extract');
const removeExpressions = require('./lib/gulp-polymer-rename-remove');

module.exports = {
  extract: extractExpressions,
  remove: removeExpressions
};
