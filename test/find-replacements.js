'use strict';
const expect = require('chai').expect;
const FindReplacements = require('../lib/replace-expressions/find-replacements');

describe('find replacements', function() {
  it('identifier', function () {
    let expressions = new FindReplacements(
        `(function(){polymerRename.identifier(60, 63, this.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expressions = new FindReplacements(
        `(function(){polymerRename.identifier(60, 63, a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expressions = new FindReplacements(
        `(function(){polymerRename.identifier(60, 63, a);}).call(document.createElement("foo-bar"));
        polymerRename.identifier(90, 93, this.a.b);
        polymerRename.identifier(80, 83, Array.size);
        polymerRename.identifier(70, 73, item);`);
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

  it('identifier with non-renameable prefix', function () {
    let expressions = new FindReplacements(
        `(function(){polymerRename.identifier(60, 63, b.a, b, 'item');}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('item.a');

    expressions = new FindReplacements(`(function(){
        polymerRename.identifier(90, 93, b.c, b, 'item');
      }).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(90);
    expect(expressions.replacements[0].end).to.be.equal(93);
    expect(expressions.replacements[0].value).to.be.equal('item.c');
  });

  it('method', function () {
    let expressions = new FindReplacements(
        `(function(){polymerRename.method(60, 63, this.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('a');

    expressions = new FindReplacements(
        `(function(){polymerRename.method(60, 63, a);}).call(document.createElement("foo-bar"));
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

  it('method with non-renameable prefix', function () {
    let expressions = new FindReplacements(
        `(function(){polymerRename.method(60, 63, a.b, a, 'item');}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(1);
    expect(expressions.replacements[0].start).to.be.equal(60);
    expect(expressions.replacements[0].end).to.be.equal(63);
    expect(expressions.replacements[0].value).to.be.equal('item.b');
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

  it('unrecognized', function () {
    let expressions = new FindReplacements(
        `(function(){polymerRename.foobar(60, 63, b.a);}).call(document.createElement("foo-bar"));`);
    expect(expressions.replacements.length).to.be.equal(0);
  });

  it('mixed', function () {
    let expressions = new FindReplacements(`(function() {
polymerRename.identifier(78, 81, this.a);
for (let a = 0; a < this.a.length; a++) {
  let b = this.a[a];
  polymerRename.domRepeatObserve(85, 88, b.aa, b, 'item');
  for (let c = 0; c < b.length; c++) {
    let d = b[c];
    polymerRename.identifier(242, 246, d);
    for (let e = 0; e < d.length; e++) {
      let f = d[e];
      polymerRename.domRepeatObserve(248, 251, f.cc, f, 'item');
      polymerRename.identifier(300, 316, b.length);
      polymerRename.identifier(336, 347, f.length, f, 'item');
      polymerRename.identifier(391, 397, this.g);
    }
  }
}
}).call(document.createElement("foo-bar"))`);
    expect(expressions.replacements.length).to.be.equal(7);
    let index = -1;

    index++;
    expect(expressions.replacements[index].start).to.be.equal(78);
    expect(expressions.replacements[index].end).to.be.equal(81);
    expect(expressions.replacements[index].value).to.be.equal('a');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(85);
    expect(expressions.replacements[index].end).to.be.equal(88);
    expect(expressions.replacements[index].value).to.be.equal('aa');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(242);
    expect(expressions.replacements[index].end).to.be.equal(246);
    expect(expressions.replacements[index].value).to.be.equal('d');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(248);
    expect(expressions.replacements[index].end).to.be.equal(251);
    expect(expressions.replacements[index].value).to.be.equal('cc');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(300);
    expect(expressions.replacements[index].end).to.be.equal(316);
    expect(expressions.replacements[index].value).to.be.equal('b.length');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(336);
    expect(expressions.replacements[index].end).to.be.equal(347);
    expect(expressions.replacements[index].value).to.be.equal('item.length');

    index++;
    expect(expressions.replacements[index].start).to.be.equal(391);
    expect(expressions.replacements[index].end).to.be.equal(397);
    expect(expressions.replacements[index].value).to.be.equal('g');
  });
});
