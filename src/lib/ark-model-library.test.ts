import assert from "node:assert/strict";
import test from "node:test";
import {arkExtent, finalStatus, ModelFileError, retrySeconds, worthAskingAgain} from "@/ark-scene/model-files";
import {ModelLibrary} from "@/ark-scene/models";

// The model set's files, and what a failed read does (graphics pass 2026-11-14, the animal models lane): a file that
// only failed to arrive is asked for again and never answered with the placeholder figure; the far level always comes
// first; the model's size is its ark.json's, the same for both levels.

test("model files: which failures are final, and the waits before asking again", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 9].map(retrySeconds), [1, 3, 8, 20, 30, 30]);
    assert.equal(retrySeconds(0), 1);
    // The bucket answers 400 (or 404) for a file it does not hold: final. A timeout, a busy or a failing server: not.
    assert.deepEqual([400, 404, 403, 410].map(finalStatus), [true, true, true, true]);
    assert.deepEqual([408, 425, 429, 500, 502, 503, 504, 200].map(finalStatus), [false, false, false, false, false, false, false, false]);
    assert.equal(worthAskingAgain(new TypeError("Failed to fetch")), true, "a dropped connection");
    assert.equal(worthAskingAgain(new ModelFileError("HTTP 503", false)), true);
    assert.equal(worthAskingAgain(new ModelFileError("HTTP 400", true)), false);
    assert.equal(worthAskingAgain(new ModelFileError("no mesh", true)), false);
});

test("model files: the size in ark.json", () => {
    assert.deepEqual(arkExtent({extent: [0.2512, 0.6328, 1]}), {x: 0.2512, y: 0.6328, z: 1});
    for (const bad of [null, {}, {extent: [1, 2]}, {extent: [1, 0, 1]}, {extent: [1, "2", 3]}, {extent: [1, NaN, 1]}, {extent: "1,2,3"}]) assert.equal(arkExtent(bad), null);
});

/** A one-triangle GLB, `length` long (z), a fifth as wide and high. */
function glb(length: number): ArrayBuffer {
    const positions = new Float32Array([0, 0, 0, 0.2 * length, 0, 0, 0, 0.2 * length, length]);
    const indices = new Uint16Array([0, 1, 2, 0]);
    const bin = new Uint8Array(positions.byteLength + indices.byteLength);
    bin.set(new Uint8Array(positions.buffer), 0);
    bin.set(new Uint8Array(indices.buffer), positions.byteLength);
    const json = {
        asset: {version: "2.0"},
        scene: 0,
        scenes: [{nodes: [0]}],
        nodes: [{mesh: 0}],
        meshes: [{primitives: [{attributes: {POSITION: 0}, indices: 1}]}],
        accessors: [
            {bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [0.2 * length, 0.2 * length, length]},
            {bufferView: 1, componentType: 5123, count: 3, type: "SCALAR"}
        ],
        bufferViews: [{buffer: 0, byteOffset: 0, byteLength: positions.byteLength}, {buffer: 0, byteOffset: positions.byteLength, byteLength: 6}],
        buffers: [{byteLength: bin.byteLength}]
    };
    let text = JSON.stringify(json);
    while (text.length % 4) text += " ";
    const jsonBytes = new TextEncoder().encode(text);
    const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
    const out = new ArrayBuffer(total);
    const view = new DataView(out);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, jsonBytes.byteLength, true);
    view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(out, 20, jsonBytes.byteLength).set(jsonBytes);
    view.setUint32(20 + jsonBytes.byteLength, bin.byteLength, true);
    view.setUint32(24 + jsonBytes.byteLength, 0x004e4942, true);
    new Uint8Array(out, 28 + jsonBytes.byteLength, bin.byteLength).set(bin);
    return out;
}

type Answer = () => Response | Promise<Response>;
const ARK_JSON = {behaviour: {plan: "mammal"}, extent: [0.2, 0.3, 1], slug: "cat"};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A bucket: each file's answers in turn (the last one repeats); every request is noted. */
async function withBucket(files: Record<string, Answer[]>, run: (library: ModelLibrary, asked: string[]) => Promise<void>, concurrency = 3): Promise<void> {
    const holder = globalThis as unknown as {fetch: typeof fetch};
    const real = holder.fetch;
    const asked: string[] = [];
    const turns = new Map<string, number>();
    const warn = console.warn;
    console.warn = () => undefined;
    holder.fetch = (async (input: unknown) => {
        const url = String(input);
        const name = url.replace("http://bucket/ark/", "");
        asked.push(name);
        const answers = files[name];
        if (!answers) return new Response("{}", {status: 400});
        const turn = turns.get(name) ?? 0;
        turns.set(name, turn + 1);
        return answers[Math.min(turn, answers.length - 1)]();
    }) as typeof fetch;
    const library = new ModelLibrary("http://bucket/ark", concurrency);
    try {
        await run(library, asked);
    } finally {
        library.dispose();
        holder.fetch = real;
        console.warn = warn;
    }
}

