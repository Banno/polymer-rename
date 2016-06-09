# @banno/polymer-rename
[![Build Status](https://travis-ci.org/Banno/polymer-rename.svg?branch=master)](https://travis-ci.org/Banno/polymer-rename)
[![npm version](https://badge.fury.io/js/polymer-rename.svg)](https://badge.fury.io/js/polymer-rename)

[Closure-compiler](https://developers.google.com/closure/compiler) with `ADVANCED` optimizations, offers the powerful
ability to rename properties. However, it can only safely be used on code bases which follow it's
[required conventions](https://developers.google.com/closure/compiler/docs/limitations).
With the introduction of polymer templates, data binding expressions become external uses of code which the compiler
must be made aware of or optimizations such as dead-code elimination and property renaming will break the template
references. While it's possible to quote or export all of the properties referenced from polymer templates, that action
significantly decreases both the final compression as well as the type checking ability of the compiler.

This project offers an alternative approach. Prior to compilation with Closure-compiler, the Polymer template html
is parsed any data binding expressions are extracted. These extracted expressions are then output in an alternative
form as javascript. This extracted javascript is never intended to be actually executed, but it is provided to
Closure-compiler during compilation. The compiler can then safely rename references and thus the need to export or
quote properties used in data-binding is eliminated. In addition, considerable type checking is enabled for data-binding
expressions.

## Usage

This project functions in two phases: pre and post closure-compiler compilation. Each phase has its own gulp plugin
or can be used as native JS functions.

### Pre-compilation: Extracting Data-binding Expressions

This first phase of the project parses polymer element templates and produces a javascript file to pass to
closure-compiler.

**Gulp**

```js
const polymerRename = require('@banno/polymer-rename');
const fileRename = require('gulp-rename');

gulp.task('extract-data-binding-expressions', function() {
  gulp.src('/src/components/**/*.html') // Usually this will be the vulcanized file
      .pipe(polymerRename.extract())
      .pipe(fileRename(function (filePath) {
        filePath.basename += '.template';
      }))
      .pipe(gulp.dest('./build'));
});
```

**JS Functions**

```js
const extractExpressions = require('@banno/polymer-rename/lib/extract-expressions/parse-polymer-elements');
const fs = require('fs');

let expressions = extractExpressions(fs.readFileSync('/src/components/foo-bar.html', {encoding: 'utf8'}));
console.log(expressions);
```

### Example Compilation

Closure-compiler's code-splitting flags allow the output to be divided into separate files. The compilation must
reference the [extern file](polymer-rename-externs.js) included with this package.

In addition, the compiler can now warn about mismatched types, misspelled or missing property references and other
checks.

```js
let closureCompiler = require('google-closure-compiler');

gulp.task('compile-js', function() {
  gulp.src(['./src/js/app.js', './build/foo-bar.template.js'])
      .pipe(closureCompiler({
        compilation_level: 'ADVANCED',
        warning_level: 'VERBOSE',
        module: [
          'app:1',
          'foo-bar.template:1:app'
        ],
        externs: [
          require.resolve('google-closure-compiler/contrib/externs/polymer-1.0.js'),
          require.resolve('@banno/polymer-rename/polymer-rename-externs.js')
        ]
      })
      .pipe(gulp.dest('./dist'));
});
```

### Post-compilation: Find the Renamed Properties And Update the Template

After compilation, the compiler will have consistently renamed references to the properties. The generated javascript
contains indexes into the original template which will now be replaced with their renamed versions.

**Gulp**

```js
const polymerRename = require('@banno/polymer-rename');

gulp.task('update-html-template', function() {
  gulp.src('./src/components/foo-bar.html') // Usually this will be the vulcanized file
      .pipe(polymerRename.replace('./dist/foo-bar.template.js'))
      .pipe(gulp.dest('./dist/components'));
});
```

**JS Functions**

```js
const replaceExpressions = require('@banno/polymer-rename/lib/replace-expressions/replace-expressions');
const fs = require('fs');

let originalTemplate = fs.readFileSync('./src/components/foo-bar.html', {encoding: 'utf8'});
let renamedExpressions = fs.readFileSync('./dist/foo-bar.template.js', {encoding: 'utf8'});

let updatedTemplate = replaceExpressions(originalTemplate, renamedExpressions);
console.log(updatedTemplate);
```

## Examples

Giving the following polymer template, the first phase of the project will extract the
data-binding expressions and create a valid JS file:

```html
<dom-module id="foo-bar" assetpath="/">
  <template>
    <div>[[formatName(name)]]
    <div>[[employer]]
    <template is="dom-repeat" items="[[addresses]]">
      <div>[[item.street]</div>
      <div>[[item.city]], [[item.state]] [[item.zip]]</div>
    </template>
  </template>
</dom-module>
```

Generated JavaScript from the extracted data-bound properties:

```js
(/** @this {FooBarElement} */ function() {
polymerRename.method(64, 74, this.formatName);
polymerRename.property(75, 79, this.name);
polymerRename.property(94, 102, this.employer);
polymerRename.property(144, 153, this.addresses);
for (let index = 0; index < this.addresses.length; index++) {
  let item = this.addresses[index];
  polymerRename.domRepeatProperty(171, 182, polymerRename.domRepeatItem(item), item.street);
  polymerRename.domRepeatProperty(203, 212, polymerRename.domRepeatItem(item), item.city);
  polymerRename.domRepeatProperty(218, 228, polymerRename.domRepeatItem(item), item.state);
  polymerRename.domRepeatProperty(233, 241, polymerRename.domRepeatItem(item), item.zip);
}
}).call(/** @type {FooBarElement} */ (document.createElement("foo-bar")))
```
Each of the special function calls is [defined as an extern](polymer-rename-externs.js). Each call takes a pair of
indexes where the expression resides in the original file. After compilation, these indexes are used to replace the
original expression with the now renamed properties and methods.

The compiler consumes the JS file and outputs the renamed expressions:

```js
(function() {
polymerRename.method(64, 74, this.a);
polymerRename.property(75, 79, this.b);
polymerRename.property(94, 102, this.c);
polymerRename.property(144, 153, this.d);
for (let e = 0; e < this.d.length; e++) {
  let f = this.d[e];
  polymerRename.domRepeatProperty(171, 182, polymerRename.domRepeatItem(f), f.g);
  polymerRename.domRepeatProperty(203, 212, polymerRename.domRepeatItem(f), f.h);
  polymerRename.domRepeatProperty(218, 228, polymerRename.domRepeatItem(f), f.i);
  polymerRename.domRepeatProperty(233, 241, polymerRename.domRepeatItem(f), f.j);
}
}).call(document.createElement("foo-bar"))
```

The provided indexes are now used to update the original Polymer template.

## Limitations of This Project

This methodology is an all-or-nothing approach. Every data bound expression will be forwarded to the compiler as a
potentially renameable reference. Closure-compiler uses the convention that dotted property accesses may be renamed
but bracketed/array-style property accesses may not. Since Polymer data-binding expressions do not support a bracketed
style access there is currently no method to indicate that a particular data-binding expression should not be
renameable.
