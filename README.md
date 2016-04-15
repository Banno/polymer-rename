# @banno/polymer-rename

When using [Closure-compiler](https://developers.google.com/closure/compiler) with `ADVANCED` optimizations,
object properties are renamed. This behavior will break property references in Polymer template data-bound
expressions and events.

This project parses Polymer element HTML, extracts the renameable expressions and property references and creates
a valid JavaScript file which passes those methods to specially named functions. This JavaScript file can then be
provided to Closure-compiler along with the script source of the application. This allows property references from
templates to be consistently renamed and type checked along with the main source.

Using the code-splitting functionality of the compiler, the generated renameable javascript can be directed to a
separate file. This file can then be used to update the original HTML template with the now-renamed property references.

## Example

### Polymer Element HTML

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

### Generated JavaScript From Extracted Data-Bound Properties

```js
(/** @this {FooBarElement} */ function() {
polymerRenameMethod(64, 74, this.formatName);
polymerRenameProperty(75, 79, this.name);
polymerRenameProperty(94, 102, this.employer);
polymerRenameProperty(144, 153, this.addresses);
for (let index = 0; index < this.addresses.length; index++) {
  let item = this.addresses[index];
  polymerRenameDomRepeatProperty(171, 182, polymerDomRepeatItem(item), item.street);
  polymerRenameDomRepeatProperty(203, 212, polymerDomRepeatItem(item), item.city);
  polymerRenameDomRepeatProperty(218, 228, polymerDomRepeatItem(item), item.state);
  polymerRenameDomRepeatProperty(233, 241, polymerDomRepeatItem(item), item.zip);
}
}).call(/** @type {FooBarElement} */ (document.createElement("foo-bar")))
```

Each of the special function calls is [defined as an extern](polymer-rename-externs.js). Each call takes a pair of
indexes where the expression resides in the original file. After compilation, these indexes are used to replace the
original expression with the now renamed properties and methods.

### Generated JavaScript After Compilation

```js
(function() {
polymerRenameMethod(64, 74, this.a);
polymerRenameProperty(75, 79, this.b);
polymerRenameProperty(94, 102, this.c);
polymerRenameProperty(144, 153, this.d);
for (let e = 0; e < this.d.length; e++) {
  let f = this.d[e];
  polymerRenameDomRepeatProperty(171, 182, polymerDomRepeatItem(f), f.g);
  polymerRenameDomRepeatProperty(203, 212, polymerDomRepeatItem(f), f.h);
  polymerRenameDomRepeatProperty(218, 228, polymerDomRepeatItem(f), f.i);
  polymerRenameDomRepeatProperty(233, 241, polymerDomRepeatItem(f), f.j);
}
}).call(document.createElement("foo-bar"))
```

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
