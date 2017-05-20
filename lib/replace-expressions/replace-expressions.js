'use strict';
const FindReplacements = require('./find-replacements');

module.exports = function(template, renamedExpressions) {
  let foundReplacements = new FindReplacements(renamedExpressions);

  // Replace the expressions in reverse order since each replacement could
  // change the file length
  for (let i = foundReplacements.replacements.length - 1; i >= 0; i--) {
    template = template.substr(0, foundReplacements.replacements[i].start) +
        foundReplacements.replacements[i].value +
        template.substr(foundReplacements.replacements[i].end);

    if (foundReplacements.replacements[i].start === 21648) {
      console.error(template.substring(foundReplacements.replacements[i].start - 20,
          foundReplacements.replacements[i].end + 20));
      console.error(`'${foundReplacements.replacements[i].value}'`,
          template.substring(foundReplacements.replacements[i].start, foundReplacements.replacements[i].end + 1) +
          '\'');
    }
  }

  return template;
};
