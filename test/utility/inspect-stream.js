'use strict';
const {Transform} = require('stream');

class InspectStream extends Transform {
  constructor(callback) {
    super({objectMode: true})
    this.callback = callback;
  }

  _transform(file, enc, cb) {
    this.callback(file);
    cb(null, file);
  }
}

module.exports = InspectStream;
