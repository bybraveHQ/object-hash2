'use strict';

var describe = require('node:test').describe;
var it = require('node:test').it;

var assert = require('assert');
var hash = require('../index');

describe('upstream #78: repeated references are not circular references', function() {
  it('an array referencing the same object twice hashes like two copies', function() {
    var a = [1, 2];
    assert.equal(hash([a, a]), hash([[1, 2], [1, 2]]));
  });

  it('an object referencing the same object twice hashes like two copies', function() {
    var shared = {x: 1};
    assert.equal(hash({left: shared, right: shared}), hash({left: {x: 1}, right: {x: 1}}));
  });

  it('repeated references in unordered arrays hash like copies', function() {
    var a = [1, 2];
    assert.equal(
      hash([a, a], {unorderedArrays: true}),
      hash([[1, 2], [1, 2]], {unorderedArrays: true})
    );
  });

  it('true cycles are still detected and deterministic', function() {
    var one = {x: 1};
    one.self = one;
    var two = {x: 1};
    two.self = two;
    assert.equal(hash(one), hash(two));
  });

  it('cycles pointing at different depths produce different hashes', function() {
    var toRoot = {v: 1};
    toRoot.child = {back: toRoot};
    var toChild = {v: 1};
    toChild.child = {back: null};
    toChild.child.back = toChild.child;
    assert.notEqual(hash(toRoot), hash(toChild));
  });
});

describe('upstream #62: binary data hashes by content, identically everywhere', function() {
  it('Buffer and Uint8Array with the same bytes hash the same', function() {
    assert.equal(hash(Buffer.from([1, 2, 3])), hash(new Uint8Array([1, 2, 3])));
  });

  it('ArrayBuffer hashes like the equivalent Uint8Array', function() {
    assert.equal(hash(new Uint8Array([9, 8]).buffer), hash(new Uint8Array([9, 8])));
  });

  it('DataView hashes by content, not as a constant', function() {
    var one = new DataView(new Uint8Array([1, 2]).buffer);
    var two = new DataView(new Uint8Array([3, 4]).buffer);
    assert.notEqual(hash(one), hash(two));
    assert.equal(hash(one), hash(new DataView(new Uint8Array([1, 2]).buffer)));
  });

  it('a DataView over a slice of a larger buffer uses only its window', function() {
    var big = new Uint8Array([0, 1, 2, 3, 4, 5]);
    var view = new DataView(big.buffer, 2, 2);
    assert.equal(hash(view), hash(new DataView(new Uint8Array([2, 3]).buffer)));
  });

  it('buffers with invalid utf8 do not collide (passthrough is lossless)', function() {
    var one = Buffer.from([0xff, 0xfe]);
    var two = Buffer.from([0xfe, 0xff]);
    assert.notEqual(
      hash(one, {algorithm: 'passthrough', encoding: 'hex'}),
      hash(two, {algorithm: 'passthrough', encoding: 'hex'})
    );
  });
});

describe('type marker (replaces the prototype-graph walk)', function() {
  it('instances of different constructors hash differently', function() {
    function Foo() { this.v = 1; }
    function Bar() { this.v = 1; }
    assert.notEqual(hash(new Foo()), hash(new Bar()));
  });

  it('a class instance differs from a plain object with the same data', function() {
    class Foo { constructor() { this.v = 1; } }
    assert.notEqual(hash(new Foo()), hash({v: 1}));
  });

  it('a null-prototype object differs from a plain object', function() {
    assert.notEqual(hash(Object.assign(Object.create(null), {v: 1})), hash({v: 1}));
  });

  it('same-named but different classes hash differently', function() {
    var A = (function() { function Foo() { this.v = 1; } return Foo; })();
    var B = (function() { function Foo() { this.v = 2; this.v = 1; } return Foo; })();
    assert.notEqual(hash(new A()), hash(new B()));
  });

  it('respectType: false ignores the constructor', function() {
    function Foo() { this.v = 1; }
    assert.equal(hash(new Foo(), {respectType: false}), hash({v: 1}, {respectType: false}));
  });

  it('foreign prototype getters are not invoked (upstream #49 family)', function() {
    function Doc() { this.id = 5; }
    var fired = false;
    Object.defineProperty(Doc.prototype, 'boom', {
      get: function() { fired = true; throw new Error('gotcha'); },
      enumerable: false
    });
    hash(new Doc());
    assert.equal(fired, false);
  });

  it('an ObjectID-like class with prototype getters hashes fine', function() {
    function ObjectID(id) { this.id = id; }
    Object.defineProperty(ObjectID.prototype, 'generationTime', {
      get: function() { return this.id[3] | (this.id[2] << 8); },
      enumerable: false
    });
    var one = hash({ref: new ObjectID([1, 2, 3, 4])});
    var two = hash({ref: new ObjectID([1, 2, 3, 5])});
    assert.ok(one && two);
    assert.notEqual(one, two);
  });
});
