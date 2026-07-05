'use strict';

var describe = require('node:test').describe;
var it = require('node:test').it;

var assert = require('assert');
var hash = require('../index');

// The compatibility contract with object-hash@3.0.0, pinned by hashes
// generated with the original (see golden-3.0.0.json):
//
// - primitives, dates, regexps, URLs, errors, typed arrays (except the
//   byte-based ones), empty arrays: identical with any options;
// - everything hashed with respectType: false: identical, unless the value
//   contains repeated references (the upstream #78 fix), Buffers,
//   Uint8Arrays, ArrayBuffers or DataViews (the upstream #62 fix);
// - default-options hashes of values containing objects or functions:
//   CHANGED in v4 (documented in the README) — the prototype-graph walk
//   was replaced with a compact type marker.
var golden = require('./golden-3.0.0.json');

describe('compatibility with object-hash@3.0.0', function() {
  var corpus = {
    string: 'hello world',
    unicode: 'привет ζ 🎉',
    emptyString: '',
    number: 42,
    float: 3.14159,
    negZero: -0,
    inf: Infinity,
    nan: NaN,
    bool: true,
    nul: null,
    bigint: BigInt('12345678901234567890'),
    date: new Date('2020-02-20T12:00:00.000Z'),
    regexp: /abc/gi,
    symbol: Symbol('test'),
    emptyArr: [],
    url: new URL('https://example.com/path?q=1'),
    int16: new Int16Array([1, -2, 3]),
    float32: new Float32Array([1.5, -2.5]),
    float64: new Float64Array([1.123456789]),
    int32: new Int32Array([100000, -200000]),
    uint16: new Uint16Array([65535, 0]),
    uint32: new Uint32Array([4294967295]),
    int8: new Int8Array([-128, 127]),
    err: new Error('boom'),
  };
  // values whose *default* hash intentionally changed in v4 (they contain
  // objects or functions, so the type marker replaces the prototype walk);
  // their respectType: false hashes are still identical to 3.0.0.
  var objectCorpus = {
    fn: function named(a, b) { return a + b; },
    arrow: (x) => x * 2,
    arr: [1, 'two', [3, [4]], {five: 5}],
    emptyObj: {},
    obj: {b: 2, a: 1, nested: {x: [1, 2, 3], y: null}},
    map: new Map([['k1', 1], ['k2', {v: 2}]]),
    set: new Set([1, 'a', {b: 2}]),
  };

  it('hashes plain values exactly like 3.0.0, with any options', function() {
    Object.keys(corpus).forEach(function(key) {
      var value = corpus[key];
      assert.equal(hash(value), golden[key].sha1, key + ' (default)');
      assert.equal(hash(value, {algorithm: 'md5'}), golden[key].md5, key + ' (md5)');
      assert.equal(hash(value, {unorderedArrays: true}), golden[key].unordered, key + ' (unorderedArrays)');
      assert.equal(hash(value, {respectType: false}), golden[key].noRespectType, key + ' (respectType: false)');
      assert.equal(hash(value, {encoding: 'base64'}), golden[key].base64, key + ' (base64)');
    });
  });

  it('hashes objects exactly like 3.0.0 under respectType: false', function() {
    Object.keys(objectCorpus).forEach(function(key) {
      assert.equal(hash(objectCorpus[key], {respectType: false}), golden[key].noRespectType, key);
    });
  });

  it('default hashes of values containing objects differ from 3.0.0 (documented v4 break)', function() {
    Object.keys(objectCorpus).forEach(function(key) {
      assert.notEqual(hash(objectCorpus[key]), golden[key].sha1, key);
    });
  });
});
