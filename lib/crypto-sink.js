'use strict';

// Node build: hashing is delegated to the native node:crypto. The browser
// build replaces this file with crypto-sink-browser.js (see the "browser"
// field in package.json), which produces byte-identical digests.
var crypto = require('crypto');

exports.getHashes = function () {
  return crypto.getHashes();
};

exports.createHasher = function (algorithm) {
  var hash = crypto.createHash(algorithm);
  return {
    update: function (str) {
      hash.update(str, 'utf8');
    },
    updateBytes: function (bytes) {
      hash.update(bytes);
    },
    digest: function (encoding) {
      if (encoding === 'buffer') {
        return hash.digest();
      }
      return hash.digest(encoding);
    }
  };
};
