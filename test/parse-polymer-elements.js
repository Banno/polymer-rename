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

    const def = `<dom-module id="${tagName}">
  <template>${templateContent}</template>
  <script>
    Polymer({
      is: '${tagName}'${propString}
    });
  </script>
</dom-module>`;
    return def;
  }

  function getPolymerElementInfo(tagName, templateContent, properties, customLookupFunction) {
    let html = createHtml(tagName, templateContent, properties);
    return parsePolymerElements(process.cwd(), new File({
      path: '/test.html',
      contents: Buffer.from(html, 'utf8')
    }));
  }

  describe('element property data binding expressions', function() {
    it('basic usage', function () {
      return getPolymerElementInfo('foo-bar', '<div data-foo="{{bar}}"></div>', {bar: true})
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(55, 58, this.bar);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('binding to custom element', function () {
      const elementDefintions = createHtml('foo-baz', '', {dataFoo: true}) + '\n' +
          createHtml('foo-bar', '<foo-baz data-foo="{{bar}}"></foo-baz>', {bar: true});

      return parsePolymerElements(process.cwd(), new File({
        path: '/test.html',
        contents: Buffer.from(elementDefintions, 'utf8')
      }))
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  {
    let polymerRename_foo_bazElement = /** @type {!FooBazElement} */ (polymerRename.createElement('foo-baz'));
    polymerRename.attribute(197, 205, polymerRename_foo_bazElement, polymerRename_foo_bazElement.dataFoo);
  }
  polymerRename.identifier(209, 212, this.bar);
  {
    let polymerRename_FooBazElement = /** @type {!FooBazElement} */(polymerRename.createElement('foo-baz'));
    polymerRename_FooBazElement.dataFoo = this.bar;
    this.bar = polymerRename_FooBazElement.dataFoo;
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('computed property', function () {
      return getPolymerElementInfo('foo-bar',
          '<div data-foo="{{lookup(bar, foo , foobar)}}"></div>',
          {bar: true, foo: true, foobar: true, lookup: 'function(a, b, c) {}'})
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  this.lookup(this.bar, this.foo, this.foobar);
  polymerRename.method(55, 61, this.lookup);
  polymerRename.identifier(62, 65, this.bar);
  polymerRename.identifier(67, 70, this.foo);
  polymerRename.identifier(73, 79, this.foobar);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('event listener', function () {
      return getPolymerElementInfo('foo-bar', '<div on-foo="bar"></div>', {bar: 'function() {}'})
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  this.bar(new CustomEvent("event"));
  polymerRename.eventListener(51, 54, this.bar);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('change notification event listener', function () {
      const elementDefintions = createHtml('foo-baz', '', {properties: '{foo: { type: boolean, notify: true}}'}) +
          '\n' + createHtml('foo-bar', '<foo-baz on-foo-changed="bar"></foo-baz>', {bar: 'function(a) {}'});

      return parsePolymerElements(process.cwd(), new File({
          path: '/test.html',
          contents: Buffer.from(elementDefintions, 'utf8')
        }))
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  this.bar(new CustomEvent("event"));
  polymerRename.eventListener(249, 252, this.bar);
  {
    let polymerRename_foo_bazElement = /** @type {!FooBazElement} */ (polymerRename.createElement('foo-baz'));
    polymerRename.attribute(236, 239, polymerRename_foo_bazElement, polymerRename_foo_bazElement.foo);
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('splices paths', function () {
      return getPolymerElementInfo('foo-bar', '<div data-foo="{{bar.splices}}">[[lookup(foobar.splices)]]</div>',
          {bar: 'Array', foobar: 'Array', lookup: 'function(a) {}'})
        .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(55, 58, this.bar);
  this.lookup(this.foobar);
  polymerRename.method(72, 78, this.lookup);
  polymerRename.identifier(79, 85, this.foobar);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('wildcard paths', function () {
      return getPolymerElementInfo('foo-bar', '<div data-foo="{{bar.*}}">[[lookup(foobar.*)]]</div>',
          {bar: 'Object', foobar: 'Object', lookup: 'function(a) {}'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(55, 58, this.bar);
  this.lookup(this.foobar);
  polymerRename.method(66, 72, this.lookup);
  polymerRename.identifier(73, 79, this.foobar);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('whitespace in expression', function () {
      return getPolymerElementInfo('foo-bar', '<div data-foo="{{ bar }}">[[  lookup( foobar ) ]]</div>',
          {bar: true, foobar: true, lookup: 'function(a) {}'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(56, 59, this.bar);
  this.lookup(this.foobar);
  polymerRename.method(68, 74, this.lookup);
  polymerRename.identifier(76, 82, this.foobar);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });
  });

  describe('expressions within element text content', function() {
    it('basic usage', function () {
      return getPolymerElementInfo('foo-bar', '<div>prop [[bar]] {{baz}} prop</div>',
          {bar: true, baz: true})
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(50, 53, this.bar);
  polymerRename.identifier(58, 61, this.baz);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('computed property with literals', function () {
      return getPolymerElementInfo('foo-bar',
          `<div>[[lookup('foo', "bar", foobar, -0.47, +0.47, 0.47, -.47, +.47, .47, 47)]]</div>`,
          {foobar: true, lookup: 'function() {}'})
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  this.lookup('foo', "bar", this.foobar, -0.47, +0.47, 0.47, -.47, +.47, .47, 47);
  polymerRename.method(45, 51, this.lookup);
  polymerRename.identifier(66, 72, this.foobar);
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });
  });

  describe('dom-repeat', () => {
    it('basic usage', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(82, 90, item.foo, item, 'item');
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('item alias', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" as="foobar">[[foobar.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let index = 0; index < this.bar.length; index++) {
    let foobar = this.bar[index];
    polymerRename.identifier(84, 90, foobar);
    polymerRename.identifier(94, 104, foobar.foo);
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('index alias', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" index-as="count">[[item.foo]] - [[count]]</template>',
          {bar: '[{foo: bar}]'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let count = 0; count < this.bar.length; count++) {
    let item = this.bar[count];
    polymerRename.identifier(90, 95, count);
    polymerRename.identifier(99, 107, item.foo, item, 'item');
    polymerRename.identifier(114, 119, count);
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
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
        .then(results => {
          const {output} = results;
          expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
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
        polymerRename.identifier(354, 365, item.length, item, 'item');
        polymerRename.identifier(380, 389, innerItem);
        polymerRename.identifier(394, 404, innerIndex);
        polymerRename.identifier(409, 415, this.foobar);
      }
    }
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
          expect(results.warnings.length).to.be.equal(0);
        });
    });

    it('sort', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" sort="arrange">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', arrange: 'function() {}'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  polymerRename.identifier(86, 93, this.arrange);
  polymerRename.domRepeatSort(this.arrange(this.bar[0], this.bar[1]));
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(97, 105, item.foo, item, 'item');
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('computed sort', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" sort="[[arrange(bar, bar)]]">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', arrange: 'function() {}'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  this.arrange(this.bar, this.bar);
  polymerRename.method(88, 95, this.arrange);
  polymerRename.identifier(96, 99, this.bar);
  polymerRename.identifier(101, 104, this.bar);
  polymerRename.domRepeatSort(this.arrange(this.bar, this.bar)(this.bar[0], this.bar[1]));
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(111, 119, item.foo, item, 'item');
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('filter', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" filter="winnow">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', winnow: 'function() {}'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  polymerRename.identifier(88, 94, this.winnow);
  polymerRename.domRepeatFilter(this.winnow(this.bar[0]));
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(98, 106, item.foo, item, 'item');
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('computed filter', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" filter="[[winnow(bar, bar)]]">[[item.foo]] - [[index]]</template>',
          {bar: '[{foo: bar}]', winnow: 'function() {}'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  this.winnow(this.bar, this.bar);
  polymerRename.method(90, 96, this.winnow);
  polymerRename.identifier(97, 100, this.bar);
  polymerRename.identifier(102, 105, this.bar);
  polymerRename.domRepeatFilter(this.winnow(this.bar, this.bar)(this.bar[0]));
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.identifier(112, 120, item.foo, item, 'item');
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('observers', function () {
      return getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="[[bar]]" observe="prop1 prop2 prop3.prop4">[[item.prop1]]</template>',
          {bar: '[{prop1: true, prop2: true, prop3: {prop4: true}}]'})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(73, 76, this.bar);
  for (let index = 0; index < this.bar.length; index++) {
    let item = this.bar[index];
    polymerRename.domRepeatObserve(89, 94, item.prop1, item, 'item');
    polymerRename.domRepeatObserve(95, 100, item.prop2, item, 'item');
    polymerRename.domRepeatObserve(101, 112, item.prop3.prop4, item, 'item');
    polymerRename.identifier(116, 126, item.prop1, item, 'item');
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });

    it('shadowing', function () {
      return getPolymerElementInfo('foo-bar',
          `{{foobar}}<template is="dom-repeat" items="{{bar}}" as="foobar">{{foobar}}</template>`,
          {bar: '["item"]', foobar: true})
          .then(results => {
            const {output} = results;
            expect(output).to.be.equal(`// This file was autogenerated by polymer-rename. Do not edit.

{
  /** @this {FooBarElement} @suppress {visibility} */ let renameFn = function() {
  polymerRename.identifier(40, 46, this.foobar);
  polymerRename.identifier(83, 86, this.bar);
  for (let index = 0; index < this.bar.length; index++) {
    let foobar = this.bar[index];
    polymerRename.identifier(94, 100, foobar);
    polymerRename.identifier(104, 110, foobar);
  }
  };
  polymerRename.sink(renameFn);
  renameFn.call(/** @type {!FooBarElement} */ (polymerRename.createElement("foo-bar")));
}\n`);
            expect(results.warnings.length).to.be.equal(0);
          });
    });
  });
});
