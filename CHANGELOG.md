# Changelog

Maintained fork of [puleos/object-hash](https://github.com/puleos/object-hash).

## 4.0.0 — 2026-07-05

First release of the fork. Same API as `object-hash` 3.0.0, fixed internals. Some default-option hashes change vs 3.x (this is why it's a major) — everything hashed with `respectType: false`, and primitives with any options, stay byte-identical to 3.0.0, pinned by a golden fixture. See the README for the full compatibility note.

### Added

- ESM entry with an `exports` map, bundled TypeScript definitions, and zero runtime dependencies.
- Own `md5`/`sha1`/`sha256` implementations in the browser build, fuzz-checked byte-identical to `node:crypto`.
- Browser bundle down to 4.5 KB gzipped instead of ~10 KB by dropping `crypto-browserify` ([#91](https://github.com/puleos/object-hash/issues/91)).
- ~2x faster with default options: the prototype-graph walk is replaced by a compact type marker with the same distinguishing power.

### Fixed

- Repeated (non-circular) references ([#78](https://github.com/puleos/object-hash/issues/78)): cycle detection now uses the ancestor stack instead of a global seen-list, so `hash([a, a]) === hash([[1,2], [1,2]])` and real cycles are still detected deterministically.
- Browser/Node divergence ([#62](https://github.com/puleos/object-hash/issues/62)): the browser build runs the exact same serializer, producing byte-identical hashes to the Node build.
- Foreign prototype getters ([#49](https://github.com/puleos/object-hash/issues/49) family): `respectType` no longer walks `__proto__`/`constructor`/`prototype` of hashed objects, so classes with throwing getters (e.g. Mongo `ObjectID`) hash fine.
- `DataView` is now hashed by content (previously every `DataView` collided to a single constant); `Buffer`/`Uint8Array`/`ArrayBuffer`/`DataView` with equal bytes now hash equal.
