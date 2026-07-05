'use strict';

var cryptoSink = require('./lib/crypto-sink');

/**
 * Exported function
 *
 * Options:
 *
 *  - `algorithm` hash algo to be used by this instance: *'sha1', 'md5'
 *  - `excludeValues` {true|*false} hash object keys, values ignored
 *  - `encoding` hash encoding, supports 'buffer', '*hex', 'binary', 'base64'
 *  - `ignoreUnknown` {true|*false} ignore unknown object types
 *  - `replacer` optional function that replaces values before hashing
 *  - `respectFunctionProperties` {*true|false} consider function properties when hashing
 *  - `respectFunctionNames` {*true|false} consider 'name' property of functions for hashing
 *  - `respectType` {*true|false} Respect special properties (prototype, constructor)
 *    when hashing to distinguish between types
 *  - `unorderedArrays` {true|*false} Sort all arrays before hashing
 *  - `unorderedSets` {*true|false} Sort `Set` and `Map` instances before hashing
 *  * = default
 *
 * @param {object} object value to hash
 * @param {object} options hashing options
 * @return {string} hash value
 * @api public
 */
exports = module.exports = objectHash;

function objectHash(object, options){
  options = applyDefaults(object, options);

  return hash(object, options);
}

/**
 * Exported sugar methods
 *
 * @param {object} object value to hash
 * @return {string} hash value
 * @api public
 */
exports.sha1 = function(object){
  return objectHash(object);
};
exports.keys = function(object){
  return objectHash(object, {excludeValues: true, algorithm: 'sha1', encoding: 'hex'});
};
exports.MD5 = function(object){
  return objectHash(object, {algorithm: 'md5', encoding: 'hex'});
};
exports.keysMD5 = function(object){
  return objectHash(object, {algorithm: 'md5', encoding: 'hex', excludeValues: true});
};

// Internals
var hashes = cryptoSink.getHashes().slice();
hashes.push('passthrough');
var encodings = ['buffer', 'hex', 'binary', 'base64'];

function applyDefaults(object, sourceOptions){
  sourceOptions = sourceOptions || {};

  // create a copy rather than mutating
  var options = {};
  options.algorithm = sourceOptions.algorithm || 'sha1';
  options.encoding = sourceOptions.encoding || 'hex';
  options.excludeValues = sourceOptions.excludeValues ? true : false;
  options.algorithm = options.algorithm.toLowerCase();
  options.encoding = options.encoding.toLowerCase();
  options.ignoreUnknown = sourceOptions.ignoreUnknown !== true ? false : true; // default to false
  options.respectType = sourceOptions.respectType === false ? false : true; // default to true
  options.respectFunctionNames = sourceOptions.respectFunctionNames === false ? false : true;
  options.respectFunctionProperties = sourceOptions.respectFunctionProperties === false ? false : true;
  options.unorderedArrays = sourceOptions.unorderedArrays !== true ? false : true; // default to false
  options.unorderedSets = sourceOptions.unorderedSets === false ? false : true; // default to true
  options.unorderedObjects = sourceOptions.unorderedObjects === false ? false : true; // default to true
  options.replacer = sourceOptions.replacer || undefined;
  options.excludeKeys = sourceOptions.excludeKeys || undefined;

  if(typeof object === 'undefined') {
    throw new Error('Object argument required.');
  }

  // if there is a case-insensitive match in the hashes list, accept it
  // (i.e. SHA256 for sha256)
  for (var i = 0; i < hashes.length; ++i) {
    if (hashes[i].toLowerCase() === options.algorithm.toLowerCase()) {
      options.algorithm = hashes[i];
    }
  }

  if(hashes.indexOf(options.algorithm) === -1){
    throw new Error('Algorithm "' + options.algorithm + '"  not supported. ' +
      'supported values: ' + hashes.join(', '));
  }

  if(encodings.indexOf(options.encoding) === -1 &&
     options.algorithm !== 'passthrough'){
    throw new Error('Encoding "' + options.encoding + '"  not supported. ' +
      'supported values: ' + encodings.join(', '));
  }

  return options;
}

/** Check if the given function is a native function */
function isNativeFunction(f) {
  if ((typeof f) !== 'function') {
    return false;
  }
  var exp = /^function\s+\w*\s*\(\s*\)\s*{\s+\[native code\]\s+}$/i;
  return exp.exec(Function.prototype.toString.call(f)) !== null;
}

/**
 * A compact marker distinguishing what constructed the object: plain
 * objects, null-prototype objects and instances of different classes all
 * hash differently. User-defined constructors contribute their source, so
 * two same-named but different classes stay distinguishable; native ones
 * only their name (their source text varies between engines).
 * @param {Object} object the object being hashed.
 * @return {String} the marker.
 */
function typeMarker(object) {
  var proto = Object.getPrototypeOf(object);
  if (proto === null) {
    return 'type:null:';
  }
  var ctor = Object.prototype.hasOwnProperty.call(proto, 'constructor') ? proto.constructor : undefined;
  if (typeof ctor !== 'function') {
    return 'type:?:';
  }
  if (isNativeFunction(ctor)) {
    return 'type:' + ctor.name + ':';
  }
  var source = Function.prototype.toString.call(ctor);
  return 'type:' + ctor.name + ':' + source.length + ':' + source + ':';
}

