'use strict';
const findReplacements = require('./find-replacements');

module.exports = function(template, renamedExpressions) {
  let foundReplacements = new findReplacements(renamedExpressions);

  // Replace the expressions in reverse order since each replacement could
  // change the file length
  for (let i = foundReplacements.replacements.length - 1; i >= 0; i--) {
    template = template.substr(0, foundReplacements.replacements[i].start)
        + foundReplacements.replacements[i].value
        + template.substr(foundReplacements.replacements[i].end);
  }

  return template;
};
