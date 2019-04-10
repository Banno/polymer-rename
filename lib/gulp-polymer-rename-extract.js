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
const parseElements = require('./extract-expressions/parse-polymer-elements');

/** Transform stream for gulp to pipe vinyl files through and extract expressions */
class PolymerRenamerStream extends stream.Transform {
  /**
   * @param {{
   *     outputFilename: (string|undefined)
   *   }=} options object
   */
  constructor(options = {}) {
    super({objectMode: true});
    this.outputFilename = options.outputFilename || 'template.js';
    this._files = [];
  }

  /** @override */
  _transform(file, enc, cb) {
    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streaming not supported'));
      cb();
      return;
    }

    this._files.push(file);

    cb();
  }

  /** @override */
  _flush(cb) {
    if (this._files.length === 0) {
      return cb();
    }

    // console.error(`_flush ${this._files.length}`);

    const projectRoot = this._files[0].base;

    parseElements(projectRoot, ...this._files)
        .then(results => {
          results.warnings.forEach(warning => {
            gutil.log('[polymer-rename]', warning);
          });

          // replace references in matching HTML file from _files array

          this.push(new gutil.File({
            base: projectRoot,
            path: this.outputFilename || this._files[0].path,
            contents: Buffer.from(results.output, 'utf8')
          }));
          cb();
        })
        .catch(err => {
          cb(new gutil.PluginError('polymer-rename', err.message, {showStack: true}));
        });
  }
}

module.exports = function(options) {
  return new PolymerRenamerStream(options);
};
