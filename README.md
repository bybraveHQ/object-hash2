# @bybrave/object-hash2

[![CI](https://github.com/bybraveHQ/object-hash2/actions/workflows/ci.yml/badge.svg)](https://github.com/bybraveHQ/object-hash2/actions)
[![npm](https://img.shields.io/npm/v/%40bybrave%2Fobject-hash2)](https://www.npmjs.com/package/@bybrave/object-hash2)

Maintained fork of [object-hash](https://github.com/puleos/object-hash) — generate hashes from any javascript value, in Node.js and the browser.

The original has ~320M downloads/month and no release since 2022. This fork keeps the same API and fixes what was broken underneath: repeated references, browser/node divergence, the prototype-graph walk that halved performance.

```bash
npm install @bybrave/object-hash2
```

```js
// CommonJS — drop-in
const hash = require("@bybrave/object-hash2");

// ESM
import hash from "@bybrave/object-hash2";

hash({ foo: "bar" });                       // 'a02...'
hash({ foo: "bar" }, { algorithm: "md5" }); // '132...'
hash.keys({ foo: "bar" });                  // keys only
```

Same options as the original: `algorithm`, `encoding`, `excludeValues`, `excludeKeys`, `replacer`, `respectType`, `respectFunctionProperties`, `respectFunctionNames`, `unorderedArrays`, `unorderedSets`, `unorderedObjects`, `ignoreUnknown` — see the [original documentation](https://github.com/puleos/object-hash#hashvalue-options).

## What's different from object-hash 3.0.0

| Change | Original issue |
|---|---|
| Repeated (non-circular) references hash like copies: `hash([a, a]) === hash([[1,2], [1,2]])`. Real cycles are still detected | [#78](https://github.com/puleos/object-hash/issues/78) |
| Identical hashes in Node.js and the browser, byte for byte — the browser build runs the same serializer with own md5/sha1/sha256 (fuzz-checked against `node:crypto`) | [#62](https://github.com/puleos/object-hash/issues/62) |
| Browser bundle 4.5 KB gzipped instead of ~10 KB (no more `crypto-browserify`) | [#91](https://github.com/puleos/object-hash/issues/91) |
| ~2x faster with default options: the `respectType` prototype-graph walk replaced with a compact type marker | perf reports |
| `respectType` no longer reads `__proto__`/`constructor`/`prototype` of foreign objects — no more crashes on classes with throwing prototype getters (Mongo `ObjectID` & co) | [#49](https://github.com/puleos/object-hash/issues/49) |
| `Buffer`, `Uint8Array`, `Uint8ClampedArray`, `ArrayBuffer` and `DataView` with the same bytes hash the same | — |
| `DataView` hashes by content (the original hashed every `DataView` to the same constant) | — |
| TypeScript definitions shipped with the package (compatible with `@types/object-hash`) | — |
| ESM entry (`import hash from "@bybrave/object-hash2"`) + `exports` map | — |
| Build: esbuild instead of gulp + browserify; CI on Node 18/20/22; zero runtime dependencies (as before) | — |

## Hash compatibility with 3.x — read before upgrading

This is a major release and **some hashes change**. If you persist hashes (cache keys, deduplication), regenerate them on upgrade — the original did the same in its 2.x → 3.x major.

Unchanged (byte-identical to 3.0.0, pinned by tests):

- primitives, strings, dates, regexps, URLs, errors, symbols, bigints, numeric typed arrays — with any options;
- **everything hashed with `respectType: false`**, as long as the value has no repeated references and no binary types listed below.

Changed:

- default-options hashes of values containing objects or functions (`respectType: true` used to serialize the whole prototype graph — that walk is now a compact marker);
- values with repeated references (that's the [#78](https://github.com/puleos/object-hash/issues/78) fix);
- `Buffer` / `Uint8Array` / `Uint8ClampedArray` / `ArrayBuffer` / `DataView` values (unified byte serialization, identical across platforms);
- hashes produced in the browser (they now match Node.js — that's the point).

## Migrating from object-hash

```diff
- const hash = require('object-hash');
+ const hash = require('@bybrave/object-hash2');
```

The API is identical; `@types/object-hash` is no longer needed (types ship with the package). If you persist hashes, read the compatibility section above: regenerate stored hashes on upgrade, or use `respectType: false` where you need values byte-identical to 3.x. Node.js ≥ 18.

## Compatibility

- API is unchanged — drop-in replacement for `object-hash`: `hash()`, `hash.sha1()`, `hash.keys()`, `hash.MD5()`, `hash.keysMD5()`, `hash.writeToStream()`.
- Node.js ≥ 18; modern browsers. Browser algorithms: `md5`, `sha1`, `sha256` (+ `passthrough`); in Node.js everything from `crypto.getHashes()`.
- Browser `<script>` builds: `dist/object_hash.js` and `dist/object_hash.min.js` (global `objectHash`), shipped in the npm package.

## Support

If this package saves you time, you can support maintenance:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-buy%20me%20a%20coffee-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/bybrave)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-BTC-F7931A?logo=bitcoin&logoColor=white)](#support)

Bitcoin (BTC): `bc1q37557q5jpeaxqydzwvf3jgj7zhnfpn2td3q40q`

## Credits & license

MIT, same as the original — see [LICENSE](./LICENSE).
Based on [object-hash](https://github.com/puleos/object-hash) by Scott Puleo and contributors.
