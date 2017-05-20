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
    /**
     * @polymer
     * @customElement
     * @extends {Polymer.Element}
     */
    class AddOrSubtractElement extends Polymer.Element {
      static get is() { return 'add-or-subtract'; }
      static get properties() {
        return {
          value: {
            type: Number,
            notify: true
          }
        };
      }
      _addOne() { this.value++; }
      _subtractOne() { this.value--; }
    }
    customElements.define(AddOrSubtractElement.is, AddOrSubtractElement);
  </script>
</dom-module>
<dom-module id="foo-bar">
  <template>
    <template is="dom-repeat" items="[[numList]]" as="num">
      <add-or-subtract on-value-changed="{{_valueChanged}}" value="[[num]]"></add-or-subtract>
    </template>
  </template>
  <script>
    /**
     * @polymer
     * @customElement
     * @extends {Polymer.Element}
     */
    class FooBarElement extends Polymer.Element {
      static get is() { return 'foo-bar'; }
      static get properties() {
        return {
          numList: {
            type: Array,
            value: () => [1, 2, 3, 4]
          }
        };
      }
      _valueChanged() {}
    }
    customElements.define(FooBarElement.is, FooBarElement);
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
    class A extends Polymer.Element {
      static get is() { return 'add-or-subtract'; }
      static get properties() {
        return {
          c: {
            type: Number,
            notify: true
          }
        };
      }
      a() { this.c++; }
      b() { this.c--; }
    }
    customElements.define(A.is, A);
  </script>
</dom-module>
<dom-module id="foo-bar">
  <template>
    <template is="dom-repeat" items="[[d]]" as="e">
      <add-or-subtract on-c-changed="{{f}}" value="[[e]]"></add-or-subtract>
    </template>
  </template>
  <script>
    class B extends Polymer.Element {
      static get is() { return 'foo-bar'; }
      static get properties() {
        return {
          d: {
            type: Array,
            value: () => [1, 2, 3, 4]
          }
        };
      }
      f() {}
    }
    customElements.define(B.is, B);
  </script>
</dom-module>
```

## Using Polymer 2 Renaming

For Polymer 1, Closure-Compiler blocked renaming of any declared property. With Polymer 2, the compiler now uses
the standard conventions: quoted properties are not renamed and other properties are. Declared properties
with the `reflectToAttribute` or `readOnly` properties will never be renamed.

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
  gulp.src('/src/components/**/*.html') // Usually this will be the bundled file - may also need to add .js files
      .pipe(polymerRename.extract({
        outputFilename: 'foo-bar.template.js'
      }))
      .pipe(gulp.dest('./build'));
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
  gulp.src('./src/components/foo-bar.html') // Usually this will be the bundled file
      .pipe(polymerRename.replace('./dist/foo-bar.template.js'))
      .pipe(gulp.dest('./dist/components'));
});
```

## Element Type Names

polymer-rename obtains the type names of elements from polymer-analyzer. Type names for
elements must be global.

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
  /**
   * @polymer
   * @customElement
   * @extends {Polymer.Element}
   */
  class FooBarElement extends Polymer.Element {
    static get is() { return "foo-bar"; }
    static get properties() {
      return {
        name: String,
        employer: String,
        
        /** @type {Array<{street: string, city: string, state: string, zip: string}>} */
        addresses: Array
      };
    }
    
    /**
     * @param {?string} a
     * @return {string}
     */
    formatName(a) { return a || ''; },
    
    /** @param {!Event=} evt */
    nameClicked(evt) {
      console.log(this.name);
    }
  }
  customElements.define(FooBarElement.is, FooBarElement);
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

## Supporting String Based Polymer Features

Several functions and options in Polymer require providing property names as strings. This is problematic as
Closure-Compiler does not rename strings. This would include the following features:

 * [Computed properties](https://www.polymer-project.org/1.0/docs/devguide/observers#computed-properties)
 * [Observers](https://www.polymer-project.org/1.0/docs/devguide/observers#change-callbacks)
 * [Polymer 1 Listeners](https://www.polymer-project.org/1.0/docs/devguide/events#event-listeners)
 * [notifyPath](https://www.polymer-project.org/1.0/docs/devguide/model-data#notify-path)
 * [notifySplices](https://www.polymer-project.org/1.0/docs/devguide/model-data#notifysplices)
 * [set](https://www.polymer-project.org/1.0/docs/devguide/model-data#set-path)

To work around such limitations, Closure-Compiler recognizes two special functions defined in Closure-Library.
If your project does not utilize Closure-Library, you can simply copy the definitions for these two
functions to your code base. As long as they are named the same, the compiler will recognize them.

### Property Reflection with `goog.reflect.objectProperty`

[`goog.reflect.objectProperty`](https://google.github.io/closure-library/api/goog.reflect.html#objectProperty)
returns a renamed string for an object instance. It's particularly helpful when calling `notifyPath`, `notifySplices`
or `set`.

```js
this.notifyPath(goog.reflect.objectProperty('foo', this), this.foo);
```

### Property Reflection with `goog.reflect.object`

[`goog.reflect.object`](https://google.github.io/closure-library/api/goog.reflect.html#object)
renames the keys of an object literal consistently with a provided constructor. It's useful when an instance
of the object is not available.

```js
// If using closure-library, this function is goog.object.transpose
function swapKeysAndValues(obj) {
  let swappedObj = {};
  Object.keys(obj).map(key => {
    swappedObj[obj[key]] = key;
  });
  return swappedObj;
}

var myCustomElementProps = swapKeysAndValues(
  goog.reflect.object(MyCustomElement, {
    _fooChanged: '_fooChanged'
  })
);

var MyCustomElement = Polymer({
  is: 'my-custom',
  properties: {
    foo: {
      type: Boolean,
      observer: myCustomElementProps['_fooChanged']
    }
  },
  _fooChanged: function(newValue, oldValue) {}
});
```

## Limitations of This Project

Properties which are quoted are no longer renamed. However sub-paths are not analyzed. If the a property subpath
should be blocked from renaming, use extern types to ensure that the compiler will not rename the paths.
