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
    const replacementInfo = {
      range: polymerRenameStatements[i].range,
      loc: polymerRenameStatements[i].loc,
    };
    replacementLocs.unshift(replacementInfo);
  }
  replacementLocs.sort((a, b) => a.range[0] - b.range[0]);
  replacementLocs.forEach((replacementInfo, i) => {
    const lastReplacement = replacementLocs[i - 1];
    const lineOffset = replacementInfo.loc.start.line - replacementInfo.loc.end.line;
    const columnOffset = lineOffset !== 0 ?
        -replacementInfo.loc.end.column - 1 :
        replacementInfo.loc.start.column - replacementInfo.loc.end.column - 1;
    if (lastReplacement) {
      replacementInfo.lineOffset = lastReplacement.lineOffset + lineOffset;
      if (lastReplacement.loc.end.line === replacementInfo.loc.end.line) {
        replacementInfo.columnOffset = lastReplacement.columnOffset + columnOffset;
      } else {
        replacementInfo.columnOffset = columnOffset;
      }
    } else {
      replacementInfo.lineOffset = lineOffset;
      replacementInfo.columnOffset = columnOffset;
    }
  });
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
    let currentReplacementMarkerIndex = -1;
    let nextReplacementMarker = replacementLocs[0];
    sourceMapConsumer.eachMapping(mapping => {
      if (nextReplacementMarker) {
        if ((mapping.generatedLine > nextReplacementMarker.loc.start.line ||
            (mapping.generatedLine === nextReplacementMarker.loc.start.line &&
                mapping.generatedColumn >= nextReplacementMarker.loc.start.column)) &&
            (mapping.generatedLine < nextReplacementMarker.loc.end.line ||
                (mapping.generatedLine === nextReplacementMarker.loc.end.line &&
                    mapping.generatedColumn <= nextReplacementMarker.loc.end.column))) {
          return;
        }
        if (mapping.generatedLine > nextReplacementMarker.loc.end.line ||
            (mapping.generatedLine === nextReplacementMarker.loc.end.line &&
                mapping.generatedColumn > nextReplacementMarker.loc.end.column)) {
          currentReplacementMarkerIndex++;
          nextReplacementMarker = replacementLocs[currentReplacementMarkerIndex + 1];
        }
      }

      const newMapping = generatedMappingFromConsumerMapping(mapping);
      if (newMapping.generated && replacementLocs[currentReplacementMarkerIndex]) {
        if (newMapping.generated.line === replacementLocs[currentReplacementMarkerIndex].loc.end.line &&
            newMapping.generated.column > replacementLocs[currentReplacementMarkerIndex].loc.end.column) {
          newMapping.generated.column += replacementLocs[currentReplacementMarkerIndex].columnOffset;
        }
        newMapping.generated.line += replacementLocs[currentReplacementMarkerIndex].lineOffset;
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
