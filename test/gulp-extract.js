const expect = require('chai').expect;
const File = require('vinyl');
const extractExpressions = require('../').extract;

describe('gulp-polymer-renamer - extract phase', function() {
  describe('in buffer mode', function() {
    it('should extract expressions', function(done) {

      // create the fake file
      var fakeFile = new File({
        contents: new Buffer(`<dom-module id="foo-bar">
  <template>
    <div data-foo="{{bar}}"></div>
  </template>
</dom-module>`)
      });

      // Create a extractExpressions plugin stream
      var extracter = extractExpressions();

      // write the fake file to it
      extracter.write(fakeFile);

      // wait for the file to come back out
      extracter.once('data', function(file) {
        // make sure it came out the same way it went in
        expect(file).to.exist;
        expect(file.isBuffer()).to.be.true;
        expect(file.contents.toString('utf8')).to.be.equal(`(/** @this {FooBarElement} */ function() {
polymerRename.symbol(60, 63, this.bar);
}).call(/** @type {FooBarElement} */ (document.createElement("foo-bar")))
`);
        done();
      });
    });

  });
});
