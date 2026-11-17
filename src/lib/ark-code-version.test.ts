import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import test, {afterEach, beforeEach} from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {arkCodeSuffix, arkCodeUrl} from "@/ark-scene/code-version";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {prepareArk, prepareGhostPlaces, prepareReadPlaces} from "@/ark-scene/runtime/prebuild";
import {startTown} from "@/ark-scene/islands/town/prebuild";
import {setArkWorld} from "@/ark-scene/world";

/**
 * The Ark's code version (src/ark-scene/code-version.ts; 2026-11-17: the scene's scripts were asked for by bare URLs and
 * the CDN let a browser keep them for four hours, so an old worker ran beside a new scene). Every Ark script URL carries
 * the build's `?v=`, and the headers say so: a versioned one is kept for good, a bare one is asked again every time.
 */

const root = path.resolve(__dirname, "../..");
const ENV = "NEXT_PUBLIC_ARK_CODE_V";
let savedEnv: string | undefined;
let savedPage: unknown;
let savedWorker: unknown;
let savedWorld: unknown;
let asked: string[] = [];

/** A Worker that records the address it was made with and fails at once (the callers then carry on as they do without one). */
class RecordingWorker {
    onmessage: ((event: unknown) => void) | null = null;
    onerror: ((event: {message: string}) => void) | null = null;
    constructor(url: string | URL) {
        asked.push(String(url));
    }
    postMessage(): void {
        setTimeout(() => this.onerror?.({message: "recorded"}), 0);
    }
    terminate(): void {}
}

beforeEach(() => {
    savedEnv = process.env[ENV];
    const g = globalThis as {ARK_CODE_V?: unknown; Worker?: unknown; __ARK_WORLD__?: unknown};
    savedPage = g.ARK_CODE_V;
    savedWorker = g.Worker;
    savedWorld = g.__ARK_WORLD__;
    delete process.env[ENV];
    delete g.ARK_CODE_V;
    g.Worker = RecordingWorker;
    asked = [];
});

afterEach(() => {
    const g = globalThis as {ARK_CODE_V?: unknown; Worker?: unknown; __ARK_WORLD__?: unknown};
    if (savedEnv === undefined) delete process.env[ENV];
    else process.env[ENV] = savedEnv;
    if (savedPage === undefined) delete g.ARK_CODE_V;
    else g.ARK_CODE_V = savedPage;
    g.Worker = savedWorker;
    g.__ARK_WORLD__ = savedWorld;
    setArkWorld("v1");
});

test("the version: the build's, or the page's own; none leaves the address bare; a versioned address is left as it is", () => {
    assert.equal(arkCodeSuffix(), "");
    assert.equal(arkCodeUrl("/ark/ark-town-worker.js"), "/ark/ark-town-worker.js");
    process.env[ENV] = "abc123def456";
    assert.equal(arkCodeSuffix(), "?v=abc123def456");
    assert.equal(arkCodeUrl("/ark/ark-town-worker.js"), "/ark/ark-town-worker.js?v=abc123def456");
    assert.equal(arkCodeUrl("/ark/ark-prebuild-worker.js?world=v2"), "/ark/ark-prebuild-worker.js?world=v2&v=abc123def456");
    assert.equal(arkCodeUrl("./ark-scene.js?v=1700000000000"), "./ark-scene.js?v=1700000000000", "an address that carries a version already keeps it");
    // The apps' panel sets its own (embed.html: its Last-Modified), and the scene keeps it on what the scene asks for.
    (globalThis as {ARK_CODE_V?: string}).ARK_CODE_V = "?v=1700000000000";
    assert.equal(arkCodeUrl("/ark/ark-prebuild-places-worker.js"), "/ark/ark-prebuild-places-worker.js?v=1700000000000");
    (globalThis as {ARK_CODE_V?: string}).ARK_CODE_V = "?v=";
    assert.equal(arkCodeSuffix(), "?v=abc123def456", "an empty page version is no version");
});

test("every worker the scene starts is asked for with the version: the scenery, places, replay, read and town workers, on either world", async () => {
    process.env[ENV] = "abc123def456";
    const snapshot = decodeArkSnapshot(base)!;
    const animals = snapshot.animals;
    assert.ok(animals.length > 0);
    for (const world of ["v1", "v2"]) {
        asked = [];
        setArkWorld(world as "v1" | "v2");
        await prepareArk({snapshot, timeoutMs: 2_000});
        await prepareGhostPlaces(animals);
        await prepareReadPlaces(animals);
        const town = startTown({animals, origin: {x: 0, z: 0}, open: []});
        town.cancel();
        const names = asked.map((url) => url.replace(/\?.*$/, "")).sort();
        assert.deepEqual(names, [
            "/ark/ark-prebuild-places-worker.js",
            "/ark/ark-prebuild-places-worker.js",
            "/ark/ark-prebuild-places-worker.js",
            "/ark/ark-prebuild-worker.js",
            "/ark/ark-town-worker.js"
        ], `the workers started on world ${world}`);
        for (const url of asked) {
            assert.match(url, /[?&]v=abc123def456(&|$)/, `${url} carries the version`);
            // (The town's worker is not told the wild world: it builds the town, which is the same in either.)
            const told = new URL(url, "https://animaldex.app").searchParams.get("world");
            assert.equal(told, url.includes("ark-town-worker") || world === "v1" ? null : "v2", url);
        }
    }
});

