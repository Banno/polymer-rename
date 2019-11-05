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
  return input.replace(/\//g, '\\\\').replace(/`/g, '\\`');
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
          const fileList = new Map();
          results.renamingStatements.forEach(renamingStatement => {
            if (!renamingStatement.url || !renamingStatement.expression) {
              return;
            }
            if (!fileList.has(renamingStatement.url)) {
              fileList.set(renamingStatement.url, []);
            }
            fileList.get(renamingStatement.url).push(renamingStatement);
          });
          fileList.forEach((renamingStatementList, fileUrl) => {
            // Replace the expressions in reverse order since each replacement could
            // change the file length
            renamingStatementList.sort((a, b) => b.start - a.start);
            const originalFile = this._files.find(file => file.path === file.cwd + fileUrl.replace(/^file:\/\//, ''));
            let originalFileWorkingContents = originalFile.contents.toString();
            let newFileContent = [];
            renamingStatementList.forEach(replacement => {
              newFileContent.unshift(escapeTemplateString(originalFileWorkingContents.substr(replacement.end)));
              originalFileWorkingContents = originalFileWorkingContents.substr(0, replacement.start);
              newFileContent.unshift('${' + replacement.expression + '}');
            });
            if (originalFileWorkingContents.length > 0) {
              newFileContent.unshift(escapeTemplateString(originalFileWorkingContents));
            }
            const newFile = new gutil.File({
              contents: Buffer.from(`(function(){
function JSCompiler_renameProperty(a, b) { return a; }
var content;
var template = document.createElement('template');
template.innerHTML=\`${newFileContent.join('')}\`;
if (template.content) {
  content = template.content;
} else {
  content = document.createDocumentFragment();
  while (template.firstChild) {
    content.appendChild(template.firstChild);
  }
}
document.importNode(content, true);
})();\n${results.output}`, 'utf8'),
              path: originalFile.path + '.js',
              base: path.dirname(originalFile.path),
              cwd: path.dirname(originalFile.path)
            });
            this.push(newFile);
          });

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
