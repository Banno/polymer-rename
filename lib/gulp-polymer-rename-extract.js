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

function escapeTemplateString(input) {
  return input.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

/** Transform stream for gulp to pipe vinyl files through and extract expressions */
class PolymerRenamerStream extends stream.Transform {
  /**
   * @param {{
   *     outputFilename: (string|undefined)
   *   }=} options object
   */
  constructor(options = {}) {
    super({objectMode: true});
    this._files = [];
    this._opts = options;
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

    const opts = {
      projectRoot: this._files[0].base,
      excludedPaths: this._opts.excludedPaths
    };

    parseElements(opts, ...this._files)
        .then(results => {
          results.warnings.forEach(warning => {
            gutil.log('[polymer-rename]', warning);
          });
          results.features.forEach((featureInfo, fileUrl) => {
            // Replace the expressions in reverse order since each replacement could
            // change the file length
            const normalizedFileUrl = unescape(fileUrl.substr('file://'.length));
            const features = featureInfo.renameExpressions.sort((a, b) => b.start - a.start);
            const originalFileIndex = this._files.findIndex(file => file.path === normalizedFileUrl);
            const originalFile = this._files[originalFileIndex];
            let originalFileWorkingContents = originalFile.contents.toString();
            let newFileContent = [];
            features.forEach(replacement => {
              newFileContent.unshift(originalFileWorkingContents.substr(replacement.end));
              originalFileWorkingContents = originalFileWorkingContents.substr(0, replacement.start);
              newFileContent.unshift('${__createTemplateFromString(' + replacement.expression + ')}');
            });
            if (originalFileWorkingContents.length > 0) {
              newFileContent.unshift(originalFileWorkingContents);
            }
            const newFile = originalFile.clone();
            const templateCreator = `function __createTemplateFromString(a) {
  const template = /** @type {!HTMLTemplateElement} */(document.createElement('template'));
  template.innerHTML = a;
  return template;
}`;
            newFile.contents = Buffer.from(`${newFileContent.join('')}\n${templateCreator}\n${featureInfo.output}`, 'utf8');
            this._files[originalFileIndex] = newFile;
          });
          this._files.forEach(file => this.push(file));

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