const ok = (body: ArrayBuffer | object): Answer => () => (body instanceof ArrayBuffer ? new Response(body.slice(0), {status: 200}) : new Response(JSON.stringify(body), {status: 200}));
const dropped: Answer = () => {
    throw new TypeError("Failed to fetch");
};
const status = (code: number): Answer => () => new Response("{}", {status: code});
const late = (ms: number, answer: Answer): Answer => async () => {
    await sleep(ms);
    return answer();
};
const MANIFEST = ok({models: {cat: "v"}});
const settled = async (library: ModelLibrary) => {
    for (let i = 0; i < 400 && library.busy; i++) await sleep(5);
    await sleep(5);
};

test("model library: a manifest that fails to arrive is read again; no species becomes the placeholder", async () => {
    await withBucket({"manifest.json": [dropped, status(503), MANIFEST], "cat/v.far.glb": [ok(glb(1))], "cat/v.ark.json": [ok(ARK_JSON)]}, async (library, asked) => {
        library.request("cat", "far");
        await sleep(300);
        assert.equal(library.has("cat"), false, "not in yet: nothing is drawn as a model (the animals are their icons)");
        assert.equal(library.placeholderCount, 0);
        const manifest = await library.ready();
        assert.equal(manifest?.models.cat, "v");
        await settled(library);
        assert.equal(asked.filter((name) => name === "manifest.json").length, 3);
        assert.equal(library.get("cat")?.placeholder, undefined);
        assert.ok(library.get("cat")?.far, "the level asked for meanwhile loads once the manifest is in");
    });
});

test("model library: a far level that fails to arrive is asked for again after a wait, never the placeholder", async () => {
    await withBucket({"manifest.json": [MANIFEST], "cat/v.far.glb": [dropped, ok(glb(1))], "cat/v.ark.json": [ok(ARK_JSON)]}, async (library, asked) => {
        await library.ready();
        library.request("cat", "far");
        await settled(library);
        assert.equal(library.get("cat"), undefined, "no model yet: drawn as its icon");
        assert.equal(library.placeholderCount, 0);
        library.request("cat", "far");
        await settled(library);
        assert.equal(asked.filter((name) => name === "cat/v.far.glb").length, 1, "not before its wait is over");
        await sleep(1050);
        library.request("cat", "far");
        await settled(library);
        const model = library.get("cat");
        assert.ok(model?.far && !model.placeholder);
        assert.equal(model.behaviour?.plan, "mammal");
    });
});

test("model library: an ark.json that fails to arrive fails the level (asked again), not the species' body plan for the visit", async () => {
    await withBucket({"manifest.json": [MANIFEST], "cat/v.far.glb": [ok(glb(1))], "cat/v.ark.json": [status(503), ok(ARK_JSON)]}, async (library) => {
        await library.ready();
        library.request("cat", "far");
        await settled(library);
        assert.equal(library.get("cat"), undefined);
        await sleep(1050);
        library.request("cat", "far");
        await settled(library);
        assert.equal(library.get("cat")?.behaviour?.plan, "mammal");
    });
});

test("model library: a near level that fails to arrive leaves the far model and is asked for again", async () => {
    await withBucket({"manifest.json": [MANIFEST], "cat/v.far.glb": [ok(glb(1))], "cat/v.near.glb": [status(502), ok(glb(1))], "cat/v.ark.json": [ok(ARK_JSON)]}, async (library) => {
        await library.ready();
        library.request("cat", "near");
        await settled(library);
        assert.ok(library.get("cat")?.far);
        assert.equal(library.get("cat")?.near, null);
        assert.equal(library.get("cat")?.placeholder, undefined);
        await sleep(1050);
        library.request("cat", "near");
        await settled(library);
        assert.ok(library.get("cat")?.near);
    });
});

