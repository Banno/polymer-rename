'use strict';
const PolymerTemplateExpressions = require('./polymer-template-expressions');
const path = require('path');
const Analyzer = require('polymer-analyzer').Analyzer;
const {InMemoryOverlayUrlLoader} = require('polymer-analyzer/lib/url-loader/overlay-loader');
const Uri = require('vscode-uri').default;

const ignoredWarnings = new Set([
  'could-not-resolve-reference',
  'unanalyzable-polymer-expression',
  'overriding-private'
]);

class RestrictedInMemoryOverlayUrlLoader extends InMemoryOverlayUrlLoader {
  constructor(fallbackLoader) {
    super(fallbackLoader);
  }

  load(url) {
    if (!this.urlContentsMap.has(url)) {
      return Promise.resolve('');
    }
    return super.load(url);
  }
}

/**
 * Main entry point for the phase 1 extraction - analyzes Polymer HTML
 * and JS files, extracts all data binding and HTML code references and
 * returns JS to be provided to Closure-Compiler for type checking and
 * renaming.
 *
 * @param {{
 *    projectRoot: string|undefined,
 *    excludedPaths: Array<string>|undefined
 *  }} options
 * @param {...(string|Vinyl)} files - either path names or Vinyl files
 * @return {!Promise<!{
 *    output: string,
 *    warnings: !Array<string>
 *  }>} Object with JS code for compilation and an Array of warnings
 */
function parsePolymerElements(options, ...files) {
  let projectRoot = path.resolve(options.projectRoot || process.cwd());
  const loader = new RestrictedInMemoryOverlayUrlLoader();

  const warnings = [];
  const exludedPaths = options.excludedPaths || [];

  const filePaths = files.map(file => {
    let filePath = file.relative || file.path || path.relative(projectRoot, file);
    let fileContents;

    const excludedPath = exludedPaths.find(exludePrefix => filePath.startsWith(exludePrefix));
    if (excludedPath) {
      return;
    }
    if (!/^(\/|\.)/.test(filePath)) {
      filePath = `${projectRoot}/${filePath}`;
    }
    fileContents = file.contents ? file.contents.toString() : undefined;
    filePath = Uri.file(filePath).toString();
    loader.urlContentsMap.set(filePath, fileContents || '');
    return filePath;
  }).filter(filePath => Boolean(filePath));

  const analyzer = new Analyzer({
    urlLoader: loader
  });

  return analyzer.analyze(filePaths)
      .then(analysis => {
        const allFeatures = new Set();
        analysis._results.forEach(feature => {
          if (feature.getFeatures) {
            if (allFeatures.has(feature)) {
              return;
            }
            allFeatures.add(feature);// console.log(document);
            feature.getFeatures().forEach(subFeature => allFeatures.add(subFeature));
          } else {
            console.warn(feature.toString());
          }
        });
        return allFeatures;
      })
      .then(features => {
        const renameableElementProps = new Map();
        const inlineDocuments = new Map();
        features.forEach(feature => {
          if (feature.kinds.has('polymer-element') && feature.tagName) {
            if (renameableElementProps.has(feature.tagName)) {
              throw new Error(`Duplicate polymer element definition encountered for ${feature.tagName}.`);
            }

            renameableElementProps.set(
                feature.tagName,
                feature);

            feature.warnings.forEach(warning => {
              if (ignoredWarnings.has(warning.code)) {
                return;
              }
              warnings.push(feature.tagName + ' ' + warning.message + ' ' + warning.sourceRange.file + ' line ' +
                  warning.sourceRange.start.line + ' [' + warning.code + ']');
            });
          } else if (feature.kinds.has('html-document')) {
            const url = feature.astNode.containingDocument.url;
            let docs = inlineDocuments.get(url);
            if (!docs) {
              docs = [];
              inlineDocuments.set(url, docs);
            }
            docs.push(feature);
          }
        });

        const typeNamesByTagName = new Map();
        renameableElementProps.forEach((polymerElement, tagName) => {
          if (polymerElement.className) {
            typeNamesByTagName.set(polymerElement.tagName, polymerElement.className);
          }
        });

        typeNamesByTagName.set('dom-if', 'DomIf');
        typeNamesByTagName.set('dom-repeat', 'DomRepeat');

        const typeNameLookup = tagName => {
          const typeName = typeNamesByTagName.get(tagName);
          if (typeName) {
            return typeName;
          }

          if (tagName.indexOf('-') > 0) {
            return PolymerTemplateExpressions.defaultTypeNameForTag(tagName);
          }
          return undefined;
        };
        let moduleCounter = 1;
        const featuresByUrl = new Map();
        renameableElementProps.forEach(polymerElement => {
          const {url} = polymerElement.astNode.containingDocument;
          const inlineDocsForFile = inlineDocuments.get(url) || [];

          inlineDocsForFile.forEach(inlineDocument => {
            let featureSetForUrl = featuresByUrl.get(url);
            if (!featureSetForUrl) {
              featureSetForUrl = {
                templates: new Set()
              };
              featuresByUrl.set(url, featureSetForUrl);
            }
            featureSetForUrl.templates.add(
                new PolymerTemplateExpressions(
                    inlineDocument, polymerElement.tagName, renameableElementProps, typeNameLookup, moduleCounter.toString()));
          });
        });
        featuresByUrl.forEach((features, url) => {
          const renamingStatements = [];
          let output = [
            "polymerRename.typeCheckStatements(function() {"
          ];
          features.templates.forEach(elem => {
            elem.warnings.forEach(warning => warnings.push(warning));

            if (elem.subExpressions.length === 0) {
              return;
            }
            output.push(`{`, `  /** @this {${elem.typeName}} @suppress {visibility} */ let renameFn = function() {`);
            output.push(outputPolymerExpr(elem, '', renamingStatements));
            output.push(`  };`, `  polymerRename.sink(renameFn);`);
            output.push(`  renameFn.call(` +
                `/** @type {!${elem.typeName}} */ (polymerRename.createElement("${elem.tagName}")));`);
            output.push(`}`);
          });
          output.push('});');
          features.output = output.join('\n') + '\n';
          features.renameExpressions = renamingStatements;
        });

        return {
          features: featuresByUrl,
          warnings
        };
      })
      .catch(err => {
        console.error(err);
      });
}

/**
 * Helper function to convert extracted expressions to properly formatted JS.
 * Recursively walk the expression tree and return a JS string.
 *
 * @param {Object} expression starting point
 * @param {string} indent whitespace to use for each indent level
 * @param {!Array} renamingStatements
 * @return {string} indented JS
 */
function outputPolymerExpr(expression, indent, renamingStatements) {
  const output = [];
  if (!(expression instanceof PolymerTemplateExpressions)) {
    const str = expression.toString(indent);
    if (str.length > 0) {
      output.push(str);
    }
    if (expression.getRenamingStatement && expression.url && expression.start >= 0 && expression.getRenamingStatement()) {
      renamingStatements.push({
        url: expression.url,
        start: expression.start,
        end: expression.end,
        expression: expression.getRenamingStatement()
      });
    }
  }
  if (expression.subExpressions) {
    expression.subExpressions.forEach(item => {
      const str = outputPolymerExpr(item, indent + '  ', renamingStatements);
      if (str.length > 0) {
        output.push(str);
      }
    });
  }

  if (!(expression instanceof PolymerTemplateExpressions) && expression.subExpressions) {
    const str = expression.toClosingString(indent);
    if (str.length > 0) {
      output.push(str);
    }
  }
  return output.join('\n');
}

module.exports = parsePolymerElements;
