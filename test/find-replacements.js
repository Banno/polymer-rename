'use strict';
const expect = require('chai').expect;
const FindReplacements = require('../lib/replace-expressions/find-replacements');

describe('find replacements', function() {
  it('symbol', function () {
    let expressions = new FindReplacements(`(function(){polymerRename.symbol(60, 63, this.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expressions = new FindReplacements(`(function(){polymerRename.symbol(60, 63, a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expressions = new FindReplacements(`(function(){polymerRename.symbol(60, 63, a);}).call(document.createElement("foo-bar"));
        polymerRename.symbol(90, 93, this.a.b);
        polymerRename.symbol(80, 83, Array.size);
        polymerRename.symbol(70, 73, item);`);
    expect(expressions.replacements.length).to.be.equal(4);

    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expect(expressions.replacements[1].start).to.be.equal(70);
    expect(expressions.replacements[1].end).to.be.equal(73);
    expect(expressions.replacements[1].value).to.be.equal('item');

    expect(expressions.replacements[2].start).to.be.equal(80);
    expect(expressions.replacements[2].end).to.be.equal(83);
    expect(expressions.replacements[2].value).to.be.equal('Array.size');

    expect(expressions.replacements[3].start).to.be.equal(90);
    expect(expressions.replacements[3].end).to.be.equal(93);
    expect(expressions.replacements[3].value).to.be.equal('a.b');
  });

  it('method', function () {
    let expressions = new FindReplacements(`(function(){polymerRename.method(60, 63, this.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expressions = new FindReplacements(`(function(){polymerRename.method(60, 63, a);}).call(document.createElement("foo-bar"));
        polymerRename.method(90, 93, this.a.b);
        polymerRename.method(80, 83, Array.size);
        polymerRename.method(70, 73, item);`);
    expect(expressions.replacements.length).to.be.equal(4);

    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expect(expressions.replacements[1].start).to.be.equal(70);
    expect(expressions.replacements[1].end).to.be.equal(73);
    expect(expressions.replacements[1].value).to.be.equal('item');

    expect(expressions.replacements[2].start).to.be.equal(80);
    expect(expressions.replacements[2].end).to.be.equal(83);
    expect(expressions.replacements[2].value).to.be.equal('Array.size');

    expect(expressions.replacements[3].start).to.be.equal(90);
    expect(expressions.replacements[3].end).to.be.equal(93);
    expect(expressions.replacements[3].value).to.be.equal('a.b');
  });

  it('event listener', function () {
    let expressions = new FindReplacements(`(function(){polymerRename.eventListener(60, 63, this.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expressions = new FindReplacements(`(function(){polymerRename.eventListener(60, 63, a);}).call(document.createElement("foo-bar"));
        polymerRename.eventListener(90, 93, this.a.b)`);
    expect(expressions.replacements.length).to.be.equal(2);

    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expect(expressions.replacements[1].start).to.be.equal(90);
    expect(expressions.replacements[1].end).to.be.equal(93);
    expect(expressions.replacements[1].value).to.be.equal('a.b');
  });

  it('dom repeat symbol', function () {
    let expressions = new FindReplacements(`(function(){polymerRename.domRepeatSymbol(60, 63, 'item', b, b.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('item.a');

    expressions = new FindReplacements(`(function(){polymerRename.domRepeatSymbol(60, 63, 'index', c, c);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('index');

    expressions = new FindReplacements(`(function(){polymerRename.domRepeatSymbol(60, 63, 'index', a, a);}).call(document.createElement("foo-bar"));
        polymerRename.domRepeatSymbol(90, 93, 'item', b, b.c)`);
    expect(expressions.replacements.length).to.be.equal(2);

    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('index');

    expect(expressions.replacements[1].start).to.be.equal(90);
    expect(expressions.replacements[1].end).to.be.equal(93);
    expect(expressions.replacements[1].value).to.be.equal('item.c');
  });

  it('unrecognized', function () {
    let expressions = new FindReplacements(`(function(){polymerRename.foobar(60, 63, b.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(0);
  });

  it('mixed', function () {
    let expressions = new FindReplacements(`(function() {
polymerRename.symbol(78, 81, this.a);
for (let a = 0; a < this.a.length; a++) {
  let b = this.a[a];
  polymerRename.symbol(89, 98, b);
  polymerRename.symbol(110, 120, a);
  polymerRename.symbol(131, 141, this.b);
  polymerRename.symbol(185, 194, b);
  for (let c = 0; c < b.length; c++) {
    let d = b[c];
    polymerRename.domRepeatSymbol(242, 246, 'item', b[c], b[c]);
    for (let e = 0; e < d.length; e++) {
      let f = d[e];
      polymerRename.symbol(254, 263, f);
      polymerRename.symbol(275, 285, e);
      polymerRename.symbol(300, 316, b.length);
      polymerRename.symbol(321, 331, a);
      polymerRename.domRepeatSymbol(336, 347, 'item', d[e], d[e].length);
      polymerRename.domRepeatSymbol(352, 357, 'index', c, c);
      polymerRename.symbol(362, 371, f);
      polymerRename.symbol(376, 386, e);
      polymerRename.symbol(391, 397, this.g);
    }
  }
}
}).call(document.createElement("foo-bar"))`);
    expect(expressions.replacements.length).to.be.equal(15);
    let index = -1;

    index++;
    expect(expressions.replacements[index].start).to.be.equal(78);
    expect(expressions.replacements[index].end).to.be.equal(81);
    expect(expressions.replacements[index].value).to.be.equal('a');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(89);
    expect(expressions.replacements[index].end).to.be.equal(98);
    expect(expressions.replacements[index].value).to.be.equal('b');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(110);
    expect(expressions.replacements[index].end).to.be.equal(120);
    expect(expressions.replacements[index].value).to.be.equal('a');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(131);
    expect(expressions.replacements[index].end).to.be.equal(141);
    expect(expressions.replacements[index].value).to.be.equal('b');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(185);
    expect(expressions.replacements[index].end).to.be.equal(194);
    expect(expressions.replacements[index].value).to.be.equal('b');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(242);
    expect(expressions.replacements[index].end).to.be.equal(246);
    expect(expressions.replacements[index].value).to.be.equal('item');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(254);
    expect(expressions.replacements[index].end).to.be.equal(263);
    expect(expressions.replacements[index].value).to.be.equal('f');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(275);
    expect(expressions.replacements[index].end).to.be.equal(285);
    expect(expressions.replacements[index].value).to.be.equal('e');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(300);
    expect(expressions.replacements[index].end).to.be.equal(316);
    expect(expressions.replacements[index].value).to.be.equal('b.length');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(321);
    expect(expressions.replacements[index].end).to.be.equal(331);
    expect(expressions.replacements[index].value).to.be.equal('a');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(336);
    expect(expressions.replacements[index].end).to.be.equal(347);
    expect(expressions.replacements[index].value).to.be.equal('item.length');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(352);
    expect(expressions.replacements[index].end).to.be.equal(357);
    expect(expressions.replacements[index].value).to.be.equal('index');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(362);
    expect(expressions.replacements[index].end).to.be.equal(371);
    expect(expressions.replacements[index].value).to.be.equal('f');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(376);
    expect(expressions.replacements[index].end).to.be.equal(386);
    expect(expressions.replacements[index].value).to.be.equal('e');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(391);
    expect(expressions.replacements[index].end).to.be.equal(397);
    expect(expressions.replacements[index].value).to.be.equal('g');
  });
});
