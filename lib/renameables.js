'use strict';

class BasicRenameable {
  /**
   * @param {number} start
   * @param {number} end
   */
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

class RenameableProperty extends BasicRenameable {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} property
   * @param {boolean=} isInstanceMethod
   */
  constructor(start, end, property, isInstanceMethod) {
    super(start, end);
    this.property = property;
    this.isInstanceMethod = isInstanceMethod === undefined ? true : isInstanceMethod;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let prefix = this.isInstanceMethod ? 'this.' : '';

    return `${indent}polymerRename.property(${this.start}, ${this.end}, ${prefix}${this.property});`;
  }
}

class RenambleMethod extends BasicRenameable {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} methodName
   * @param {!Array<!RenameableProperty>} args
   */
  constructor(start, end, methodName, args) {
    super(start, end);
    this.methodName = methodName;
    this.args = args;
  }

  get SINK_METHOD() {
    return 'polymerRename.method';
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let output = `${indent}${this.SINK_METHOD}(${this.start}, ${this.end}, this.${this.methodName});`;
    for (let i = 0; i < this.args.length; i++) {
      output += this.args[i].toString('\n' + indent);
    }
    return output;
  }
}

class RenambleEventListener extends RenambleMethod {
  /**
   * @param {number} start
   * @param {number} end
   * @param {string} methodName
   */
  constructor(start, end, methodName) {
    super(start, end, methodName, []);
  }

  get SINK_METHOD() {
    return 'polymerRename.eventListener';
  }
}

class DomRepeatPropertyWithNonRenameableItem extends RenameableProperty {
  /**
   * @param {RenameableProperty} renameable
   */
  constructor(renameable) {
    super(renameable.start, renameable.end, renameable.property, false);
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    return `${indent}polymerRename.domRepeatProperty(${this.start}, ${this.end}, ` +
        `polymerRename.domRepeatItem(item), ${this.property});`;
  }
}

class RenameableRepeat extends BasicRenameable {
  /**
   * @param {number} start
   * @param {number} end
   * @param {RenameableRepeat} parent
   * @param {!string} items
   * @param {!RenameableProperty=} alias
   * @param {!RenameableProperty=} index
   */
  constructor(start, end, parent, items, alias, index) {
    super(start, end);
    this.parent = parent;
    this.items = items;
    this.alias = alias;
    this.index = index;

    /** @type {!Array<!BasicRenameable>} */
    this.renameables = [];
  }

  /**
   * @param {string} property
   * @return {string}
   */
  getPropertyQualifiedName(property) {
    let propertyParts = property.split('.');

    if (propertyParts[0] === 'item' && !this.alias) {
      return property;
    }

    if (propertyParts[0] === 'index' && !this.index) {
      return property;
    }

    if (this.alias === propertyParts[0]) {
      return property;
    }

    if (this.index === propertyParts[0]) {
      return property;
    }

    if (!this.parent) {
      return 'this.' + property;
    }

    return this.parent.getItemsQualifiedName(property);
  }

  /**
   * @param {string} property
   * @return {boolean}
   */
  isPropertyRenamable(property) {
    let propertyParts = property.split('.');

    if (propertyParts[0] === 'item' && !this.alias) {
      return false;
    }

    if (propertyParts[0] === 'index' && !this.index) {
      return false;
    }

    if (this.alias === propertyParts[0]) {
      return true;
    }

    if (this.index === propertyParts[0]) {
      return true;
    }

    if (!this.parent) {
      return true;
    }

    return this.parent.isPropertyRenamable(property);
  }

  /**
   * @param {!BasicRenameable} renameable
   * @return {!Array<BasicRenameable>}
   */
  traverseRenameableChildren(renameable) {
    // don't recurse into another dom-repeat
    if (renameable instanceof RenameableRepeat) {
      return renameable;
    }

    if (renameable instanceof RenambleMethod) {
      for (let i = 0; i < renameable.args.length; i++) {
        renameable.args[i] = this.fixRenameablePropertyReference(renameable.args[i]);
      }
      return renameable;
    } else {
      return this.fixRenameablePropertyReference(renameable);
    }
  }

  fixRenameablePropertyReference(renameable) {
    if (this.isPropertyRenamable(renameable.property)) {
      let propertyName = this.getPropertyQualifiedName(renameable.property);
      renameable.isInstanceMethod = propertyName.split('.')[0] === 'this';
      return renameable;
    } else {
      return new DomRepeatPropertyWithNonRenameableItem(renameable);
    }
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let output = [];

    let alias = this.alias !== undefined ? this.alias : 'item';
    let index = this.index !== undefined ? this.index : 'index';

    let itemsName = this.parent ? this.parent.getPropertyQualifiedName(this.items) : ('this.' + this.items);

    output.push(`${indent}for (let ${index} = 0; ${index} < ${itemsName}.length; ${index}++) {`,
        `  ${indent}let ${alias} = ${itemsName}[${index}];`);

    for (let i = 0; i < this.renameables.length; i++) {
      this.renameables[i] = this.traverseRenameableChildren(this.renameables[i]);
    }

    for (let i = 0; i < this.renameables.length; i++) {
      output.push(this.renameables[i].toString(indent + '  '));
    }

    output.push(`${indent}}`);

    return output.join('\n');
  }
}

module.exports = {
  RenameableProperty,
  RenambleMethod,
  RenambleEventListener,
  RenameableRepeat
};

