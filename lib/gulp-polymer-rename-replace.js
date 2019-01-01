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
const fs = require('fs');
const replaceExpressions = require('./replace-expressions/replace-expressions');

/** Transform stream for gulp to pipe vinyl files through and update data-binding expressions with renamed references */
class PolymerReplaceExpressionsStream extends stream.Transform {
  /** @param {string} renamedReferencesPath to html */
  constructor(renamedReferencesPath) {
    super({objectMode: true});

    this.renamedReferencesPath = renamedReferencesPath;
    this.renamedReferences = null;
  }

  /**
   * Read the original HTML file
   *
   * @return {Promise<string>} original HTML file reference
   * @private
   */
  getRenamedReferences_() {
    if (!this.renamedReferences) {
      this.renamedReferences = new Promise((resolve, reject) => {
        fs.readFile(this.renamedReferencesPath, {encoding: 'utf8'}, function(err, data) {
          if (err) {
            return reject(err);
          }

          resolve(data);
        });
      });
    }

    return this.renamedReferences;
  }

  /** @override */
  _transform(file, enc, cb) {
    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streaming not supported'));
      cb();
      return;
    }

    this.getRenamedReferences_().then(src => {
      let updatedTemplate = replaceExpressions(file.contents.toString(), src, file.relative || file.path);

      file.contents = new Buffer(updatedTemplate);
      this.push(file);
      cb();
    }).catch(err => {
      this.emit('error', new PluginError(PLUGIN_NAME, err, {showStack: true}));
      cb();
    });
  }
}

module.exports = function(templateContent) {
  return new PolymerReplaceExpressionsStream(templateContent);
};
