import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ARK_KEPT_OFF, ARK_LAYING_KINDS, ARK_NEUTER_DEFAULT, ARK_NEUTER_SHARE, arkKeptLines, arkKeptUnit, arkNeutered, decodeArkKeptFlags, decodeArkNeuterDraw, isArkLeftKind} from "@/lib/ark-kept";
import {arkKindSeries, arkSeriesStats, decodeArkHistory} from "@/lib/ark-population-history";
import {ARK_LANGUAGES} from "@/lib/ark-languages";

const CAT = "5c5fab8a-0426-4588-8024-a1d30bcbbca2";
const HEN = "cf059266-56af-4199-adba-64d2d7c0e623";
const ON = {captiveBreeding: true, humanUse: true};
const animal = (over: Record<string, unknown>) => ({id: "a-1", species_profile_id: CAT, kind_species_profile_id: null, area: "house", origin: "arrived", ...over}) as Parameters<typeof arkKeptLines>[0];

test("kept lines: born in a kept place says where; nothing for a wild animal", () => {
    assert.deepEqual(arkKeptLines(animal({origin: "born", area: "zoo"}), ARK_KEPT_OFF), ["bornZoo"]);
    assert.deepEqual(arkKeptLines(animal({origin: "born", area: "farm", species_profile_id: "x"}), ARK_KEPT_OFF), ["bornFarm"]);
    assert.deepEqual(arkKeptLines(animal({origin: "born", area: null}), ON), []);
});

test("kept lines: neutered and eggs collected only while human_use is on, never in the zoo", () => {
    let neutered = 0;
    for (let i = 0; i < 5000; i++) if (arkKeptLines(animal({id: `cat-${i}`}), ON).includes("neutered")) neutered++;
    assert.ok(Math.abs(neutered / 5000 - ARK_NEUTER_SHARE[CAT]) < 0.02, String(neutered));
    for (let i = 0; i < 50; i++) assert.ok(!arkKeptLines(animal({id: `cat-${i}`}), ARK_KEPT_OFF).includes("neutered"));
    assert.deepEqual(arkKeptLines(animal({species_profile_id: HEN, area: "farm"}), ON), ["eggsCollected"]);
    assert.deepEqual(arkKeptLines(animal({species_profile_id: HEN, area: "zoo"}), ON), []);
    assert.ok(ARK_LAYING_KINDS.has(HEN));
});

test("kept lines: the draw is the engine's (kept.ts unitOf) and the tables match it", () => {
    // fmix32(FNV-1a("")) = fmix32(0x811c9dc5)
    let h = 0x811c9dc5;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    assert.equal(arkKeptUnit(""), (h >>> 0) / 4294967296);
    const engine = path.join(process.env.HOME ?? "", "AnimalDex-work/wt/kept-populations/supabase/functions/_shared/ark-ecology/kept.ts");
    if (!existsSync(engine)) return;
    const text = readFileSync(engine, "utf8");
    for (const [kind, share] of Object.entries(ARK_NEUTER_SHARE)) assert.ok(new RegExp(`"${kind}": pet\\("[^"]+", ${share},`).test(text), kind);
});

