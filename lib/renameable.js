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

    return `${indent}polymerRenameProperty(${this.start}, ${this.end}, ${prefix}${this.property});`;
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
    return 'polymerRenameMethod';
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
    return 'polymerRenameListener';
  }
}

class DomRepeatRenameableProperty extends RenameableProperty {
  /**
   * @param {DomRepeatRenameableProperty} renameable
   */
  constructor(renameable) {
    super(renameable.start, renameable.end, renameable.property, false);
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
    return `${indent}polymerRenameDomRepeatProperty(${this.start}, ${this.end}, ` +
        `polymerDomRepeatItem(item), ${this.property});`;
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
   * @return {?RenameableRepeat}
   */
  findItemRef(property) {
    let propertyParts = property.split('.');

    if ((this.alias || 'item') === propertyParts[0]) {
      return this;
    }

    if (this.parent) {
      return this.parent.findItemRef(property);
    }

    return null;
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
    let propertyRef = this.findItemRef(renameable.property);
    if (propertyRef) {
      if (propertyRef.alias) {
        return new DomRepeatRenameableProperty(renameable);
      } else {
        return new DomRepeatPropertyWithNonRenameableItem(renameable);
      }
    }

    return renameable;
  }

  /**
   * @param {string=} indent
   * @returns {string}
   */
  toString(indent) {
    indent = indent || '';
    let output = [`${indent}(function() {`];

    let itemRef = this.findItemRef(this.items);
    let itemProp;
    if (itemRef) {
      itemProp = this.items;
    } else {
      itemProp = 'this.' + this.items;
    }
    let alias = this.alias !== undefined ? this.alias : 'item';
    let index = this.index !== undefined ? this.index : 'index';

    output.push(`  ${indent}for (let ${index} = 0; ${index} < ${itemProp}.length; ${index}++) {`,
        `    ${indent}let ${alias} = ${itemProp}[${index}];`);

    for (let i = 0; i < this.renameables.length; i++) {
      this.renameables[i] = this.traverseRenameableChildren(this.renameables[i]);
    }

    for (let i = 0; i < this.renameables.length; i++) {
      output.push(this.renameables[i].toString(indent + '    '));
    }

    output.push(`  ${indent}}`);
    output.push(`${indent}}).call(this)`);

    return output.join('\n');
  }
}

module.exports = {
  RenameableProperty,
  RenambleMethod,
  RenambleEventListener,
  RenameableRepeat
};

