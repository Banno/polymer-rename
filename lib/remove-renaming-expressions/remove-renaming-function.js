'use strict';

const acorn = require('acorn');
const walk = require('acorn-walk');
const StringReplaceSourceMap = require('string-replace-source-map');

function isValidRenameTemplateExpression(expression) {
  if (!(expression.type === 'CallExpression' &&
      expression.callee.type === 'MemberExpression' &&
      expression.callee.object.type === 'Identifier' &&
      expression.callee.object.name === 'polymerRename' &&
      expression.callee.property.type === 'Identifier' &&
      expression.callee.property.name === 'createTemplateFromString' &&
      expression.arguments.length === 1)) {
    return false;
  }
  const callArg = expression.arguments[0];
  if (callArg.type === 'Literal') {
    return true;
  }
  if (!(callArg.type === 'CallExpression' &&
      callArg.callee.type === 'MemberExpression' &&
      callArg.callee.object.type === 'Literal' &&
      callArg.callee.property.type === 'Identifier' &&
      callArg.callee.property.name === 'replace' &&
      callArg.arguments.length === 2 &&
      callArg.arguments[0].type === 'Literal' &&
      callArg.arguments[0].raw === '/[A-Z]/g')) {
    return false;
  }
  const replaceCallback = callArg.arguments[1];
  if (!(replaceCallback.type === 'ArrowFunctionExpression' &&
      replaceCallback.params.length === 1 &&
      replaceCallback.body.type === 'BinaryExpression' &&
      replaceCallback.body.left.type === 'Literal' &&
      replaceCallback.body.left.value === '-' &&
      replaceCallback.body.operator === '+' &&
      replaceCallback.body.right.type === 'CallExpression' &&
      replaceCallback.body.right.callee.object.type === 'Identifier' &&
      replaceCallback.body.right.callee.property.type === 'Identifier' &&
      replaceCallback.body.right.callee.property.name === 'toLowerCase')) {
    return false;
  }
  return true;
}

module.exports = async function(fileContents, sourceMap) {
  const ast = acorn.Parser.parse(fileContents, {
    ecmaVersion: 2020,
    sourceType: 'module',
    locations: true,
    ranges: true
  });
  let polymerRenameStatements = [];
  let templateLiterals = [];
  walk.simple(ast, {
    ExpressionStatement(statement) {
      if (statement.expression.type === 'CallExpression' &&
          statement.expression.callee.type === 'MemberExpression' &&
          statement.expression.callee.object.type === 'Identifier' &&
          statement.expression.callee.object.name === 'polymerRename' &&
          statement.expression.callee.property.type === 'Identifier' &&
          statement.expression.callee.property.name === 'typeCheckStatements') {
        polymerRenameStatements.push(statement);
      }
    },
    TemplateLiteral(template) {
      if (template.expressions.find(isValidRenameTemplateExpression)) {
        templateLiterals.push(template);
      }
    }
  });

  if (polymerRenameStatements.length === 0 && templateLiterals.length === 0) {
    return {
      contents: fileContents,
      sourceMap: sourceMap
    };
  }
  let newFileContents = new StringReplaceSourceMap(fileContents, sourceMap);
  for (let i = polymerRenameStatements.length - 1; i >= 0; i--) {
    newFileContents.replace(polymerRenameStatements[i].range[0], polymerRenameStatements[i].range[1], '');
  }
  for (let i = templateLiterals.length - 1; i >= 0; i--) {
    for (let j = templateLiterals[i].expressions.length - 1; j >= 0; j--) {
      if (!isValidRenameTemplateExpression(templateLiterals[i].expressions[j])) {
        continue;
      }
      const arg0 = templateLiterals[i].expressions[j].arguments[0];
      let replacementValue = '';
      if (arg0.type === 'Literal') {
        replacementValue = arg0.value;
      } else {
        replacementValue =
            arg0.callee.object.value.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
      }
      newFileContents.replace(templateLiterals[i].quasis[j].end, templateLiterals[i].quasis[j + 1].start, replacementValue);
    }
  }
  return {
    contents: newFileContents.toString(),
    sourceMap: await newFileContents.generateSourceMap()
  };
};
