'use strict';

const esprima = require('esprima');
const walk = require( 'esprima-walk' );
const StringReplaceSourceMap = require('string-replace-source-map');

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

  if (polymerRenameStatements.length === 0) {
    return {
      contents: fileContents,
      sourceMap: sourceMap
    };
  }
  let newFileContents = new StringReplaceSourceMap(fileContents, sourceMap);
  for (let i = polymerRenameStatements.length - 1; i >= 0; i--) {
    newFileContents.replace(polymerRenameStatements[i].range[0], polymerRenameStatements[i].range[1], '');
  }
  return {
    contents: newFileContents.toString(),
    sourceMap: await newFileContents.generateSourceMap()
  };
};