test("model library: a file that is not there is final: the other level stands in, and only a species with neither is the placeholder", async () => {
    // No far file: the near mesh at every distance.
    await withBucket({"manifest.json": [MANIFEST], "cat/v.near.glb": [ok(glb(1))], "cat/v.ark.json": [ok(ARK_JSON)]}, async (library, asked) => {
        await library.ready();
        library.request("cat", "far");
        await settled(library);
        const model = library.get("cat");
        assert.ok(model?.near && model.far && !model.placeholder, "the near level was asked for and stands in");
        assert.notEqual(model.far.geometry, model.near.geometry, "its own copy of the mesh");
        assert.equal(library.evict("cat", "near"), false, "and is never let go");
        library.request("cat", "far");
        await settled(library);
        assert.equal(asked.filter((name) => name === "cat/v.far.glb").length, 1, "never asked for again");
    });
    // No near file: the far model close up, as before.
    await withBucket({"manifest.json": [MANIFEST], "cat/v.far.glb": [ok(glb(1))], "cat/v.ark.json": [ok(ARK_JSON)]}, async (library) => {
        await library.ready();
        library.request("cat", "near");
        await settled(library);
        assert.ok(library.get("cat")?.far && !library.get("cat")?.near && !library.get("cat")?.placeholder);
    });
    // Neither: the placeholder figure (A13). A file that is not a model counts as not there.
    await withBucket({"manifest.json": [MANIFEST], "cat/v.near.glb": [ok({not: "a model"})]}, async (library) => {
        await library.ready();
        library.request("cat", "near");
        await settled(library);
        assert.equal(library.get("cat")?.placeholder, true);
        assert.equal(library.placeholderCount, 1);
    });
    // Not in the manifest at all: the placeholder at once, as before.
    await withBucket({"manifest.json": [MANIFEST]}, async (library) => {
        await library.ready();
        library.request("dodo", "far");
        await settled(library);
        assert.equal(library.get("dodo")?.placeholder, true);
    });
});

test("model library: the far level first, whichever file arrives first; the size is the ark.json's for both", async () => {
    // The far mesh has lost its thin parts (0.6 long where the source is 1); the near file arrives well before it.
    await withBucket({"manifest.json": [MANIFEST], "cat/v.far.glb": [late(120, ok(glb(0.6)))], "cat/v.near.glb": [ok(glb(0.98))], "cat/v.ark.json": [ok(ARK_JSON)]}, async (library) => {
        await library.ready();
        const order: string[] = [];
        library.onLoad = (slug) => {
            const model = library.get(slug);
            order.push(`${model?.far ? "far" : ""}${model?.near ? "+near" : ""}:${model?.behaviour?.plan ?? "no plan"}`);
        };
        library.request("cat", "near");
        await sleep(60);
        assert.equal(library.get("cat"), undefined, "the near level waits for the far one");
        await settled(library);
        assert.deepEqual(order, ["far:mammal", "far+near:mammal"], "never a model without its body plan");
        const model = library.get("cat")!;
        assert.equal(model.bodyLength, 1, "measured on the source's extent, not on the far mesh (0.6) or the near one (0.98)");
        assert.equal(model.height, 0.3);
    });
    // No size in the file: measured on the far mesh, as before.
    await withBucket({"manifest.json": [MANIFEST], "cat/v.far.glb": [ok(glb(0.6))], "cat/v.ark.json": [ok({behaviour: {plan: "mammal"}})]}, async (library) => {
        await library.ready();
        library.request("cat", "far");
        await settled(library);
        assert.ok(Math.abs(library.get("cat")!.bodyLength - 0.6) < 1e-6);
    });
});

test("model library: a near level never waits for a far one that is no longer on its way", async () => {
    const files: Record<string, Answer[]> = {"manifest.json": [ok({models: {a: "v", cat: "v"}})], "a/v.far.glb": [late(120, ok(glb(1)))], "a/v.ark.json": [ok(ARK_JSON)], "cat/v.far.glb": [ok(glb(1))], "cat/v.near.glb": [ok(glb(1))], "cat/v.ark.json": [ok(ARK_JSON)]};
    await withBucket(files, async (library, asked) => {
        await library.ready();
        // One file at a time, and another species' is loading: the cat's two levels wait in the queue.
        library.request("a", "far");
        library.request("cat", "near");
        // The camera has left: the runtime drops the queued far level (never a queued near one).
        assert.equal(library.prune((_slug, level) => level === "near"), 1);
        await settled(library);
        assert.ok(asked.includes("cat/v.near.glb") && !asked.includes("cat/v.far.glb"));
        assert.equal(library.get("cat"), undefined, "its near level alone is not kept: no model without its far level and body plan");
        assert.equal(library.busy, false);
        // Wanted again: both, the far one first.
        library.request("cat", "near");
        await settled(library);
        const model = library.get("cat");
        assert.ok(model?.far && model.near && model.behaviour?.plan === "mammal");
    }, 1);
});

