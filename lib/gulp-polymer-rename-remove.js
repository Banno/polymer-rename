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
const esprima = require('esprima');
const walk = require( 'esprima-walk' );
const {SourceMapConsumer, SourceMapGenerator} = require('source-map');

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
  _transform(file, enc, cb) {
    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME, 'Streaming not supported'));
      cb();
      return;
    }

    const contents = file.contents.toString('utf8');
    const ast = esprima.parse(contents, {loc: true, range: true});
    let polymerRenameStatement = null;
    let err = null;
    walk(ast, statement => {
      if (statement &&
          statement.type === "ExpressionStatement" &&
          statement.expression.type === "AssignmentExpression" &&
          statement.expression.left.type === "MemberExpression" &&
          statement.expression.left.object.type === "Identifier" &&
          statement.expression.left.object.name === "window" &&
          statement.expression.left.property.type === "Literal" &&
          statement.expression.left.property.value === 'polymer-rename') {
        if (polymerRenameStatement) {
          err = new PluginError(PLUGIN_NAME, `More than one polymer-rename function found in ${file.relative}`);
        }
        polymerRenameStatement = statement;
      }
    });
    if (err) {
      this.emit('error', err);
      cb();
      return;
    }
    if (polymerRenameStatement) {
      const newFile = file.clone();
      newFile.contents = Buffer.from(
          contents.substr(0, polymerRenameStatement.range[0]) +
          '/** polymer-rename */' +
          contents.substr(polymerRenameStatement.range[1]));
      if (file.sourceMap) {
        // const sourceMapConsumer = new SourceMapConsumer(file.sourceMap);
        (new SourceMapConsumer(file.sourceMap)).then(sourceMapConsumer => {
          const generatorOptions = {};
          if (file.sourceMap.file) {
            generatorOptions.file = file.sourceMap.file;
          }
          if (file.sourceMap.sourceRoot) {
            generatorOptions.sourceRoot = file.sourceMap.sourceRoot;
          }
          const sourceMapGenerator = new SourceMapGenerator(generatorOptions);
          sourceMapConsumer.eachMapping(mapping => {
            if (mapping.generatedLine < polymerRenameStatement.loc.start.line ||
                (mapping.generatedLine === polymerRenameStatement.loc.start.line &&
                    mapping.generatedColumn < polymerRenameStatement.loc.start.column)) {
              sourceMapGenerator.addMapping(generatedMappingFromConsumerMapping(mapping));
              return;
            }
            if (mapping.generatedLine < polymerRenameStatement.loc.end.line ||
                (mapping.generatedLine === polymerRenameStatement.loc.end.line &&
                    mapping.generatedColumn < polymerRenameStatement.loc.end.column)) {
              return;
            }
            const newMapping = Object.assign({}, mapping);
            newMapping.generatedLine -= polymerRenameStatement.loc.end.line - polymerRenameStatement.loc.start.line;
            if (mapping.generatedLine === polymerRenameStatement.loc.end.line &&
                mapping.generatedColumn >= polymerRenameStatement.loc.end.column) {
              newMapping.generatedColumn -= polymerRenameStatement.loc.end.column;
            }
            sourceMapGenerator.addMapping(generatedMappingFromConsumerMapping(newMapping));
          });
          sourceMapConsumer.sources.forEach(sourcePath => {
            const sourceContent = sourceMapConsumer.sourceContentFor(sourcePath);
            if (sourceContent) {
              sourceMapGenerator.setSourceContent(sourcePath, sourceContent);
            }
          });
          newFile.sourceMap = sourceMapGenerator.toJSON();
          this.push(newFile);
          cb();
        });
      } else {
        this.push(newFile);
        cb();
      }
    } else {
      this.push(file);
      cb();
    }
  }
}

module.exports = function() {
  return new PolymerRemoveExpressionsStream();
};
