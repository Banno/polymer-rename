'use strict';

const extractExpressions = require('./lib/gulp-extract');
const findReplacements = require('./lib/gulp-replace');

module.exports = {
  extract: extractExpressions,
  replace: findReplacements
};
