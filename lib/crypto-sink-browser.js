'use strict';

// Browser build: compact md5 / sha1 / sha256 implementations instead of the
// ~10 KB (gzipped) crypto-browserify polyfill the original bundled
// (upstream #91). Digests are byte-identical to node:crypto — enforced by
// a fuzz test against it in test/browser-sink.js.
//
// Web Crypto is not an option here: subtle.digest() is async-only and md5
// is absent, while the whole point of this library is a synchronous hash.

var textEncoder = new TextEncoder();

exports.getHashes = function () {
  return ['md5', 'sha1', 'sha256'];
};

exports.createHasher = function (algorithm) {
  var chunks = [];
  var totalLength = 0;

  return {
    update: function (str) {
      var bytes = textEncoder.encode(str);
      chunks.push(bytes);
      totalLength += bytes.length;
    },
    updateBytes: function (bytes) {
      chunks.push(bytes);
      totalLength += bytes.length;
    },
    digest: function (encoding) {
      var message = new Uint8Array(totalLength);
      var offset = 0;
      for (var i = 0; i < chunks.length; i++) {
        message.set(chunks[i], offset);
        offset += chunks[i].length;
      }
      var digest = ALGORITHMS[algorithm](message);
      return encodeDigest(digest, encoding);
    }
  };
};

var ALGORITHMS = {
  md5: md5,
  sha1: sha1,
  sha256: sha256
};

var BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeDigest(digest, encoding) {
  var i, out;
  switch (encoding) {
  case 'buffer':
    return digest;
  case 'hex':
    out = '';
    for (i = 0; i < digest.length; i++) {
      out += (digest[i] < 16 ? '0' : '') + digest[i].toString(16);
    }
    return out;
  case 'binary':
    out = '';
    for (i = 0; i < digest.length; i++) {
      out += String.fromCharCode(digest[i]);
    }
    return out;
  case 'base64':
    out = '';
    for (i = 0; i + 2 < digest.length; i += 3) {
      var n = (digest[i] << 16) | (digest[i + 1] << 8) | digest[i + 2];
      out += BASE64_CHARS[n >> 18] + BASE64_CHARS[(n >> 12) & 63] + BASE64_CHARS[(n >> 6) & 63] + BASE64_CHARS[n & 63];
    }
    var rest = digest.length - i;
    if (rest === 1) {
      out += BASE64_CHARS[digest[i] >> 2] + BASE64_CHARS[(digest[i] & 3) << 4] + '==';
    } else if (rest === 2) {
      out += BASE64_CHARS[digest[i] >> 2] + BASE64_CHARS[((digest[i] & 3) << 4) | (digest[i + 1] >> 4)] + BASE64_CHARS[(digest[i + 1] & 15) << 2] + '=';
    }
    return out;
  default:
    throw new Error('Encoding "' + encoding + '" not supported in this build.');
  }
}

/**
 * Pad the message per MD5/SHA rules: 0x80, zeros, 64-bit bit length.
 * @param {Uint8Array} message the message to pad.
 * @param {Boolean} littleEndianLength true for md5, false for sha1/sha256.
 * @return {Uint8Array} the padded message, a multiple of 64 bytes.
 */
function pad(message, littleEndianLength) {
  var bitLengthLow = (message.length << 3) >>> 0;
  var bitLengthHigh = Math.floor(message.length / 0x20000000);
  var paddedLength = (Math.ceil((message.length + 9) / 64)) * 64;
  var padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;
  var view = new DataView(padded.buffer);
  if (littleEndianLength) {
    view.setUint32(paddedLength - 8, bitLengthLow, true);
    view.setUint32(paddedLength - 4, bitLengthHigh, true);
  } else {
    view.setUint32(paddedLength - 8, bitLengthHigh, false);
    view.setUint32(paddedLength - 4, bitLengthLow, false);
  }
  return padded;
}

var MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];
// K[i] = floor(abs(sin(i + 1)) * 2^32), the RFC 1321 definition
var MD5_K = (function () {
  var K = new Array(64);
  for (var i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  }
  return K;
})();

function md5(message) {
  var padded = pad(message, true);
  var view = new DataView(padded.buffer);
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (var block = 0; block < padded.length; block += 64) {
    var a = a0, b = b0, c = c0, d = d0, f, g;
    for (var i = 0; i < 64; i++) {
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + MD5_K[i] + view.getUint32(block + g * 4, true)) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((f << MD5_S[i]) | (f >>> (32 - MD5_S[i])))) | 0;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  var digest = new Uint8Array(16);
  var out = new DataView(digest.buffer);
  out.setUint32(0, a0 >>> 0, true);
  out.setUint32(4, b0 >>> 0, true);
  out.setUint32(8, c0 >>> 0, true);
  out.setUint32(12, d0 >>> 0, true);
  return digest;
}

function sha1(message) {
  var padded = pad(message, false);
  var view = new DataView(padded.buffer);
  var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  var w = new Int32Array(80);

  for (var block = 0; block < padded.length; block += 64) {
    var i;
    for (i = 0; i < 16; i++) {
      w[i] = view.getUint32(block + i * 4, false);
    }
    for (i = 16; i < 80; i++) {
      var n = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (n << 1) | (n >>> 31);
    }
    var a = h0, b = h1, c = h2, d = h3, e = h4, f, k;
    for (i = 0; i < 80; i++) {
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5A827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8F1BBCDC;
      } else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      var temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  var digest = new Uint8Array(20);
  var out = new DataView(digest.buffer);
  out.setUint32(0, h0 >>> 0, false);
  out.setUint32(4, h1 >>> 0, false);
  out.setUint32(8, h2 >>> 0, false);
  out.setUint32(12, h3 >>> 0, false);
  out.setUint32(16, h4 >>> 0, false);
  return digest;
}

var SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256(message) {
  var padded = pad(message, false);
  var view = new DataView(padded.buffer);
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var w = new Int32Array(64);

  for (var block = 0; block < padded.length; block += 64) {
    var i;
    for (i = 0; i < 16; i++) {
      w[i] = view.getUint32(block + i * 4, false);
    }
    for (i = 16; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      var s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
    for (i = 0; i < 64; i++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var temp1 = (k + S1 + ch + SHA256_K[i] + w[i]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;
      k = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + k) | 0;
  }

  var digest = new Uint8Array(32);
  var out = new DataView(digest.buffer);
  for (var j = 0; j < 8; j++) {
    out.setUint32(j * 4, h[j] >>> 0, false);
  }
  return digest;
}