test("with no version (a harness, a test, next dev before the first bundle build) the addresses stay as they always were", async () => {
    const animals = decodeArkSnapshot(base)!.animals;
    await prepareArk({snapshot: decodeArkSnapshot(base), timeoutMs: 2_000});
    await prepareGhostPlaces(animals);
    startTown({animals, origin: {x: 0, z: 0}, open: []}).cancel();
    assert.ok(asked.length >= 3);
    for (const url of asked) assert.doesNotMatch(url, /v=/, url);
});

test("the apps' panel (public/ark/embed.html) puts its version on every Ark script it asks for", () => {
    const html = readFileSync(path.join(root, "public/ark/embed.html"), "utf8");
    assert.match(html, /window\.ARK_CODE_V = "\?v=" \+ /, "the panel's version is set before any script is asked for");
    const refs = Array.from(html.matchAll(/"\.\/(ark-[a-z-]+\.js)"/g));
    assert.ok(refs.length >= 4, "the scene and the three workers are named in the panel");
    for (const ref of refs) {
        const rest = html.slice(ref.index! + ref[0].length, ref.index! + ref[0].length + 24);
        assert.match(rest, /^\s*\+\s*window\.ARK_CODE_V/, `${ref[1]} is asked for with the version at char ${ref.index}`);
    }
    for (const name of ["ark-scene.js", "ark-prebuild-worker.js", "ark-prebuild-places-worker.js", "ark-town-worker.js"]) {
        assert.ok(refs.some((ref) => ref[1] === name), `${name} is named in the panel`);
    }
    // No other way to a script under /ark/ (a bare absolute address, a script tag with a literal src).
    assert.doesNotMatch(html, /["']\/ark\/ark-[a-z-]+\.js/, "no bare absolute Ark script address");
    assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*ark-[a-z-]+\.js/, "no script tag naming a bare Ark script");
});

test("the build script writes one version for the scene and the workers, and next.config.js inlines it", () => {
    const script = readFileSync(path.join(root, "scripts/build-ark-bundle.mjs"), "utf8");
    assert.match(script, /public\/ark\/ark-version\.txt/);
    assert.match(script, /"process\.env\.NEXT_PUBLIC_ARK_CODE_V": JSON\.stringify\(version\)/, "the version is defined in every bundle");
    for (const out of ["ark-scene.js", "ark-prebuild-worker.js", "ark-prebuild-places-worker.js", "ark-town-worker.js"]) assert.ok(script.includes(`"${out}"`), `${out} is built and hashed`);
    const config = createRequire(__filename)(path.join(root, "next.config.js")) as {env?: Record<string, string>};
    assert.ok(config.env && ENV in config.env, "next.config.js defines the version for the pages");
});

test("the headers: a versioned /ark script is cached for good, a bare one is asked again every time", async () => {
    const config = createRequire(__filename)(path.join(root, "next.config.js")) as {headers: () => Promise<Array<{source: string; has?: Array<{type: string; key: string}>; headers: Array<{key: string; value: string}>}>>};
    const rules = (await config.headers()).filter((rule) => rule.source.startsWith("/ark/:file(") && rule.source.endsWith(".js)"));
    assert.equal(rules.length, 2, "one rule for every /ark script, one for the versioned ones");
    const [all, versioned] = rules;
    assert.equal(all.has, undefined);
    assert.deepEqual(all.headers, [{key: "Cache-Control", value: "public, no-cache"}]);
    assert.deepEqual(versioned.has, [{type: "query", key: "v"}]);
    assert.deepEqual(versioned.headers, [{key: "Cache-Control", value: "public, max-age=31536000, immutable"}], "listed after the first, so it wins where both match");
    // The pattern takes a top-level script and nothing deeper (the textures' transcoder under /ark/basis has its own rule).
    const match = new RegExp(`^/ark/(${all.source.match(/\((\[[^)]*\]\+\\\.js)\)/)?.[1] ?? "(?!)"})$`);
    for (const name of ["ark-scene.js", "ark-town-worker.js", "ark-prebuild-worker.js", "ark-prebuild-places-worker.js"]) assert.match(`/ark/${name}`, match, name);
    assert.doesNotMatch("/ark/basis/basis_transcoder.js", match);
});
