'use strict';

const extractExpressions = require('./lib/gulp-polymer-rename-extract');
const findReplacements = require('./lib/gulp-polymer-rename-replace');

module.exports = {
  extract: extractExpressions,
  replace: findReplacements
};
