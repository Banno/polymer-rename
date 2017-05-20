const expect = require('chai').expect;
const {File} = require('gulp-util');
const replaceExpressions = require('../').replace;
const InspectStream = require('./utility/inspect-stream');

describe('gulp-polymer-rename - replace phase', function() {
  describe('in buffer mode', function() {
    it('should replace expressions', function() {
      return new Promise((resolve, reject) => {
        // create the fake file
        // create the fake file
        var fakeFile = new File({
          contents: new Buffer(`<dom-module id="foo-bar">
  <template>
    <div data-foo="{{bar}}"></div>
  </template>
  <script>
    Polymer({
      is: 'foo-bar',
      bar: true
    });
  </script>
</dom-module>`),
          path: './foo-bar.html'
        });

        // Create a extractExpressions plugin stream
        var replacer = replaceExpressions(__dirname + '/fixtures/renamed-js.js');

        // wait for the file to come back out
        replacer.pipe(new InspectStream(function (file) {
          resolve(file);
        }));

        replacer.on('error', err => reject(err));

        // write the fake file to it
        replacer.end(fakeFile);
      }).then(file => {
            // make sure it came out the same way it went in
            expect(file).to.exist;
            expect(file.isBuffer()).to.be.true;
            expect(file.contents.toString('utf8')).to.be.equal(`<dom-module id="foo-bar">
  <template>
    <div data-foo="{{a}}"></div>
  </template>
  <script>
    Polymer({
      is: 'foo-bar',
      bar: true
    });
  </script>
</dom-module>`);
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
