const expect = require('chai').expect;
const File = require('vinyl');
const replaceExpressions = require('../').replace;

describe('gulp-polymer-renamer - replace phase', function() {
  describe('in buffer mode', function() {
    it('should replace expressions', function(done) {

      // create the fake file
      var fakeFile = new File({
        contents: new Buffer(`<dom-module id="foo-bar">
  <template>
    <div data-foo="{{bar}}"></div>
  </template>
</dom-module>`),
        path: './foo-bar.html'
      });

      // Create a extractExpressions plugin stream
      var replacer = replaceExpressions(__dirname + '/fixtures/renamed-js.js');

      // write the fake file to it
      replacer.write(fakeFile);

      // wait for the file to come back out
      replacer.once('data', function(file) {
        // make sure it came out the same way it went in
        expect(file).to.exist;
        expect(file.isBuffer()).to.be.true;
        expect(file.contents.toString('utf8')).to.be.equal(`<dom-module id="foo-bar">
  <template>
    <div data-foo="{{a}}"></div>
  </template>
</dom-module>`);
        done();
      });

    });

    it('should report an error for an invalid file path', function(done) {
      'use strict';
      // create the fake file
      let fakeFile = new File({
        contents: new Buffer(`<dom-module id="foo-bar">
  <template>
    <div data-foo="{{bar}}"></div>
  </template>
</dom-module>`)
      });

      // Create a extractExpressions plugin stream
      var replacer = replaceExpressions(__dirname + '/dne.js');

      // write the fake file to it
      replacer.write(fakeFile);

      replacer.on('error', function (err) {
        expect(err).to.exist;
        done();
      });
    });
  });
});