function hash(object, options) {
  var hashingStream;

  if (options.algorithm !== 'passthrough') {
    hashingStream = cryptoSink.createHasher(options.algorithm);
  } else {
    hashingStream = new PassThrough();
  }

  var hasher = typeHasher(options, hashingStream);
  hasher.dispatch(object);

  if (hashingStream.digest) {
    return hashingStream.digest(options.encoding);
  }

  var buf = hashingStream.read();
  if (options.encoding === 'buffer') {
    return buf;
  }

  return buf.toString(options.encoding);
}

/**
 * Expose streaming API
 *
 * @param {object} object  Value to serialize
 * @param {object} options  Options, as for hash()
 * @param {object} stream  A stream to write the serializiation to
 * @api public
 */
exports.writeToStream = function(object, options, stream) {
  if (typeof stream === 'undefined') {
    stream = options;
    options = {};
  }

  options = applyDefaults(object, options);

  return typeHasher(options, stream).dispatch(object);
};

function typeHasher(options, writeTo, path){
  // `path` holds the ancestors of the value being dispatched — and only
  // them. The original kept every object ever seen, so a repeated (but non
  // circular) reference was serialized as [CIRCULAR:n] and [a, a] hashed
  // differently from [a, copyOfA] (upstream #78).
  path = path || [];
  var write = function(str) {
    if (writeTo.update) {
      return writeTo.update(str, 'utf8');
    } else {
      return writeTo.write(str, 'utf8');
    }
  };
  var writeBytes = function(bytes) {
    if (writeTo.updateBytes) {
      return writeTo.updateBytes(bytes);
    } else if (writeTo.update) {
      return writeTo.update(bytes);
    } else {
      return writeTo.write(bytes);
    }
  };
  // Buffer, Uint8Array, Uint8ClampedArray, ArrayBuffer and DataView with the
  // same bytes hash the same, in every environment (upstream #62). The
  // length prefix keeps the serialization prefix-free against the
  // surrounding utf8 writes.
  var dispatchBytes = function(bytes) {
    write('bytes:' + bytes.length + ':');
    return writeBytes(bytes);
  };

  return {
    dispatch: function(value){
      if (options.replacer) {
        value = options.replacer(value);
      }

      var type = typeof value;
      if (value === null) {
        type = 'null';
      }

      return this['_' + type](value);
    },
    _object: function(object) {
      var pattern = (/\[object (.*)\]/i);
      var objString = Object.prototype.toString.call(object);
      var objType = pattern.exec(objString);
      if (!objType) { // object type did not match [object ...]
        objType = 'unknown:[' + objString + ']';
      } else {
        objType = objType[1]; // take only the class name
      }

      objType = objType.toLowerCase();

      var objectNumber = path.indexOf(object);
      if (objectNumber >= 0) {
        return this.dispatch('[CIRCULAR:' + objectNumber + ']');
      }
      path.push(object);
      try {

        if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(object)) {
          return dispatchBytes(object);
        }

        if(objType !== 'object' && objType !== 'function' && objType !== 'asyncfunction') {
          if(this['_' + objType]) {
            this['_' + objType](object);
          } else if (options.ignoreUnknown) {
            return write('[' + objType + ']');
          } else {
            throw new Error('Unknown object type "' + objType + '"');
          }
        }else{
          var keys = Object.keys(object);
          if (options.unorderedObjects) {
            keys = keys.sort();
          }
          // Make sure objects derived from different constructors
          // (`new Foo`, `new Bar`) produce different hashes. The original
          // injected 'prototype', '__proto__' and 'constructor' as extra
          // keys and serialized the whole prototype graph on every call:
          // slow (half of the total time on plain objects), it fired
          // foreign getters (upstream #49) and its cross-reference markers
          // depended on the traversal order. A compact marker carries the
          // same information.
          if (options.respectType !== false && !isNativeFunction(object)) {
            write(typeMarker(object));
            // properties attached to fn.prototype distinguish constructors
            // (kept from the original behavior)
            if (typeof object === 'function' && object.prototype && typeof object.prototype === 'object') {
              write('fn-prototype:' + Object.keys(object.prototype).length + ':');
              this.dispatch(Object.keys(object.prototype).sort().map(function (key) {
                return [key, object.prototype[key]];
              }));
            }
          }

          if (options.excludeKeys) {
            keys = keys.filter(function(key) { return !options.excludeKeys(key); });
          }

          write('object:' + keys.length + ':');
          var self = this;
          return keys.forEach(function(key){
            self.dispatch(key);
            write(':');
            if(!options.excludeValues) {
              self.dispatch(object[key]);
            }
            write(',');
          });
        }

      } finally {
        path.pop();
      }
    },
    _array: function(arr, unordered){
      unordered = typeof unordered !== 'undefined' ? unordered :
        options.unorderedArrays !== false; // default to options.unorderedArrays

      var self = this;
      write('array:' + arr.length + ':');
      if (!unordered || arr.length <= 1) {
        return arr.forEach(function(entry) {
          return self.dispatch(entry);
        });
      }

      // the unordered case is a little more complicated:
      // since there is no canonical ordering on objects,
      // i.e. {a:1} < {a:2} and {a:1} > {a:2} are both false,
      // we first serialize each entry to a string before sorting.
      // the entries only share the ancestors in `path`: what an entry
      // pushes there is popped before the next entry is serialized, so the
      // order of hashing cannot matter.
      var entries = arr.map(function(entry) {
        var strm = new PassThrough();
        var hasher = typeHasher(options, strm, path.slice());
        hasher.dispatch(entry);
        return strm.read();
      });
      entries.sort();
      return this._array(entries, false);
    },
    _date: function(date){
      return write('date:' + date.toJSON());
    },
    _symbol: function(sym){
      return write('symbol:' + sym.toString());
    },
    _error: function(err){
      return write('error:' + err.toString());
    },
    _boolean: function(bool){
      return write('bool:' + bool.toString());
    },
    _string: function(string){
      write('string:' + string.length + ':');
      write(string.toString());
    },
    _function: function(fn){
      write('fn:');
      if (isNativeFunction(fn)) {
        this.dispatch('[native]');
      } else {
        this.dispatch(fn.toString());
      }

      if (options.respectFunctionNames !== false) {
        // Make sure we can still distinguish native functions
        // by their name, otherwise String and Function will
        // have the same hash
        this.dispatch("function-name:" + String(fn.name));
      }

      if (options.respectFunctionProperties) {
        this._object(fn);
      }
    },
    _number: function(number){
      return write('number:' + number.toString());
    },
    _xml: function(xml){
      return write('xml:' + xml.toString());
    },
    _null: function() {
      return write('Null');
    },
    _undefined: function() {
      return write('Undefined');
    },
    _regexp: function(regex){
      return write('regex:' + regex.toString());
    },
    _uint8array: function(arr){
      return dispatchBytes(arr);
    },
    _uint8clampedarray: function(arr){
      return dispatchBytes(arr);
    },
    _int8array: function(arr){
      write('int8array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint16array: function(arr){
      write('uint16array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _int16array: function(arr){
      write('int16array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint32array: function(arr){
      write('uint32array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _int32array: function(arr){
      write('int32array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _float32array: function(arr){
      write('float32array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _float64array: function(arr){
      write('float64array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _arraybuffer: function(arr){
      return dispatchBytes(new Uint8Array(arr));
    },
    _dataview: function(view){
      return dispatchBytes(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    },
    _url: function(url) {
      return write('url:' + url.toString());
    },
    _map: function(map) {
      write('map:');
      var arr = Array.from(map);
      return this._array(arr, options.unorderedSets !== false);
    },
    _set: function(set) {
      write('set:');
      var arr = Array.from(set);
      return this._array(arr, options.unorderedSets !== false);
    },
    _file: function(file) {
      write('file:');
      return this.dispatch([file.name, file.size, file.type, file.lastModfied]);
    },
    _blob: function() {
      if (options.ignoreUnknown) {
        return write('[blob]');
      }

      throw Error('Hashing Blob objects is currently not supported\n' +
        '(see https://github.com/puleos/object-hash/issues/26)\n' +
        'Use "options.replacer" or "options.ignoreUnknown"\n');
    },
    _domwindow: function() { return write('domwindow'); },
    _bigint: function(number){
      return write('bigint:' + number.toString());
    },
    /* Node.js standard native objects */
    _process: function() { return write('process'); },
    _timer: function() { return write('timer'); },
    _pipe: function() { return write('pipe'); },
    _tcp: function() { return write('tcp'); },
    _udp: function() { return write('udp'); },
    _tty: function() { return write('tty'); },
    _statwatcher: function() { return write('statwatcher'); },
    _securecontext: function() { return write('securecontext'); },
    _connection: function() { return write('connection'); },
    _zlib: function() { return write('zlib'); },
    _context: function() { return write('context'); },
    _nodescript: function() { return write('nodescript'); },
    _httpparser: function() { return write('httpparser'); },
    _signal: function() { return write('signal'); },
    _fsevent: function() { return write('fsevent'); },
    _tlswrap: function() { return write('tlswrap'); },
  };
}

// Mini-implementation of stream.PassThrough
// We are far from having need for the full implementation, and we can
// make assumptions like "many writes, then only one final read"
// and we can ignore encoding specifics
function PassThrough() {
  return {
    buf: '',

    write: function(b) {
      this.buf += toPassThroughString(b);
    },

    end: function(b) {
      this.buf += toPassThroughString(b);
    },

    read: function() {
      return this.buf;
    }
  };
}

// Bytes are folded into the passthrough string as latin1: lossless and
// deterministic. The original coerced Buffers with their utf8 toString(),
// where every invalid sequence collapsed to U+FFFD — distinct buffers could
// produce identical serializations.
function toPassThroughString(b) {
  if (typeof b === 'string') {
    return b;
  }
  var str = '';
  for (var i = 0; i < b.length; i++) {
    str += String.fromCharCode(b[i]);
  }
  return str;
}
