# @banno/polymer-rename
[![Build Status](https://travis-ci.org/Banno/polymer-rename.svg?branch=master)]

When using [Closure-compiler](https://developers.google.com/closure/compiler) with `ADVANCED` optimizations,
object properties are renamed. This behavior will break property references in Polymer template data-bound
expressions and events.

This project parses Polymer element HTML, extracts the renameable expressions and property references and creates
a valid JavaScript file which passes those methods to specially named functions. This JavaScript file can then be
provided to Closure-compiler along with the script source of the application. This allows property references from
templates to be consistently renamed and type checked along with the main source.

Using the code-splitting functionality of the compiler, the generated renameable javascript can be directed to a
separate file. This file can then be used to update the original HTML template with the now-renamed property references.

## Usage

This project functions in two phases: pre and post closure-compiler compilation. Each phase has its own gulp plugin
or can be used as native JS functions.

### Pre-compilation: Extracting Data-binding Expressions

**Gulp**

```js
const polymerRename = require('@banno/polymer-rename');
const rename = require('gulp-rename');

gulp.task('extract-data-binding-expressions', function() {
  gulp.src('/src/components/**/*.html') // Usually this will be the vulcanized file
      .pipe(polymerRename.extract())
      .pipe(rename(function (filePath) {
        filePath.basename += '.template';
      }))
      .pipe(gulp.dest('./build'));
});
```

**JS Functions**

```js
const extractExpressions = require('@banno/polymer-rename/lib/extract-expressions');
const fs = require('fs');

let expressions = extractExpressions(fs.readFileSync('/src/components/foo-bar.html', {encoding: 'utf8'}));
console.log(expressions);
```

### Example Compilation

Closure-compiler's module flags allow the output to be split into separate files.

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
          require.resolve('google-closure-compiler/contrib/externs/polymer-1.0.js'), //someday this will be true :)
          require.resolve('@banno/polymer-rename/polymer-rename-externs.js')
        ]
      })
      .pipe(gulp.dest('./build'));
});
```

### Post-compilation: Find the Renamed Properties And Update the Template

**Gulp**

```js
const polymerRename = require('@banno/polymer-rename');

gulp.task('update-html-template', function() {
  gulp.src('./src/components/foo-bar.html') // Usually this will be the vulcanized file
      .pipe(polymerRename.replace('./build/foo-bar.template.js'))
      .pipe(gulp.dest('./dist/components'));
});
```

**JS Functions**

```js
const replaceExpressions = require('@banno/polymer-rename/lib/replace-expressions');
const fs = require('fs');

let originalTemplate = fs.readFileSync('./src/components/foo-bar.html', {encoding: 'utf8'});
let renamedExpressions = fs.readFileSync('./build/foo-bar.template.js', {encoding: 'utf8'});

let updatedTemplate = replaceExpressions(originalTemplate, renamedExpressions);
console.log(updatedTemplate);
```

## How This Project Works

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

## Advantages Over The PolymerRenamer

The [PolymerRenamer](https://github.com/polymerlabs/polymerrenamer) project uses the property renaming report as a map
so that data bound expressions can be replaced with their renamed versions. However the approach has severe limitations
including failing to protect from dead-code elimination, property collapsing and is also not compatible with the
type-based optimizations.
