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
const PluginError = require('plugin-error');
const fancyLog = require('fancy-log');
const parseElements = require('./extract-expressions/parse-polymer-elements');
const StringReplaceSourceMap = require('string-replace-source-map');

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

    const opts = {
      projectRoot: this._files[0].base,
      excludedPaths: this._opts.excludedPaths
    };

    let currentFile;

    parseElements(opts, ...this._files)
        .then(async results => {
          results.warnings.forEach(warning => {
            fancyLog('[polymer-rename]', warning);
          });
          let resultFeatures = [];
          results.features.forEach((feature, fileUrl) => {
            resultFeatures.push({feature, fileUrl});
          });
          for (let i = 0; i < resultFeatures.length; i++) {
            const {feature, fileUrl} = resultFeatures[i];
            const normalizedFileUrl = unescape(fileUrl.substr('file://'.length));
            const originalFileIndex = this._files.findIndex(file => file.path === normalizedFileUrl);
            const originalFile = this._files[originalFileIndex];
            currentFile = originalFile.path;
            let originalFileContents = originalFile.contents.toString();
            const fileContents = new StringReplaceSourceMap(originalFileContents, originalFile.sourceMap);
            feature.renameExpressions.forEach(replacement => {
              // Escaped backslashes on the line are not accounted for in indexes.
              // Look for and offset every single backslash character on the line.
              let lineStartIndex = originalFileContents.substr(0, replacement.start).lastIndexOf('\n');
              if (lineStartIndex < 0) {
                lineStartIndex = 0;
              }
              let currentLineOffset = 0;
              for (let i = originalFileContents.substr(0, replacement.start).lastIndexOf('\\');
                   i >= lineStartIndex;
                   i = originalFileContents.substr(0, i - 1).lastIndexOf('\\')) {
                currentLineOffset++;
              }

              fileContents.replace(
                  replacement.start + currentLineOffset,
                  replacement.end,
                  '${__createTemplateFromString(' + replacement.expression + ')}');
            });
            const newFile = originalFile.clone();
            const templateCreator = `function __createTemplateFromString(value) {
  const template = /** @type {!HTMLTemplateElement} */(document.createElement('template'));
  template.content.appendChild(document.createTextNode(value));
  return template;
}`;
            fileContents.append(`\n${templateCreator}\n${feature.output}`);
            newFile.contents = Buffer.from(fileContents.toString(), 'utf8');
            if (originalFile.sourceMap) {
              newFile.sourceMap = await fileContents.generateSourceMap();
            }
            this._files[originalFileIndex] = newFile;
          }
          this._files.forEach(file => this.push(file));
          cb();
        })
        .catch(err => {
          const errMessage = `${currentFile} - ${err.message}`;
          cb(new PluginError('polymer-rename', errMessage, {showStack: true}));
        });
  }
}

module.exports = function(options) {
  return new PolymerRenamerStream(options);
};
