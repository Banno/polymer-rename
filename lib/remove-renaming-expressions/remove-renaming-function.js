'use strict';

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

module.exports = async function(fileContents, sourceMap) {
  const ast = esprima.parse(fileContents, {loc: true, range: true});
  let polymerRenameStatement = null;
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
        throw new Error(`More than one polymer-rename function found in ${file.relative}`);
      }
      polymerRenameStatement = statement;
    }
  });
  if (polymerRenameStatement) {
    const newFileContents = fileContents.substr(0, polymerRenameStatement.range[0]) +
        '/** polymer-rename */' +
        fileContents.substr(polymerRenameStatement.range[1]);
    if (sourceMap) {
      return await (new SourceMapConsumer(sourceMap)).then(sourceMapConsumer => {
        const generatorOptions = {};
        if (sourceMap.file) {
          generatorOptions.file = sourceMap.file;
        }
        if (sourceMap.sourceRoot) {
          generatorOptions.sourceRoot = sourceMap.sourceRoot;
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
        return {
          contents: newFileContents,
          sourceMap: sourceMapGenerator.toJSON()
        };
      });
    } else {
      return {
        contents: newFileContents
      }
    }
  }
  return {
    contents: fileContents
  };
};