test("neuter by region: the stored draw wins; none stored takes the default share; off keeps the flat share", () => {
    const on = (neutered: boolean | null) => ({on: true, neutered});
    assert.deepEqual(arkKeptLines(animal({}), ON, false, on(true)), ["neutered"]);
    assert.deepEqual(arkKeptLines(animal({}), ON, false, on(false)), []);
    assert.deepEqual(arkKeptLines(animal({}), ARK_KEPT_OFF, false, on(true)), [], "human use off: never");
    assert.deepEqual(arkKeptLines(animal({area: "zoo"}), ON, false, on(true)), [], "never in the zoo");
    for (let i = 0; i < 3000; i++) {
        const id = `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;
        assert.equal(arkNeutered(CAT, id, on(null)), arkKeptUnit(`neuter|${id}`) < ARK_NEUTER_DEFAULT[CAT]);
        assert.equal(arkNeutered(CAT, id), arkKeptUnit(`neuter|${id}`) < ARK_NEUTER_SHARE[CAT]);
    }
    // The engine's NEUTER_DEFAULT and the SQL check's known units (migration 20261229120000).
    assert.equal(arkKeptUnit("neuter|00000000-0000-4000-8000-000000000000"), 0.8983671215828508);
    assert.equal(arkKeptUnit("neuter|c54e5eca-48bc-4b31-bef6-7f69515e76f7"), 0.7678862630855292);
    const engine = path.join(process.env.HOME ?? "", "AnimalDex-work/wt/kept-neuter-region/supabase/functions/_shared/ark-ecology/kept.ts");
    if (existsSync(engine)) {
        const text = readFileSync(engine, "utf8");
        for (const [kind, share] of Object.entries(ARK_NEUTER_DEFAULT)) assert.ok(new RegExp(`"${kind}": ${share},`).test(text), kind);
    }
});

test("neuter by region: the card's read is decoded to a boolean or nothing", () => {
    assert.deepEqual(decodeArkNeuterDraw(null), {on: false, neutered: null});
    assert.deepEqual(decodeArkNeuterDraw({on: false, neutered: true}), {on: false, neutered: null});
    assert.deepEqual(decodeArkNeuterDraw({on: true, neutered: "yes"}), {on: true, neutered: null});
    assert.deepEqual(decodeArkNeuterDraw({on: true, neutered: false, country: "GB"}), {on: true, neutered: false});
});

test("kept: the switches' read and the ways an animal leaves alive", () => {
    assert.deepEqual(decodeArkKeptFlags(null), ARK_KEPT_OFF);
    assert.deepEqual(decodeArkKeptFlags({captive_breeding: true, human_use: "true"}), {captiveBreeding: true, humanUse: false});
    assert.ok(isArkLeftKind("to_market") && isArkLeftKind("rehomed") && isArkLeftKind("moved_zoo") && !isArkLeftKind("eaten"));
});

test("population history: a step's rehomed, to market and moved to another zoo count as leaving, by how", () => {
    const t0 = Date.UTC(2026, 10, 20);
    const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
    const history = decodeArkHistory({
        available: true, bucket: "hour", bucket_seconds: 3600, t0: iso(t0), since: iso(t0), as_of: iso(t0 + 3 * 3600_000), first_at: iso(t0), started_at: iso(t0),
        kinds: ["sheep"], base: [[0, 1, 10]], steps: [[0, 1, 0, 0, 2, 0, 0, 0], [0, 1, 1, 0, 0, 0, 0, 0, 1, 3, 0]], gone: {}
    }, "UTC");
    assert.ok(history);
    const series = arkKindSeries(history!, "sheep", "town");
    assert.deepEqual(series.counts.slice(0, 3), [10, 12, 8]);
    const stats = arkSeriesStats(series);
    assert.equal(stats.rehomed, 1);
    assert.equal(stats.toMarket, 3);
    assert.equal(stats.movedZoo, 0);
});

test("kept words: every Ark language has the card's and the graph's new words", () => {
    const dir = path.join(__dirname, "..", "data", "locales");
    for (const language of ARK_LANGUAGES) {
        const file = language === "en" || language === "id" ? path.join(dir, `${language}.json`) : path.join(dir, "ark", `${language}.json`);
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        for (const key of ["kept", "bornZoo", "bornHome", "bornFarm", "neutered", "eggsCollected", "left", "endedRehomed", "endedMarket", "endedMovedZoo"]) assert.ok(ark.life[key]?.trim(), `${language} life.${key}`);
        for (const key of ["rehomed", "toMarket", "movedZoo"]) assert.match(ark.graph[key], /\{count\}/, `${language} graph.${key}`);
        assert.ok(ark.graph.riseFallKept?.trim(), `${language} graph.riseFallKept`);
    }
});
