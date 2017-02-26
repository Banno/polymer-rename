# polymer-rename
[![Build Status](https://travis-ci.org/Banno/polymer-rename.svg?branch=master)](https://travis-ci.org/Banno/polymer-rename)
[![npm version](https://badge.fury.io/js/polymer-rename.svg)](https://badge.fury.io/js/polymer-rename)

**Updated for Polymer 2**

[Closure-compiler](https://developers.google.com/closure/compiler) with `ADVANCED` optimizations, offers the powerful
ability to rename properties. However, it can only safely be used on code bases which follow its
[required conventions](https://developers.google.com/closure/compiler/docs/limitations).
With the introduction of polymer templates, data binding expressions become external uses of code which the compiler
must be made aware of or optimizations such as dead-code elimination and property renaming will break the template
references. While it's possible to quote or export all of the properties referenced from polymer templates, that action
significantly decreases both the final compression as well as the type checking ability of the compiler.

This project offers an alternative approach. Prior to compilation with Closure-compiler, the Polymer template html
is parsed and any data binding expressions are extracted. These extracted expressions are then output in an alternative
form as javascript. This extracted javascript is never intended to be actually executed, but it is provided to
Closure-compiler during compilation. The compiler can then safely rename references and thus the need to export or
quote properties used in data-binding is eliminated.

In addition, considerable type checking is enabled for data-binding expressions.

**Original**

```html
<dom-module id="add-or-subtract">
  <template>
    <div><button on-tap="_addOne">Increase</button></div>
    <div><button on-tap="_subtractOne">Decrease</button></div>
  </template>
  <script>
    Polymer({
      is: 'add-or-subtract',
      properties: {
        value: {
          type: Number,
          notify: true
        }
      },
      _addOne: function() { this.value++; },
      _subtractOne: function() { this.value--; }
    });
  </script>
</dom-module>
<dom-module id="foo-bar">
  <template>
    <template is="dom-repeat" items="[[numList]]" as="num">
      <add-or-subtract on-value-changed="{{_valueChanged}}" value="[[num]]"></add-or-subtract>
    </template>
  </template>
  <script>
    Polymer({
      is: 'foo-bar',
      properties: {
        numList: {
          type: Array,
          value: () => [1, 2, 3, 4];
        }
      }
      _valueChanged: function() {}
    });
  </script>
</dom-module>
```

**After Compilation/Renaming**

```html
<dom-module id="add-or-subtract">
  <template>
    <div><button on-tap="a">Increase</button></div>
    <div><button on-tap="b">Decrease</button></div>
  </template>
  <script>
    Polymer({
      is: 'add-or-subtract',
      properties: {
        c: {
          type: Number,
          notify: true
        }
      },
      a: function() { this.c++; },
      b: function() { this.c--; }
    });
  </script>
</dom-module>
<dom-module id="foo-bar">
  <template>
    <template is="dom-repeat" items="[[d]]" as="e">
      <add-or-subtract on-c-changed="{{f}}" value="[[e]]"></add-or-subtract>
    </template>
  </template>
  <script>
    Polymer({
      is: 'foo-bar',
      properties: {
        d: {
          type: Array,
          value: () => [1, 2, 3, 4];
        }
      }
      f: function() {}
    });
  </script>
</dom-module>
```

## Using Polymer 2 Renaming

For Polymer 1, Closure-Compiler blocked renaming of any declared property. With Polymer 2, the compiler now uses
the standard conventions: quoted properties are not renamed and other properties are.

In addition, this project will rename attributes which map to properties of a custom element.

## Usage

This project functions in two phases: pre and post closure-compiler compilation. Each phase has its own gulp plugin
or can be used as native JS functions.

### Pre-compilation: Extracting Data-binding Expressions

This first phase of the project parses polymer element templates and produces a javascript file to pass to
closure-compiler.

The plugin makes use of the [polymer-analyzer](https://github.com/polymer/polymer-analyzer) and requires both the
HTML templates as well as any external JS source that contains element definitions.

**Gulp**

```js
const gulp = require('gulp');
const polymerRename = require('polymer-rename');

gulp.task('extract-data-binding-expressions', function() {
  gulp.src('/src/components/**/*.html') // Usually this will be the vulcanized file - may also need to add .js files
      .pipe(polymerRename.extract({
        outputFilename: 'foo-bar.template.js'
      }))
      .pipe(gulp.dest('./build'));
});
```

**JS Functions**

```js
const extractExpressions = require('polymer-rename/lib/extract-expressions/parse-polymer-elements');
const fs = require('fs');

extractExpressions(fs.readFileSync('/src/components/foo-bar.html', {encoding: 'utf8'}))
  .then(expressions => {
    console.log(expressions);
  });
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
        polymer_pass: true,
        module: [
          'app:1',
          'foo-bar.template:1:app'
        ],
        externs: [
          require.resolve('google-closure-compiler/contrib/externs/polymer-1.0.js'),
          require.resolve('polymer-rename/polymer-rename-externs.js')
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
const polymerRename = require('polymer-rename');

gulp.task('update-html-template', function() {
  gulp.src('./src/components/foo-bar.html') // Usually this will be the vulcanized file
      .pipe(polymerRename.replace('./dist/foo-bar.template.js'))
      .pipe(gulp.dest('./dist/components'));
});
```

**JS Functions**

```js
const replaceExpressions = require('polymer-rename/lib/replace-expressions/replace-expressions');
const fs = require('fs');

let originalTemplate = fs.readFileSync('./src/components/foo-bar.html', {encoding: 'utf8'});
let renamedExpressions = fs.readFileSync('./dist/foo-bar.template.js', {encoding: 'utf8'});

let updatedTemplate = replaceExpressions(originalTemplate, renamedExpressions);
console.log(updatedTemplate);
```

## Element Type Names

By default, the Polymer pass of Closure-compiler derives the type names from the element tag name. The tag name is
converted to upper camel case and the string "Element" is appended. So `<foo-bar>` becomes type `FooBarElement`.

However, authors can choose to name their own types by assigning the return value of the `Polymer` function to a
variable. Example:

```js
myNamespace.FooBar = Polymer({is: 'foo-bar'});
```

To support this use case, the `polymerRename.extract()` gulp plugin takes an optional argument which is a lookup
function. The function takes a single argument of the element tag name and returns the type name. If the function
returns `undefined`, the default behavior will be used as a fallback.

Any tag name who's attributes contain data-binding expressions will be passed to this function. Standard HTML tags
and custom elements can both be resolved by this function.

```js
polymerRename.extract({
  typeNameLookup: tagName => {
    if (tagName === 'custom-tag') {
      return 'myNamespace.CustomTagElement';
    }
    return undefined;
  }
})
```

## Examples

Giving the following polymer template, the first phase of the project will extract the
data-binding expressions and create a valid JS file:

```html
<dom-module id="foo-bar" assetpath="/">
  <template>
    <div on-click="nameClicked">[[formatName(name)]]</div>
    <div>[[employer]]</div>
    <template is="dom-repeat" items="[[addresses]]">
      <div>[[item.street]]</div>
      <div>[[item.city]], [[item.state]] [[item.zip]]</div>
    </template>
  </template>
  <script>
  Polymer({
    is: "foo-bar",
    properties: {
      name: String,
      employer: String,
      
      /** @type {Array<{street: string, city: string, state: string, zip: string}>} */
      addresses: Array
    }
    
    /**
     * @param {?string} a
     * @return {string}
     */
    formatName: function(a) { return a || ''; },
    
    /** @param {!Event=} evt */
    nameClicked: function(evt) {
      console.log(this.name);
    }
  });
  </script>
</dom-module>
```

Generated JavaScript from the extracted data-bound properties:

```js
(/** @this {FooBarElement} */ function() {
  polymerRename.eventListener(72, 83, this.nameClicked);
  polymerRename.identifier(98, 102, this.name);
  this.formatName(this.name);
  polymerRename.method(87, 97, this.formatName);
  polymerRename.identifier(123, 131, this.employer);
  polymerRename.identifier(179, 188, this.addresses);
  for (let index = 0; index < this.addresses.length; index++) {
    let item = this.addresses[index];
    polymerRename.identifier(206, 217, item.street, item, 'item');
    polymerRename.identifier(239, 248, item.city, item, 'item');
    polymerRename.identifier(254, 264, item.state, item, 'item');
    polymerRename.identifier(269, 277, item.zip, item, 'item');
  }
}).call(/** @type {FooBarElement} */ (document.createElement("foo-bar")))
```
Each of the special function calls is [defined as an extern](polymer-rename-externs.js). Each call takes a pair of
indexes where the expression resides in the original file. After compilation, these indexes are used to replace the
original expression with the now renamed properties and methods.

The compiler consumes the JS file and outputs the renamed expressions:

```js
(function() {
  polymerRename.eventListener(72, 83, this.a);
  polymerRename.identifier(98, 102, this.b);
  this.c(this.b);
  polymerRename.method(87, 97, this.c);
  polymerRename.identifier(123, 131, this.d);
  polymerRename.identifier(179, 188, this.e);
  for (let a = 0; a < this.e.length; a++) {
    let b = this.e[a];
    polymerRename.identifier(206, 217, b.f, b, 'item');
    polymerRename.identifier(239, 248, b.g, b, 'item');
    polymerRename.identifier(254, 264, b.h, b, 'item');
    polymerRename.identifier(269, 277, b.i, b, 'item');
  }
}).call(document.createElement("foo-bar"))
```

The provided indexes are now used to update the original Polymer template.

## Limitations of This Project

Properties which are quoted are no longer renamed. However sub-paths are not analyzed. If the a property subpath
should be blocked from renaming, use extern types to ensure that the compiler will not rename the paths.
