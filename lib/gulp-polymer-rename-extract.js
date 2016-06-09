/**
 * @fileoverview Gulp task to extract polymer data-binding expressions.
 * Each HTML input file is parsed, and a data bound expressions are output
 * in a valid JS file that can be provided to closure-compiler for type checking
 * and property renaming.
 *
 * @author Chad Killingsworth (chadkillingsworth@gmail.com)
 */

'use strict';

const stream = require('stream');
const PLUGIN_NAME = 'gulp-polymer-rename';
const gutil = require('gulp-util');
const PluginError = gutil.PluginError;
const path = require('path');
const parseElements = require('./extract-expressions/parse-polymer-elements');

class PolymerRenamerStream extends stream.Transform {
  /**
   * @param {function(string):string} transformFnc
   */
  constructor() {
    super({objectMode: true});
  }

  _transform(file, enc, cb) {
    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streaming not supported'));
      cb();
      return;
    }

    let outputPath = file.path;
    let origExt = path.extname(outputPath);
    if (origExt.length > 0) {
      outputPath = outputPath.substr(0, outputPath.length - origExt.length);
    }
    outputPath += ".js";

    this.push(new gutil.File({
      path: outputPath,
      contents: new Buffer(parseElements(file.contents.toString()))
    }));

    cb();
  };
}

module.exports = function() {
  return new PolymerRenamerStream();
};
