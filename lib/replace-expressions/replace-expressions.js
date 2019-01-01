'use strict';
const FindReplacements = require('./find-replacements');
const Uri = require('vscode-uri').default;

module.exports = function(template, renamedExpressions, url) {
  let foundReplacements = new FindReplacements(renamedExpressions);
  const replacements = foundReplacements.replacementsPerFile.get(Uri.file(url).toString());
  if (!replacements) {
    return template;
  }

  // Replace the expressions in reverse order since each replacement could
  // change the file length
  replacements.sort((a, b) => b.start - a.start);
  replacements.forEach(replacement => {
    replacements;
    template = template.substr(0, replacement.start) +
        replacement.value +
        template.substr(replacement.end);
  });

  return template;
};
