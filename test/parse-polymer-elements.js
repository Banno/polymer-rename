'use strict';
const expect = require('chai').expect;
const parsePolymerElements = require('../lib/extract-expressions/parse-polymer-elements');

describe('parse polymer elements', function() {
  function getPolymerElementInfo(tagName, templateContent, customLookupFunction) {
    let html = `<dom-module id="${tagName}">
  <template>${templateContent}</template>
</dom-module>`;
    return parsePolymerElements(html, customLookupFunction);
  }
  it('basic', function () {
    let output = getPolymerElementInfo('foo-bar', '<div data-foo="{{bar}}"></div>');
    expect(output).to.be.equal(`(/** @this {FooBarElement} */ function() {
polymerRename.symbol(55, 58, this.bar);
}).call(/** @type {FooBarElement} */ (document.createElement("foo-bar")))\n`);
  });

  it('custom type lookup function', function () {
    let output = getPolymerElementInfo('foo-bar', '<div data-foo="{{bar}}"></div>',
            tagName => tagName.toUpperCase().replace(/-/g, '_'));
    expect(output).to.be.equal(`(/** @this {FOO_BAR} */ function() {
{
  let polymerRename_divElement = /** @type {DIV} */(document.createElement('div'));
  polymerRename_divElement.dataFoo = this.bar;
  this.bar = polymerRename_divElement.dataFoo;
}
polymerRename.symbol(55, 58, this.bar);
}).call(/** @type {FOO_BAR} */ (document.createElement("foo-bar")))\n`);
  });
});
