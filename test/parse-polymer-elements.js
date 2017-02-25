'use strict';
const expect = require('chai').expect;
const parsePolymerElements = require('../lib/extract-expressions/parse-polymer-elements');
const {File} = require('gulp-util');

describe('parse polymer elements', function() {
  this.slow(100);
  function createHtml(tagName, templateContent, properties) {
    let propString = '';
    if (properties) {
      for (let propName in properties) {
        if (properties.hasOwnProperty(propName)) {
          propString += `,\n      ${propName}: ${properties[propName]}`;
        }
      }
    }

    return`<dom-module id="${tagName}">
  <template>${templateContent}</template>
  <script>
    Polymer({
      is: '${tagName}'${propString}
    });
  </script>
</dom-module>`;
  }

  function getPolymerElementInfo(tagName, templateContent, properties, customLookupFunction) {
    let html = createHtml(tagName, templateContent, properties);
    return parsePolymerElements(customLookupFunction, process.cwd(), new File({
      path: '/test.html',
      contents: Buffer.from(html, 'utf8')
    }));
  }

  describe('element property data binding expressions', function() {
    it('basic usage', function () {
      return getPolymerElementInfo('foo-bar', '<div data-foo="{{bar}}"></div>', {bar: true})
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(55, 58, this.bar);
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });

    it('custom type lookup function', function () {
      return getPolymerElementInfo('foo-bar', '<div data-foo="{{bar}}"></div>', {bar: true},
          tagName => tagName.toUpperCase().replace(/-/g, '_'))
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FOO_BAR} */ function() {
  polymerRename.identifier(55, 58, this.bar);
  {
    let polymerRename_DIV = /** @type {!DIV} */(document.createElement('div'));
    polymerRename_DIV.dataFoo = this.bar;
    this.bar = polymerRename_DIV.dataFoo;
  }
}).call(/** @type {!FOO_BAR} */ (document.createElement("foo-bar")))\n`);
        });
    });

    it('binding to custom element', function () {
      const elementDefintions = createHtml('foo-baz', '', {dataFoo: true}) + '\n' +
          createHtml('foo-bar', '<foo-baz data-foo="{{bar}}"></foo-baz>', {bar: true});

      return parsePolymerElements(undefined, process.cwd(), new File({
        path: '/test.html',
        contents: Buffer.from(elementDefintions, 'utf8')
      }))
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  {
    let polymerRename_foo_bazElement = /** @type {!FooBazElement} */ (document.createElement('foo-baz'));
    polymerRename.attribute(197, 205, polymerRename_foo_bazElement, polymerRename_foo_bazElement.dataFoo);
  }
  polymerRename.identifier(209, 212, this.bar);
  {
    let polymerRename_FooBazElement = /** @type {!FooBazElement} */(document.createElement('foo-baz'));
    polymerRename_FooBazElement.dataFoo = this.bar;
    this.bar = polymerRename_FooBazElement.dataFoo;
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });

    it('computed property', function () {
      return getPolymerElementInfo('foo-bar',
          '<div data-foo="{{lookup(bar, foo , foobar)}}"></div>',
          {bar: true, foo: true, foobar: true, lookup: 'function(a, b, c) {}'})
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(62, 65, this.bar);
  polymerRename.identifier(67, 70, this.foo);
  polymerRename.identifier(73, 79, this.foobar);
  this.lookup(this.bar, this.foo, this.foobar);
  polymerRename.method(55, 61, this.lookup);
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });

    it('event listener', function () {
      return getPolymerElementInfo('foo-bar', '<div on-foo="bar"></div>', {bar: 'function() {}'})
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  this.bar(new Event("event"));
  polymerRename.eventListener(51, 54, this.bar);
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });

    it('whitespace in expression', function () {
      return getPolymerElementInfo('foo-bar', '<div data-foo="{{ bar }}">[[  lookup( foobar ) ]]</div>',
          {bar: true, foobar: true, lookup: 'function(a) {}'})
        .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(56, 59, this.bar);
  polymerRename.identifier(76, 82, this.foobar);
  this.lookup(this.foobar);
  polymerRename.method(68, 74, this.lookup);
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });
  });

  describe('expressions within element text content', function() {
    it('basic usage', function () {
      return getPolymerElementInfo('foo-bar', '<div>prop [[bar]] {{baz}} prop</div>',
          {bar: true, baz: true})
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(50, 53, this.bar);
  polymerRename.identifier(58, 61, this.baz);
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });

    it('computed property with literals', function () {
      return getPolymerElementInfo('foo-bar',
          `<div>[[lookup('foo', "bar", foobar, -0.47, +0.47, 0.47, -.47, +.47, .47, 47)]]</div>`,
          {foobar: true, lookup: 'function() {}'})
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(66, 72, this.foobar);
  this.lookup('foo', "bar", this.foobar, -0.47, +0.47, 0.47, -.47, +.47, .47, 47);
  polymerRename.method(45, 51, this.lookup);
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });
  });

  describe('dom-repeat', () => {
    it('basic usage', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]'})
          .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(82, 90, item.foo, item, 'item');
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
          });
    });

    it('item alias', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" as="foobar">[[foobar.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]'})
          .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let index = 0; index < this.bar.length; index++) {
    let foobar = this.bar[index];
    polymerRename.identifier(84, 90, foobar);
    polymerRename.identifier(94, 104, foobar.foo);
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
          });
    });

    it('index alias', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" index-as="count">[[item.foo]] - [[count]]</template>',
          {bar: '[{foo: bar}]'})
          .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let count = 0; count < this.bar.length; count++) {
    let item = this.bar[count];
    polymerRename.identifier(90, 95, count);
    polymerRename.identifier(99, 107, item.foo, item, 'item');
    polymerRename.identifier(114, 119, count);
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
          });
    });
    it('nested', function () {
      return getPolymerElementInfo('foo-bar',
          `<template is="dom-repeat" items="{{bar}}" as="outerItem" index-as="outerIndex">
            {{outerItem}}
            <template is="dom-repeat" items="{{outerItem}}">
              <template is="dom-repeat" items="{{item}}" as="innerItem" index-as="innerIndex">
                [[outerItem.length]] [[outerIndex]] [[item.length]] [[index]] [[innerItem]] [[innerIndex]] [[foobar]]
              </template>
            </template>
          </template>`,
          {bar: '[[[{foo: bar}]]]', foobar: true})
        .then(output => {
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let outerIndex = 0; outerIndex < this.bar.length; outerIndex++) {
    let outerItem = this.bar[outerIndex];
    polymerRename.identifier(84, 93, outerItem);
    polymerRename.identifier(105, 115, outerIndex);
    polymerRename.identifier(132, 141, outerItem);
    polymerRename.identifier(191, 200, outerItem);
    for (let index = 0; index < outerItem.length; index++) {
      let item = outerItem[index];
      for (let innerIndex = 0; innerIndex < item.length; innerIndex++) {
        let innerItem = item[innerIndex];
        polymerRename.identifier(266, 275, innerItem);
        polymerRename.identifier(287, 297, innerIndex);
        polymerRename.identifier(318, 334, outerItem.length);
        polymerRename.identifier(339, 349, outerIndex);
        polymerRename.identifier(354, 365, item.length);
        polymerRename.identifier(380, 389, innerItem);
        polymerRename.identifier(394, 404, innerIndex);
        polymerRename.identifier(409, 415, this.foobar);
      }
    }
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
        });
    });

    it('sort', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" sort="arrange">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', arrange: 'function() {}'})
          .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  polymerRename.identifier(86, 93, this.arrange);
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(97, 105, item.foo, item, 'item');
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
          });
    });

    it('computed sort', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" sort="[[arrange(bar, bar)]]">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', arrange: 'function() {}'})
          .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  polymerRename.identifier(96, 99, this.bar);
  polymerRename.identifier(101, 104, this.bar);
  this.arrange(this.bar, this.bar);
  polymerRename.method(88, 95, this.arrange);
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(111, 119, item.foo, item, 'item');
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
          });
    });

    it('filter', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" filter="arrange">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', arrange: 'function() {}'})
          .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  polymerRename.identifier(88, 95, this.arrange);
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(99, 107, item.foo, item, 'item');
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
          });
    });

    it('computed filter', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" filter="[[arrange(bar, bar)]]">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', arrange: 'function() {}'})
          .then(output => {
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

(/** @this {FooBarElement} */ function() {
  polymerRename.identifier(73, 76, this.bar);
  polymerRename.identifier(98, 101, this.bar);
  polymerRename.identifier(103, 106, this.bar);
  this.arrange(this.bar, this.bar);
  polymerRename.method(90, 97, this.arrange);
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(113, 121, item.foo, item, 'item');
  }
}).call(/** @type {!FooBarElement} */ (document.createElement("foo-bar")))\n`);
          });
    });
  });
});
