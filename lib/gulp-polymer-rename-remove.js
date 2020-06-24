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
const removeRenamingFunction = require('./remove-renaming-expressions/remove-renaming-function');

function generatedMappingFromConsumerMapping(mapping) {
  const newMapping = {
    source: mapping.source,
    name: mapping.name
  };
  if (mapping.originalLine !== null && mapping.originalLine !== undefined) {
    newMapping.original = {
      line: mapping.originalLine,
      column: mapping.originalColumn
    };
  } else {
    newMapping.original = null;
  }
  if (mapping.generatedLine !== null && mapping.generatedLine !== undefined) {
    newMapping.generated = {
      line: mapping.generatedLine,
      column: mapping.generatedColumn
    };
  } else {
    newMapping.generated = null;
  }
  return newMapping;
}

/** Transform stream for gulp to pipe vinyl files through and remove renaming type checking statements */
class PolymerRemoveExpressionsStream extends stream.Transform {
  /** @param {string} renamedReferencesPath to html */
  constructor() {
    super({objectMode: true});
  }

  /** @override */
  async _transform(file, enc, cb) {
    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streaming not supported'));
      cb();
      return;
    }
    if (file.sourceMap && file.sourceMap.mappings.length === 0 && file.sourceMap.sources.length === 0) {
      file.sourceMap =
          StringReplaceSourceMap.generateJsIdentityMap(file.relative, file.contents.toString('utf8'));
    }

    let results;
    try {
      results = await removeRenamingFunction(file.contents.toString('utf8'), file.sourceMap);
    } catch (e) {
      const err = new PluginError(PLUGIN_NAME, e.message);
      err.stack = e.stack;
      this.emit('error', err);
      cb();
      return;
    }

    const newFile = file.clone();
    newFile.contents = Buffer.from(results.contents);
    if (results.sourceMap) {
      newFile.sourceMap = results.sourceMap;
    }
    this.push(newFile);
    cb();
  }
}

module.exports = function() {
  return new PolymerRemoveExpressionsStream();
};