test("model library: the species the reader chose loads ahead of the queue, past the gate", async () => {
    const files: Record<string, Answer[]> = {"manifest.json": [ok({models: {a: "v", b: "v", c: "v", cat: "v"}})]};
    for (const slug of ["a", "b", "c", "cat"]) {
        files[`${slug}/v.far.glb`] = [late(40, ok(glb(1)))];
        files[`${slug}/v.near.glb`] = [late(40, ok(glb(1)))];
        files[`${slug}/v.ark.json`] = [ok(ARK_JSON)];
    }
    await withBucket(files, async (library) => {
        await library.ready();
        library.gate = (slug, level) => !(slug === "cat" && level === "near");
        for (const slug of ["a", "b", "c"]) library.request(slug, "far");
        library.request("cat", "near");
        await settled(library);
        assert.equal(library.get("cat")?.near, null, "held at the gate (a near level let go over the budget)");
        library.urgent = "cat";
        library.request("cat", "near");
        await settled(library);
        assert.ok(library.get("cat")?.near, "the chosen one is asked for whatever the gate says");
    }, 1);
    await withBucket(files, async (library, asked) => {
        await library.ready();
        for (const slug of ["a", "b", "c"]) library.request(slug, "far");
        library.urgent = "cat";
        library.request("cat", "near");
        await settled(library);
        const glbs = asked.filter((name) => name.endsWith(".glb"));
        const last = Math.max(glbs.indexOf("cat/v.far.glb"), glbs.indexOf("cat/v.near.glb"));
        assert.ok(last < glbs.indexOf("b/v.far.glb") && last < glbs.indexOf("c/v.far.glb"), `the chosen one's files before the rest of the queue, beside the one already loading: ${glbs.join(", ")}`);
    }, 1);
});

test("rig library: the session's caps bound the rigs asked for from far off, never one asked for from close by; a dropped request is asked again", async () => {
    const holder = globalThis as unknown as {fetch: typeof fetch};
    const real = holder.fetch;
    const warn = console.warn;
    console.warn = () => undefined;
    const asked: string[] = [];
    let dropOnce = true;
    holder.fetch = (async (input: unknown) => {
        const url = String(input);
        if (url.endsWith("/manifest.json")) return new Response(JSON.stringify({kind: "ark-rig", version: 1, species: {a: "aaaaaaaaaaaa", b: "aaaaaaaaaaaa", c: "aaaaaaaaaaaa", d: "aaaaaaaaaaaa"}}), {status: 200});
        asked.push(url.replace("http://bucket/ark-rig/v1/", ""));
        if (url.includes("/d/") && dropOnce) {
            dropOnce = false;
            throw new TypeError("Failed to fetch");
        }
        // (Not there: final, so each is asked for once.)
        return new Response("{}", {status: 400});
    }) as typeof fetch;
    const {RigLibrary} = await import("@/ark-scene/rig-player");
    const rigs = new RigLibrary("http://bucket/ark-rig/v1", {species: 1, bytes: 1e9});
    const quiet = async () => {
        for (let i = 0; i < 200 && rigs.busy; i++) await sleep(5);
        await sleep(5);
    };
    try {
        await rigs.ready();
        rigs.request("a");
        await quiet();
        rigs.request("b");
        await quiet();
        assert.deepEqual(asked, ["a/aaaaaaaaaaaa.rig.glb"], "the cap of one file is used up: a walker seen from far off goes without");
        rigs.request("b", true);
        await quiet();
        assert.deepEqual(asked, ["a/aaaaaaaaaaaa.rig.glb", "b/aaaaaaaaaaaa.rig.glb"], "one the reader is close to is loaded all the same");
        rigs.request("a", true);
        await quiet();
        assert.equal(asked.length, 2, "a file that is not there is not asked for again");
        assert.equal(rigs.available("a"), false);
        // A request that was dropped: again, after its wait.
        rigs.request("d", true);
        await quiet();
        rigs.request("d", true);
        await quiet();
        assert.equal(asked.filter((name) => name === "d/aaaaaaaaaaaa.rig.glb").length, 1, "not before its wait is over");
        assert.equal(rigs.available("d"), true, "and not given up on");
        await sleep(1050);
        rigs.request("d", true);
        await quiet();
        assert.equal(asked.filter((name) => name === "d/aaaaaaaaaaaa.rig.glb").length, 2);
    } finally {
        rigs.dispose();
        holder.fetch = real;
        console.warn = warn;
    }
});
