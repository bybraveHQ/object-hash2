"use strict";

// Throughput comparison against the original (run `npm i --no-save object-hash`
// first to include it).

const fork = require("../index.js");

let original = null;
try {
    original = require("object-hash");
} catch (e) {
    console.log("object-hash not installed, benchmarking the fork only\n");
}

const small = {id: 123, name: "test", active: true};
const medium = {
    user: {id: 123, name: "test", tags: ["a", "b", "c"], meta: {created: new Date(0), scores: [1, 2, 3, 4, 5]}},
    active: true,
};
const large = {items: Array.from({length: 100}, (_, i) => ({id: i, name: "item" + i, tags: ["x", "y"], nested: {v: i * 2}}))};

function bench(label, fn, iterations) {
    for (let i = 0; i < 1000; i++) fn(); // warmup
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) fn();
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const ops = Math.round(iterations / seconds);
    console.log(`  ${label}: ${ops.toLocaleString("en-US")} ops/s`);
    return ops;
}

for (const [name, obj, iterations] of [["small", small, 100000], ["medium", medium, 30000], ["large", large, 2000]]) {
    for (const options of [{}, {respectType: false}]) {
        console.log(`${name} ${JSON.stringify(options)}`);
        const forkOps = bench("@bybrave/object-hash2", () => fork(obj, options), iterations);
        if (original) {
            const origOps = bench("object-hash@3.0.0   ", () => original(obj, options), iterations);
            console.log(`  ratio: ${(forkOps / origOps).toFixed(2)}x`);
        }
    }
}
