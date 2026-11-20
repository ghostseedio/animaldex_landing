import assert from "node:assert/strict";
import test from "node:test";
import {brotliDecompressSync, gunzipSync} from "node:zlib";
import {arkPickEncoding, createArkEncodedBodyCache} from "@/lib/ark-encoded-body";

test("one build per source answer, shared by concurrent callers; the bytes decode to the payload", async () => {
    const cache = createArkEncodedBodyCache();
    const raw = {ok: true};
    const artwork = {};
    let builds = 0;
    const build = async () => {
        builds += 1;
        await new Promise((r) => setTimeout(r, 5));
        return {payload: {available: true, animals: Array.from({length: 500}, (_, i) => ({id: i}))}, etag: 'W/"ark-x"'};
    };
    const bodies = await Promise.all(Array.from({length: 30}, () => cache.get([raw, artwork], build)));
    assert.equal(builds, 1);
    assert.ok(bodies.every((b) => b === bodies[0]));
    const json = bodies[0].json.toString();
    assert.equal(gunzipSync(bodies[0].gzip).toString(), json);
    assert.equal(brotliDecompressSync(bodies[0].br).toString(), json);
    assert.ok(bodies[0].br.length < json.length / 5);
    assert.equal(JSON.parse(json).animals.length, 500);
    // Held: no build again for the same answer; a new answer (or a new listing) builds anew.
    await cache.get([raw, artwork], build);
    assert.equal(builds, 1);
    await cache.get([{ok: true}, artwork], build);
    assert.equal(builds, 2);
});

test("a failed build is not kept", async () => {
    const cache = createArkEncodedBodyCache();
    const key = [{}];
    await assert.rejects(cache.get(key, async () => {
        throw new Error("x");
    }));
    const body = await cache.get(key, async () => ({payload: {ok: 1}, etag: "e"}));
    assert.equal(body.json.toString(), '{"ok":1}');
});

test("Accept-Encoding: brotli first, then gzip, q=0 refused", () => {
    assert.equal(arkPickEncoding("gzip, deflate, br, zstd"), "br");
    assert.equal(arkPickEncoding("gzip"), "gzip");
    assert.equal(arkPickEncoding("br;q=0, gzip;q=0.5"), "gzip");
    assert.equal(arkPickEncoding("*"), "br");
    assert.equal(arkPickEncoding(null), null);
    assert.equal(arkPickEncoding("identity"), null);
});
