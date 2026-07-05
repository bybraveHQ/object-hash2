'use strict';

var describe = require('node:test').describe;
var it = require('node:test').it;

var assert = require('assert');
var crypto = require('crypto');
var browserSink = require('../lib/crypto-sink-browser');

// The browser build must produce byte-identical digests to node:crypto —
// that IS the upstream #62 fix. Fuzzed here against the real thing.
describe('browser crypto sink', function() {
  var algorithms = ['md5', 'sha1', 'sha256'];
  var encodings = ['hex', 'base64', 'binary', 'buffer'];

  function reference(algorithm, chunks, encoding) {
    var h = crypto.createHash(algorithm);
    chunks.forEach(function(chunk) {
      if (typeof chunk === 'string') {
        h.update(chunk, 'utf8');
      } else {
        h.update(chunk);
      }
    });
    return encoding === 'buffer' ? h.digest() : h.digest(encoding);
  }

  function ours(algorithm, chunks, encoding) {
    var h = browserSink.createHasher(algorithm);
    chunks.forEach(function(chunk) {
      if (typeof chunk === 'string') {
        h.update(chunk);
      } else {
        h.updateBytes(chunk);
      }
    });
    return h.digest(encoding);
  }

  it('matches node:crypto on block-boundary lengths', function() {
    [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 255, 1000, 65536].forEach(function(len) {
      var bytes = crypto.randomBytes(len);
      algorithms.forEach(function(algorithm) {
        assert.equal(
          ours(algorithm, [bytes], 'hex'),
          reference(algorithm, [bytes], 'hex'),
          algorithm + ' @ ' + len + ' bytes'
        );
      });
    });
  });

  it('matches node:crypto on 300 random inputs across all encodings', function() {
    for (var i = 0; i < 300; i++) {
      var bytes = crypto.randomBytes(Math.floor(Math.random() * 300));
      var algorithm = algorithms[i % algorithms.length];
      var encoding = encodings[i % encodings.length];
      var mine = ours(algorithm, [bytes], encoding);
      var ref = reference(algorithm, [bytes], encoding);
      if (encoding === 'buffer') {
        assert.ok(ref.equals(Buffer.from(mine)), algorithm + '/' + encoding + ' @ ' + bytes.length);
      } else {
        assert.equal(mine, ref, algorithm + '/' + encoding + ' @ ' + bytes.length);
      }
    }
  });

  it('matches node:crypto on utf8 strings and mixed multi-part input', function() {
    var cases = [
      [''],
      ['hello world'],
      ['привет ζ 🎉'],
      [new Array(100).join('long unicode ζζζ 🎉')],
      ['part1:', crypto.randomBytes(10), 'part2 🎉', crypto.randomBytes(100)]
    ];
    cases.forEach(function(chunks) {
      algorithms.forEach(function(algorithm) {
        assert.equal(ours(algorithm, chunks, 'hex'), reference(algorithm, chunks, 'hex'));
      });
    });
  });

  it('advertises exactly the supported algorithms', function() {
    assert.deepEqual(browserSink.getHashes(), ['md5', 'sha1', 'sha256']);
  });
});
