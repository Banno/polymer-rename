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
  const ast = esprima.parseModule(fileContents, {loc: true, range: true});
  let polymerRenameStatements = [];
  walk(ast, statement => {
    if (statement &&
        statement.type === "ExpressionStatement" &&
        statement.expression.type === "CallExpression" &&
        statement.expression.callee.type === "MemberExpression" &&
        statement.expression.callee.object.type === "Identifier" &&
        statement.expression.callee.object.name === "polymerRename" &&
        statement.expression.callee.property.type === "Identifier" &&
        statement.expression.callee.property.name === "typeCheckStatements") {
      polymerRenameStatements.push(statement);
    }
  });
  let newFileContents = fileContents;
  const replacementLocs = [];
  for (let i = polymerRenameStatements.length - 1; i >= 0; i--) {
    newFileContents = newFileContents.substr(0, polymerRenameStatements[i].range[0]) +
        newFileContents.substr(polymerRenameStatements[i].range[1]);
    replacementLocs.unshift({
      range: polymerRenameStatements[i].range,
      loc: polymerRenameStatements[i].loc
    });
  }
  replacementLocs.sort((a, b) => a.range[0] - b.range[0]);
  let newSourceMap = sourceMap;
  if (sourceMap && replacementLocs.length > 0) {
    const sourceMapConsumer = await (new SourceMapConsumer(sourceMap));
    const generatorOptions = {};
    if (sourceMap.file) {
      generatorOptions.file = sourceMap.file;
    }
    if (sourceMap.sourceRoot) {
      generatorOptions.sourceRoot = sourceMap.sourceRoot;
    }
    const sourceMapGenerator = new SourceMapGenerator(generatorOptions);
    let currentReplacementMarkerIndex = 0;
    let nextReplacementMarker = replacementLocs[currentReplacementMarkerIndex];
    let lineOffset = 0;
    let columnOffset = 0;
    let columnOffsetForLine = -1;
    sourceMapConsumer.eachMapping(mapping => {
      if (nextReplacementMarker) {
        if ((mapping.generatedLine > nextReplacementMarker.loc.start.line ||
            (mapping.generatedLine === nextReplacementMarker.loc.start.line &&
                mapping.generatedColumn >= nextReplacementMarker.loc.start.column)) &&
            (mapping.generatedLine < nextReplacementMarker.loc.end.line ||
                (mapping.generatedLine === nextReplacementMarker.loc.end.line &&
                    mapping.generatedColumn < nextReplacementMarker.loc.end.column))) {
          return;
        }
        if (mapping.generatedLine > nextReplacementMarker.loc.end.line ||
            (mapping.generatedLine === nextReplacementMarker.loc.end.line &&
                mapping.generatedColumn > nextReplacementMarker.loc.end.column)) {
          lineOffset -= nextReplacementMarker.loc.end.line - nextReplacementMarker.loc.start.line;
          if (nextReplacementMarker.loc.start.line === columnOffsetForLine &&
              nextReplacementMarker.loc.end.line === columnOffsetForLine) {
            columnOffsetForLine -= nextReplacementMarker.loc.end.column - nextReplacementMarker.loc.start.column;
          } else {
            columnOffsetForLine = nextReplacementMarker.loc.end.line;
            columnOffset = -nextReplacementMarker.loc.end.column;
            if (nextReplacementMarker.loc.start.line = nextReplacementMarker.loc.end.line) {
              columnOffset += nextReplacementMarker.loc.start.column;
            }
          }
          currentReplacementMarkerIndex++;
          nextReplacementMarker = replacementLocs[currentReplacementMarkerIndex];
        }
      }

      const newMapping = generatedMappingFromConsumerMapping(mapping);
      if (newMapping.generated) {
        if (newMapping.generated.line === columnOffsetForLine) {
          newMapping.generated.column += columnOffset;
        }
        newMapping.generated.line += lineOffset;
      }
      sourceMapGenerator.addMapping(newMapping);
    });
    sourceMapConsumer.sources.forEach(sourcePath => {
      const sourceContent = sourceMapConsumer.sourceContentFor(sourcePath);
      if (sourceContent) {
        sourceMapGenerator.setSourceContent(sourcePath, sourceContent);
      }
    });
    newSourceMap = sourceMapGenerator.toJSON();
  }
  return {
    contents: newFileContents,
    sourceMap: newSourceMap
  };
};