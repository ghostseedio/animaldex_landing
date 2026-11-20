import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {journeyMetres, journeysOf, mateItems, mateText} from "@/ark-scene/live/mate-lines";
import {flightHeight, journeySeconds, journeyShare, JOURNEY_MAX, JOURNEY_MIN, LiveJourneys} from "@/ark-scene/live-journeys";
import type {ActPose} from "@/ark-scene/acts";
import {ARK_SEEN_ENGLISH} from "@/ark-scene/seen/hooks";
import {ARK_LANGUAGES} from "@/lib/ark-languages";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import type {ArkLiveText} from "@/lib/ark-live-log";

// MATE-FINDING (AnimalDex decision 432): the record's `mate_found` rows said in the log, their trips drawn, the card's lines.

const row = (over: Record<string, unknown> = {}) => ({
    id: 77,
    kind: "mate_found",
    at: "2026-11-20T10:00:00.000Z",
    animal: {id: "a1", name: "Geometer Moth", species_profile_id: "s1", model_slug: "geometer_moth", zone: "woodland"},
    journey: {kind: "k1", distance: 220.8, way: "air", from: {zone: "woodland", slot: 81, rank: 0, x: -62.1, z: -138.1}, to: {zone: "woodland", slot: 79, rank: 1, x: 127.8, z: -25.5}},
    ...over
});
const words = {live: ARK_LIVE_ENGLISH, replay: {a: "a {animal}", an: "an {animal}"}} as unknown as ArkLiveText;

test("mate-lines: a find is one line in plain words, metres rounded; nothing without a journey", () => {
    const items = mateItems({events: [row(), row({id: 78, journey: null}), row({id: 79, kind: "mated"})]}, 0, () => false);
    assert.equal(items.length, 1);
    assert.equal(items[0].count, 220);
    assert.equal(mateText(items[0], words), "A Geometer Moth travelled 220 m to find a mate");
    assert.equal(mateItems([row()], Date.parse("2026-11-21T00:00:00Z"), () => false).length, 0, "older than `from`");
    assert.equal(mateItems([row()], 0, (key) => key === "event:77").length, 0, "said already");
    assert.equal(mateText({animal: "x", count: 1}, words), null);
    assert.equal(journeyMetres(13.1), 15);
    assert.equal(journeyMetres(608), 610);
});

test("mate-lines: the trips, with the way and the row's time", () => {
    const [j] = journeysOf([row()]);
    assert.deepEqual(j, {key: "mate_found:77", id: "a1", from: {x: -62.1, z: -138.1}, to: {x: 127.8, z: -25.5}, distance: 220.8, way: "air", t0: Date.parse("2026-11-20T10:00:00.000Z") / 1000});
    assert.equal(journeysOf([row({journey: {...row().journey, way: "swim?"}})])[0].way, "ground");
});

test("live-journeys: duration by pace, bounded; the share runs 0..1 over it; a flier arcs up and comes down", () => {
    assert.equal(journeySeconds(1, 1), JOURNEY_MIN);
    assert.equal(journeySeconds(10000, 1), JOURNEY_MAX);
    assert.equal(journeySeconds(70, 1), 70);
    assert.equal(journeyShare(100, 50, 99), null);
    assert.equal(journeyShare(100, 50, 125), 0.5);
    assert.equal(journeyShare(100, 50, 151), null);
    assert.equal(flightHeight(0, 200), 0);
    assert.ok(flightHeight(0.5, 200) > 10);
    assert.ok(Math.abs(flightHeight(1, 200)) < 1e-9);
});

test("live-journeys: the traveller is drawn along the way from its old home to its new one, then let go", () => {
    type E = {id: string; act: ActPose | null};
    const e: E = {id: "a1", act: null};
    const asked: string[] = [];
    const lj = new LiveJourneys<E>({
        find: (id) => (id === "a1" ? e : null),
        path: (_e, a, b, way) => {
            asked.push(way);
            return [a, {x: a.x, z: b.z}, b];
        },
        ground: () => 0,
        water: () => 0,
        walk: () => 1,
        length: () => 0.5,
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: () => false
    });
    const t0 = 1000;
    lj.add([{key: "k", id: "a1", from: {x: 0, z: 0}, to: {x: 30, z: 40}, distance: 50, way: "ground", t0}], t0);
    lj.step(t0 + 1);
    assert.deepEqual(asked, ["ground"], "the nav grid's way, asked once");
    assert.ok(e.act && Math.abs(e.act.x) < 1e-9 && e.act.z > 0, "first along the path's first leg");
    assert.equal(e.act?.state, "walk");
    const total = 70; // 40 + 30 along the bent path, at 1.6 m/s: 43.75 s
    lj.step(t0 + total / 1.6 - 0.01);
    assert.ok(e.act && Math.hypot(e.act.x - 30, e.act.z - 40) < 0.1, "at the end: beside its partner");
    lj.step(t0 + total / 1.6 + 1);
    assert.equal(e.act, null, "let go");
    assert.equal(lj.size, 0);
    // A trip long over when read (a reload) is not drawn.
    lj.add([{key: "old", id: "a1", from: {x: 0, z: 0}, to: {x: 1, z: 1}, distance: 2, way: "air", t0: 0}], 10_000);
    assert.equal(lj.size, 0);
});

test("words: the find's line and the card's two lines in all 45 Ark languages, the same holes, not English, no dash", () => {
    const locales = path.join(__dirname, "..", "data", "locales");
    const read = (language: string) => JSON.parse(readFileSync(language === "en" || language === "id" ? path.join(locales, `${language}.json`) : path.join(locales, "ark", `${language}.json`), "utf8")).ark as {live: Record<string, string>; mate: Record<string, string>};
    const holes = (line: string) => (line.match(/\{\w+\}/g) ?? []).sort();
    const en = read("en");
    assert.equal(en.live.mateFound, ARK_LIVE_ENGLISH.mateFound);
    assert.equal(en.mate.nearest, ARK_SEEN_ENGLISH.mateNearest);
    assert.equal(en.mate.found, ARK_SEEN_ENGLISH.mateFound);
    assert.equal(ARK_LANGUAGES.length, 45);
    for (const language of ARK_LANGUAGES) {
        const ark = read(language);
        for (const [group, key, want] of [["live", "mateFound", ["{aAnimal}", "{distance}"]], ["mate", "nearest", ["{distance}"]], ["mate", "found", ["{distance}"]]] as const) {
            const line = ark[group][key];
            assert.ok(line?.trim(), `${language}.${group}.${key}`);
            assert.deepEqual(holes(line), [...want].sort(), `${language}.${group}.${key}: placeholders`);
            assert.ok(!/[—–]/.test(line), `${language}.${group}.${key}: a dash as punctuation`);
            if (language !== "en") assert.notEqual(line, en[group][key], `${language}.${group}.${key} is still English`);
        }
    }
});
