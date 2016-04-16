'use strict';

const extractExpressions = require('./lib/extract-expressions');

module.exports = {
  extract: extractExpressions,
  externsPath: require.resolve('./polymer-rename-externs')
};
