'use strict';
const expect = require('chai').expect;
let parse5 = require('parse5');
const parsePolymerElements = require('../lib/extract-expressions/parse-polymer-elements');
const PolymerElementInfo = require('../lib/extract-expressions/polymer-element-info');
const symbolExpr = require('../lib/extract-expressions/expressions/symbol');
const methodExpr = require('../lib/extract-expressions/expressions/method');
const eventListenerExpr = require('../lib/extract-expressions/expressions/event-listener');
const domRepeatExpr = require('../lib/extract-expressions/expressions/dom-repeat');
const domRepeatNonRenameableExpr = require('../lib/extract-expressions/expressions/dom-repeat-non-renameable');


describe('Polymer Element Info', function() {
  function getPolymerElementInfo(tagName, templateContent) {
    let html = `<dom-module id="${tagName}">
  <template>${templateContent}</template>
</dom-module>`;
    let document = parse5.parse(html, {locationInfo: true});
    return parsePolymerElements.walk(document, html);
  }

  describe('element property data binding expressions', function() {
    it('basic usage', function () {
      let element = getPolymerElementInfo('foo-bar', '<div data-foo="{{bar}}"></div>')[0];
      expect(element.renameableItems.length).to.be.equal(1);
      expect(element.renameableItems[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[0].isElementProperty).to.be.true;
      expect(element.renameableItems[0].symbol).to.be.equal('bar');

      let start = element.documentHtmlString.indexOf('{{bar}}') + 2;
      let end = start + 3;

      expect(element.renameableItems[0].start).to.be.equal(start);
      expect(element.renameableItems[0].end).to.be.equal(end);
    });

    it('computed property', function () {
      let element = getPolymerElementInfo('foo-bar', '<div data-foo="{{lookup(bar, foo , foobar)}}"></div>')[0];
      expect(element.renameableItems.length).to.be.equal(1);
      expect(element.renameableItems[0]).to.be.an.instanceof(methodExpr);
      expect(element.renameableItems[0].methodName).to.be.equal('lookup');
      let start = element.documentHtmlString.indexOf('lookup');
      let end = start + 'lookup'.length;
      expect(element.renameableItems[0].start).to.be.equal(start);
      expect(element.renameableItems[0].end).to.be.equal(end);

      expect(element.renameableItems[0].args.length).to.be.equal(3);

      expect(element.renameableItems[0].args[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[0].args[0].isElementProperty).to.be.true;
      expect(element.renameableItems[0].args[0].symbol).to.be.equal('bar');
      start = element.documentHtmlString.indexOf('(bar') + 1;
      end = start + 3;
      expect(element.renameableItems[0].args[0].start).to.be.equal(start);
      expect(element.renameableItems[0].args[0].end).to.be.equal(end);

      expect(element.renameableItems[0].args[1]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[0].args[1].isElementProperty).to.be.true;
      expect(element.renameableItems[0].args[1].symbol).to.be.equal('foo');
      start = element.documentHtmlString.indexOf(', foo ,') + 2;
      end = start + 3;
      expect(element.renameableItems[0].args[1].start).to.be.equal(start);
      expect(element.renameableItems[0].args[1].end).to.be.equal(end);

      expect(element.renameableItems[0].args[2]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[0].args[2].isElementProperty).to.be.true;
      expect(element.renameableItems[0].args[2].symbol).to.be.equal('foobar');
      start = element.documentHtmlString.indexOf('foobar');
      end = start + 'foobar'.length;
      expect(element.renameableItems[0].args[2].start).to.be.equal(start);
      expect(element.renameableItems[0].args[2].end).to.be.equal(end);
    });

    it('event listeners', function () {
      let element = getPolymerElementInfo('foo-bar', '<div on-foo="bar"></div>')[0];
      expect(element.renameableItems.length).to.be.equal(1);
      expect(element.renameableItems[0]).to.be.an.instanceof(eventListenerExpr);
      expect(element.renameableItems[0].methodName).to.be.equal('bar');
      expect(element.renameableItems[0].args.length).to.be.equal(0);

      let start = element.documentHtmlString.indexOf('"bar"') + 1;
      let end = start + 3;

      expect(element.renameableItems[0].start).to.be.equal(start);
      expect(element.renameableItems[0].end).to.be.equal(end);
    });

    it('whitespace in expression', function () {
      let element = getPolymerElementInfo('foo-bar', '<div data-foo="{{ bar }}">[[  lookup( foobar ) ]]</div>')[0];
      expect(element.renameableItems.length).to.be.equal(2);

      let start = element.documentHtmlString.indexOf('{{ bar }}') + 3;
      let end = start + 3;
      expect(element.renameableItems[0].start).to.be.equal(start);
      expect(element.renameableItems[0].end).to.be.equal(end);

      start = element.documentHtmlString.indexOf('lookup');
      end = start + 'lookup'.length;
      expect(element.renameableItems[1].start).to.be.equal(start);
      expect(element.renameableItems[1].end).to.be.equal(end);

      expect(element.renameableItems[1].args.length).to.be.equal(1);
      start = element.documentHtmlString.indexOf('foobar');
      end = start + 'foobar'.length;
      expect(element.renameableItems[1].args[0].start).to.be.equal(start);
      expect(element.renameableItems[1].args[0].end).to.be.equal(end);
    });
  });

  describe('expressions within element text content', function() {
    it('basic usage', function () {
      let element = getPolymerElementInfo('foo-bar', '<div>prop [[bar]] {{baz}} prop</div>')[0];
      expect(element.renameableItems.length).to.be.equal(2);
      expect(element.renameableItems[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[0].isElementProperty).to.be.true;
      expect(element.renameableItems[0].symbol).to.be.equal('bar');

      let start = element.documentHtmlString.indexOf('[[bar]]') + 2;
      let end = start + 3;

      expect(element.renameableItems[0].start).to.be.equal(start);
      expect(element.renameableItems[0].end).to.be.equal(end);

      expect(element.renameableItems[1]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[1].isElementProperty).to.be.true;
      expect(element.renameableItems[1].symbol).to.be.equal('baz');

      start = element.documentHtmlString.indexOf('{{baz}}') + 2;
      end = start + 3;

      expect(element.renameableItems[1].start).to.be.equal(start);
      expect(element.renameableItems[1].end).to.be.equal(end);
    });
  });

  describe('dom-repeat templates', function() {
    it('basic usage', function () {
      let element = getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="{{bar}}"><div>[[item]] - [[item.foobar]]</div></template>')[0];
      expect(element.renameableItems.length).to.be.equal(2);

      expect(element.renameableItems.length).to.be.equal(2);
      expect(element.renameableItems[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[0].isElementProperty).to.be.true;
      expect(element.renameableItems[0].symbol).to.be.equal('bar');
      let start = element.documentHtmlString.indexOf('{{bar}}') + 2;
      let end = start + 3;
      expect(element.renameableItems[0].start).to.be.equal(start);
      expect(element.renameableItems[0].end).to.be.equal(end);

      expect(element.renameableItems[1]).to.be.an.instanceof(domRepeatExpr);
      expect(element.renameableItems[1].items).to.be.equal('bar');
      expect(element.renameableItems[1].alias).to.be.an('undefined');
      expect(element.renameableItems[1].index).to.be.an('undefined');
      expect(element.renameableItems[1].renameables.length).to.be.equal(2);

      expect(element.renameableItems[1].renameables[0]).to.be.an.instanceof(domRepeatNonRenameableExpr);
      expect(element.renameableItems[1].renameables[0].prefix).to.be.equal('item');
      expect(element.renameableItems[1].renameables[0].symbol).to.be.equal('item');
      start = element.documentHtmlString.indexOf('[[item]]') + 2;
      end = start + 4;
      expect(element.renameableItems[1].renameables[0].start).to.be.equal(start);
      expect(element.renameableItems[1].renameables[0].end).to.be.equal(end);

      expect(element.renameableItems[1].renameables[1]).to.be.an.instanceof(domRepeatNonRenameableExpr);
      expect(element.renameableItems[1].renameables[1].prefix).to.be.equal('item');
      expect(element.renameableItems[1].renameables[1].symbol).to.be.equal('item.foobar');
      start = element.documentHtmlString.indexOf('[[item.foobar]]') + 2;
      end = start + 'item.foobar'.length;
      expect(element.renameableItems[1].renameables[1].start).to.be.equal(start);
      expect(element.renameableItems[1].renameables[1].end).to.be.equal(end);
    });

    it('with "as" and "index-as" attribute alias - single level', function () {
      let element = getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="{{bar}}" as="baz" index-as="i"><div>[[baz.foobar]] - [[i]]</div></template>')[0];
      expect(element.renameableItems.length).to.be.equal(2);

      expect(element.renameableItems[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[0].isElementProperty).to.be.true;
      expect(element.renameableItems[0].symbol).to.be.equal('bar');
      let start = element.documentHtmlString.indexOf('{{bar}}') + 2;
      let end = start + 3;
      expect(element.renameableItems[0].start).to.be.equal(start);
      expect(element.renameableItems[0].end).to.be.equal(end);

      expect(element.renameableItems[1]).to.be.an.instanceof(domRepeatExpr);
      expect(element.renameableItems[1].items).to.be.equal('bar');
      expect(element.renameableItems[1].alias).to.be.equal('baz');
      expect(element.renameableItems[1].index).to.be.equal('i');
      expect(element.renameableItems[1].renameables.length).to.be.equal(4);

      expect(element.renameableItems[1].renameables[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[1].renameables[0].symbol).to.be.equal('baz');
      expect(element.renameableItems[1].renameables[0].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('"baz"') + 1;
      end = start + 3;
      expect(element.renameableItems[1].renameables[0].start).to.be.equal(start);
      expect(element.renameableItems[1].renameables[0].end).to.be.equal(end);

      expect(element.renameableItems[1].renameables[1]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[1].renameables[1].symbol).to.be.equal('i');
      expect(element.renameableItems[1].renameables[1].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('"i"') + 1;
      end = start + 1;
      expect(element.renameableItems[1].renameables[1].start).to.be.equal(start);
      expect(element.renameableItems[1].renameables[1].end).to.be.equal(end);

      expect(element.renameableItems[1].renameables[2]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[1].renameables[2].symbol).to.be.equal('baz.foobar');
      expect(element.renameableItems[1].renameables[2].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('[[baz.foobar]]') + 2;
      end = start + 'baz.foobar'.length;
      expect(element.renameableItems[1].renameables[2].start).to.be.equal(start);
      expect(element.renameableItems[1].renameables[2].end).to.be.equal(end);

      expect(element.renameableItems[1].renameables[3]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[1].renameables[3].symbol).to.be.equal('i');
      expect(element.renameableItems[1].renameables[3].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('[[i]]') + 2;
      end = start + 1;
      expect(element.renameableItems[1].renameables[3].start).to.be.equal(start);
      expect(element.renameableItems[1].renameables[3].end).to.be.equal(end);
    });

    it('basic filtering and sorting', function () {
      let element = getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="{{bar}}" filter="foo" sort="baz"><div></div></template>')[0];
      expect(element.renameableItems.length).to.be.equal(4);

      expect(element.renameableItems[1]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[1].symbol).to.be.equal('baz');
      expect(element.renameableItems[1].isElementProperty).to.be.true;
      let start = element.documentHtmlString.indexOf('"baz"') + 1;
      let end = start + 3;
      expect(element.renameableItems[1].start).to.be.equal(start);
      expect(element.renameableItems[1].end).to.be.equal(end);

      expect(element.renameableItems[2]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[2].symbol).to.be.equal('foo');
      expect(element.renameableItems[2].isElementProperty).to.be.true;
      start = element.documentHtmlString.indexOf('"foo"') + 1;
      end = start + 3;
      expect(element.renameableItems[2].start).to.be.equal(start);
      expect(element.renameableItems[2].end).to.be.equal(end);

      expect(element.renameableItems[3]).to.be.an.instanceof(domRepeatExpr);
      expect(element.renameableItems[3].items).to.be.equal('bar');
      expect(element.renameableItems[3].alias).to.be.an('undefined');
      expect(element.renameableItems[3].index).to.be.an('undefined');
      expect(element.renameableItems[3].renameables.length).to.be.equal(0);
    });

    it('dynamic filtering and sorting', function () {
      let element = getPolymerElementInfo('foo-bar',
          '<template is="dom-repeat" items="{{bar}}" filter="{{computedFilter(foo)}}" sort="{{computeSort(baz)}}" observe="foo baz"><div></div></template>')[0];
      expect(element.renameableItems.length).to.be.equal(6);

      expect(element.renameableItems[1]).to.be.an.instanceof(methodExpr);
      expect(element.renameableItems[1].methodName).to.be.equal('computedFilter');
      expect(element.renameableItems[1].args.length).to.be.equal(1);
      let start = element.documentHtmlString.indexOf('computedFilter');
      let end = start + 'computedFilter'.length;
      expect(element.renameableItems[1].start).to.be.equal(start);
      expect(element.renameableItems[1].end).to.be.equal(end);

      expect(element.renameableItems[1].args[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[1].args[0].isElementProperty).to.be.true;
      expect(element.renameableItems[1].args[0].symbol).to.be.equal('foo');
      start = element.documentHtmlString.indexOf('(foo') + 1;
      end = start + 3;
      expect(element.renameableItems[1].args[0].start).to.be.equal(start);
      expect(element.renameableItems[1].args[0].end).to.be.equal(end);

      expect(element.renameableItems[2]).to.be.an.instanceof(methodExpr);
      expect(element.renameableItems[2].methodName).to.be.equal('computeSort');
      expect(element.renameableItems[2].args.length).to.be.equal(1);
      start = element.documentHtmlString.indexOf('computeSort');
      end = start + 'computeSort'.length;
      expect(element.renameableItems[2].start).to.be.equal(start);
      expect(element.renameableItems[2].end).to.be.equal(end);

      expect(element.renameableItems[2].args[0]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[2].args[0].isElementProperty).to.be.true;
      expect(element.renameableItems[2].args[0].symbol).to.be.equal('baz');
      start = element.documentHtmlString.indexOf('(baz') + 1;
      end = start + 3;
      expect(element.renameableItems[2].args[0].start).to.be.equal(start);
      expect(element.renameableItems[2].args[0].end).to.be.equal(end);

      expect(element.renameableItems[3]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[3].isElementProperty).to.be.true;
      expect(element.renameableItems[3].symbol).to.be.equal('foo');
      start = element.documentHtmlString.indexOf('"foo ') + 1;
      end = start + 3;
      expect(element.renameableItems[3].start).to.be.equal(start);
      expect(element.renameableItems[3].end).to.be.equal(end);

      expect(element.renameableItems[4]).to.be.an.instanceof(symbolExpr);
      expect(element.renameableItems[4].isElementProperty).to.be.true;
      expect(element.renameableItems[4].symbol).to.be.equal('baz');
      start = element.documentHtmlString.indexOf(' baz"') + 1;
      end = start + 3;
      expect(element.renameableItems[4].start).to.be.equal(start);
      expect(element.renameableItems[4].end).to.be.equal(end);

      expect(element.renameableItems[5]).to.be.an.instanceof(domRepeatExpr);
      expect(element.renameableItems[5].items).to.be.equal('bar');
      expect(element.renameableItems[5].alias).to.be.an('undefined');
      expect(element.renameableItems[5].index).to.be.an('undefined');
      expect(element.renameableItems[5].renameables.length).to.be.equal(0);
    });

    it('nested repeats', function () {
      let element = getPolymerElementInfo('foo-bar',
          `<template is="dom-repeat" items="{{bar}}" as="outerItem" index-as="outerIndex">
            [[middleItem]]
            <template is="dom-repeat" items="{{outerItem}}">
              <template is="dom-repeat" items="{{item}}" as="innerItem" index-as="innerIndex">
                [[outerItem.length]] [[outerIndex]] [[item.length]] [[index]] [[innerItem]] [[innerIndex]] [[foobar]]
              </template>
            </template>
          </template>`)[0];
      expect(element.renameableItems.length).to.be.equal(2);
      let start, end, outer, middle, inner;

      //
      // Outer dom repeat
      //
      outer = element.renameableItems[1];
      expect(outer).to.be.an.instanceof(domRepeatExpr);
      expect(outer.items).to.be.equal('bar');
      expect(outer.alias).to.be.equal('outerItem');
      expect(outer.index).to.be.equal('outerIndex');
      expect(outer.renameables.length).to.be.equal(5);

      expect(outer.renameables[0]).to.be.an.instanceof(symbolExpr);
      expect(outer.renameables[0].symbol).to.be.equal('outerItem');
      expect(outer.renameables[0].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('as="outerItem"') + 'as="'.length;
      end = start + 'outerItem'.length;
      expect(outer.renameables[0].start).to.be.equal(start);
      expect(outer.renameables[0].end).to.be.equal(end);

      expect(outer.renameables[1]).to.be.an.instanceof(symbolExpr);
      expect(outer.renameables[1].symbol).to.be.equal('outerIndex');
      expect(outer.renameables[1].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('index-as="outerIndex"') + 'index-as="'.length;
      end = start + 'outerIndex'.length;
      expect(outer.renameables[1].start).to.be.equal(start);
      expect(outer.renameables[1].end).to.be.equal(end);

      // This reference to "middleItem" should be recognized as a property
      // of the element because it's dom-repeat definition is not in scope
      expect(outer.renameables[2]).to.be.an.instanceof(symbolExpr);
      expect(outer.renameables[2].symbol).to.be.equal('middleItem');
      expect(outer.renameables[2].isElementProperty).to.be.true;
      start = element.documentHtmlString.indexOf('[[middleItem]]\n') + 2;
      end = start + 'middleItem'.length;
      expect(outer.renameables[2].start).to.be.equal(start);
      expect(outer.renameables[2].end).to.be.equal(end);

      expect(outer.renameables[3]).to.be.an.instanceof(symbolExpr);
      expect(outer.renameables[3].symbol).to.be.equal('outerItem');
      expect(outer.renameables[3].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('items="{{outerItem}}"') + 'items="{{'.length;
      end = start + 'outerItem'.length;
      expect(outer.renameables[3].start).to.be.equal(start);
      expect(outer.renameables[3].end).to.be.equal(end);

      //
      // Middle dom repeat
      //
      middle = outer.renameables[4];
      expect(middle).to.be.an.instanceof(domRepeatExpr);
      expect(middle.items).to.be.equal('outerItem');
      expect(middle.alias).to.be.an('undefined');
      expect(middle.index).to.be.an('undefined');
      expect(middle.renameables.length).to.be.equal(2);

      expect(middle.renameables[0]).to.be.an.instanceof(domRepeatNonRenameableExpr);
      expect(middle.renameables[0].symbol).to.be.equal('item');
      expect(middle.renameables[0].prefix).to.be.equal('item');
      start = element.documentHtmlString.indexOf('items="{{item}}"') + 'items="{{'.length;
      end = start + 'item'.length;
      expect(middle.renameables[0].start).to.be.equal(start);
      expect(middle.renameables[0].end).to.be.equal(end);

      //
      // Inner dom repeat
      //
      inner = middle.renameables[1];
      expect(inner).to.be.an.instanceof(domRepeatExpr);
      expect(inner.items).to.be.equal('item');
      expect(inner.alias).to.be.equal('innerItem');
      expect(inner.index).to.be.equal('innerIndex');
      expect(inner.renameables.length).to.be.equal(9);

      expect(inner.renameables[0]).to.be.an.instanceof(symbolExpr);
      expect(inner.renameables[0].symbol).to.be.equal('innerItem');
      expect(inner.renameables[0].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('as="innerItem"') + 'as="'.length;
      end = start + 'innerItem'.length;
      expect(inner.renameables[0].start).to.be.equal(start);
      expect(inner.renameables[0].end).to.be.equal(end);

      expect(inner.renameables[1]).to.be.an.instanceof(symbolExpr);
      expect(inner.renameables[1].symbol).to.be.equal('innerIndex');
      expect(inner.renameables[1].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('index-as="innerIndex"') + 'index-as="'.length;
      end = start + 'innerIndex'.length;
      expect(inner.renameables[1].start).to.be.equal(start);
      expect(inner.renameables[1].end).to.be.equal(end);

      expect(inner.renameables[2]).to.be.an.instanceof(symbolExpr);
      expect(inner.renameables[2].symbol).to.be.equal('outerItem.length');
      expect(inner.renameables[2].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('outerItem.length');
      end = start + 'outerItem.length'.length;
      expect(inner.renameables[2].start).to.be.equal(start);
      expect(inner.renameables[2].end).to.be.equal(end);

      expect(inner.renameables[3]).to.be.an.instanceof(symbolExpr);
      expect(inner.renameables[3].symbol).to.be.equal('outerIndex');
      expect(inner.renameables[3].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('[[outerIndex]]') + 2;
      end = start + 'outerIndex'.length;
      expect(inner.renameables[3].start).to.be.equal(start);
      expect(inner.renameables[3].end).to.be.equal(end);

      expect(inner.renameables[4]).to.be.an.instanceof(domRepeatNonRenameableExpr);
      expect(inner.renameables[4].symbol).to.be.equal('item.length');
      expect(inner.renameables[4].prefix).to.be.equal('item');
      start = element.documentHtmlString.indexOf('item.length');
      end = start + 'item.length'.length;
      expect(inner.renameables[4].start).to.be.equal(start);
      expect(inner.renameables[4].end).to.be.equal(end);

      expect(inner.renameables[5]).to.be.an.instanceof(domRepeatNonRenameableExpr);
      expect(inner.renameables[5].symbol).to.be.equal('index');
      expect(inner.renameables[5].prefix).to.be.equal('index');
      start = element.documentHtmlString.indexOf('[[index]]') + 2;
      end = start + 'index'.length;
      expect(inner.renameables[5].start).to.be.equal(start);
      expect(inner.renameables[5].end).to.be.equal(end);

      expect(inner.renameables[6]).to.be.an.instanceof(symbolExpr);
      expect(inner.renameables[6].symbol).to.be.equal('innerItem');
      expect(inner.renameables[6].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('[[innerItem]]') + 2;
      end = start + 'innerItem'.length;
      expect(inner.renameables[6].start).to.be.equal(start);
      expect(inner.renameables[6].end).to.be.equal(end);

      expect(inner.renameables[7]).to.be.an.instanceof(symbolExpr);
      expect(inner.renameables[7].symbol).to.be.equal('innerIndex');
      expect(inner.renameables[7].isElementProperty).to.be.false;
      start = element.documentHtmlString.indexOf('[[innerIndex]]') + 2;
      end = start + 'innerIndex'.length;
      expect(inner.renameables[7].start).to.be.equal(start);
      expect(inner.renameables[7].end).to.be.equal(end);

      expect(inner.renameables[8]).to.be.an.instanceof(symbolExpr);
      expect(inner.renameables[8].symbol).to.be.equal('foobar');
      expect(inner.renameables[8].isElementProperty).to.be.true;
      start = element.documentHtmlString.indexOf('[[foobar]]') + 2;
      end = start + 'foobar'.length;
      expect(inner.renameables[8].start).to.be.equal(start);
      expect(inner.renameables[8].end).to.be.equal(end);
    });
  });
});
