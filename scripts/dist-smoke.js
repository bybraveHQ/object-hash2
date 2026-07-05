"use strict";

// Smoke test for the browser bundles: evaluates dist/object_hash(.min).js in
// a scope without `require` or `Buffer` (like a <script> tag) and checks
// that the digests are byte-identical to the node build — which is the
// whole point of the upstream #62 fix.

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const nodeHash = require("../index.js");

const corpus = [
    "hello world",
    "привет ζ 🎉",
    42,
    true,
    null,
    {b: 2, a: 1, nested: {x: [1, 2, 3], y: null, d: new Date(0)}},
    [1, "two", [3, [4]], {five: 5}],
    new Map([["k", 1]]),
    new Set([3, 1, 2]),
    new Uint8Array([1, 2, 3, 255]),
    new Float64Array([1.5, -2.5]),
];

function testBundle(file) {
    const code = fs.readFileSync(path.join(__dirname, "..", "dist", file), "utf8");
    // no require, no Buffer: the bundle must not depend on either
    const browserHash = new Function("require", "Buffer", "module", "exports", `${code}; return objectHash;`)();

    for (const value of corpus) {
        for (const options of [{}, {algorithm: "md5"}, {algorithm: "sha256"}, {respectType: false}, {unorderedArrays: true}, {encoding: "base64"}, {encoding: "binary"}]) {
            const label = `${file}: ${JSON.stringify(options)} of ${Object.prototype.toString.call(value)}`;
            assert.strictEqual(browserHash(value, options), nodeHash(value, options), label);
        }
    }

    // buffer encoding: Uint8Array in the browser, byte-equal to node
    const bytes = browserHash({x: 1}, {encoding: "buffer"});
    assert.ok(bytes instanceof Uint8Array, `${file}: buffer encoding returns bytes`);
    assert.strictEqual(Buffer.from(bytes).toString("hex"), nodeHash({x: 1}, {encoding: "buffer"}).toString("hex"), `${file}: buffer bytes match node`);

    // unsupported algorithm fails with the algorithms list
    assert.throws(() => browserHash({x: 1}, {algorithm: "sha512"}), /not supported.*md5, sha1, sha256/s, `${file}: unsupported algorithm error`);

    // Buffer-typed input hashes like Uint8Array (checked in node build too)
    assert.strictEqual(browserHash(new Uint8Array([7, 7])), nodeHash(Buffer.from([7, 7])), `${file}: bytes unification`);

    console.log(`${file} OK`);
}

testBundle("object_hash.js");
testBundle("object_hash.min.js");
