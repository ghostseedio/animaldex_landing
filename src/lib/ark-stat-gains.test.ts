import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
    ARK_GREW_ENGLISH,
    ARK_STAT_GAIN_SOURCES,
    ARK_STAT_GAIN_STATS,
    arkGrewText,
    arkGrewTotal,
    arkGrewWords,
    arkStatGainNotes,
    decodeArkStatGains,
    decodeCardStatGains
} from "./ark-stat-gains";
import {arkStatusLog, arkStatusText, ARK_CARD_ENGLISH, ARK_ACTIVITY_ENGLISH, type ArkAnimalStatus, type ArkStatusLogEntry} from "./ark-animal-status";
import {decodeArkLife} from "./ark-life";
import {CAPTURE_WORDS_EN} from "./capture-words";

// The server's answer (voyage_animal_stat_gains_v1, migration 20261225120000), newest first.
const RPC = {
    total: 2,
    dominance: 1,
    speed: 0,
    size: 0,
    intelligence: 1,
    lines: [
        {stat: "intelligence", points: 1, source: "young", ark_day: 312.4, at: "2026-11-20T10:00:00Z"},
        {stat: "dominance", points: 1, source: "hunt", ark_day: 300, at: "2026-11-19T10:00:00Z"}
    ]
};

test("the card's points from the feed/manifest column or the RPC row; null when none", () => {
    assert.deepEqual(decodeCardStatGains({dominance: 1, speed: 0, size: 0, intelligence: 1, total: 2}), {dominance: 1, speed: 0, size: 0, intelligence: 1, total: 2});
    assert.deepEqual(decodeCardStatGains([{dominance: 0, speed: "2", size: 0, intelligence: 0, total: 2}]), {dominance: 0, speed: 2, size: 0, intelligence: 0, total: 2});
    assert.equal(decodeCardStatGains({dominance: 0, speed: 0, size: 0, intelligence: 0, total: 0}), null, "the switch off: all zero");
    assert.equal(decodeCardStatGains(null), null);
    assert.equal(decodeCardStatGains([]), null);
    assert.equal(decodeCardStatGains("x"), null);
    // Never more than the server's lifetime cap, whatever is sent.
    assert.equal(decodeCardStatGains({dominance: 9, speed: 9, size: 9, intelligence: 9})!.total, 5);
});

test("an Ark animal's lines: unknown stats or sources are dropped", () => {
    const gains = decodeArkStatGains({...RPC, lines: [...RPC.lines, {stat: "rarity", source: "hunt", points: 1, at: "2026-11-18T00:00:00Z"}, {stat: "speed", source: "luck", points: 1}]})!;
    assert.equal(gains.total, 2);
    assert.deepEqual(gains.lines.map((line) => `${line.source}:${line.stat}`), ["young:intelligence", "hunt:dominance"]);
    assert.equal(decodeArkStatGains(null), null);
});

test("the log line and the stats note, in English", () => {
    assert.equal(arkGrewText({stat: "dominance", points: 1, source: "hunt"}, ARK_GREW_ENGLISH), "Grew stronger: +1 dominance from a hunt");
    assert.equal(arkGrewText({stat: "speed", points: 1, source: "escape"}, ARK_GREW_ENGLISH), "Grew stronger: +1 speed from an escape");
    assert.equal(arkGrewTotal(2, ARK_GREW_ENGLISH), "+2 from the Ark");
    assert.equal(CAPTURE_WORDS_EN.stats.fromArk.replace("{n}", "2"), "+2 from the Ark");
});

test("the card's log shows one line per point, through the life story and the status text", () => {
    const life = decodeArkLife({id: "a1", origin: {kind: "arrived"}, stat_gains: RPC});
    assert.ok(life);
    const notes = arkStatGainNotes("a1", decodeArkStatGains(life!.stat_gains), arkGrewWords(undefined));
    assert.equal(notes.length, 2);
    assert.ok(notes.every((note) => note.kind === "said" && note.animalId === "a1"));
    const record: ArkStatusLogEntry[] = notes.map((note) => ({id: note.id, source: "record", at: note.at, day: note.day, kind: note.kind, text: note.text}));
    const status: ArkAnimalStatus = {id: "a1", activity: null, since: null, goal: null, log: arkStatusLog([], record), bars: {fed: null, health: null, energy: null, age: null}};
    const text = arkStatusText(status, {
        activity: ARK_ACTIVITY_ENGLISH,
        card: ARK_CARD_ENGLISH,
        story: {capture: "Came aboard with a capture", generic: "Came aboard after a step that worked"},
        life: {bornAboard: "Born on the Ark", hatchedAboard: "Hatched on the Ark", well_fed: "Well-fed", hungry: "Hungry", old: "Old"},
        replay: {a: "a {animal}", an: "an {animal}"}
    }, "en");
    assert.deepEqual(text.log.map((line) => line.text), ["Grew stronger: +1 intelligence from its first young", "Grew stronger: +1 dominance from a hunt"]);
    // No gains (the switch off, an older server): no lines, nothing breaks.
    assert.deepEqual(arkStatGainNotes("a1", decodeArkStatGains(decodeArkLife({id: "a1", origin: {kind: "arrived"}})!.stat_gains), ARK_GREW_ENGLISH), []);
});

test("ark.grew in every Ark locale: every key, its placeholders, translated outside English", () => {
    const dir = path.join(__dirname, "..", "data", "locales");
    const files = ["en.json", "id.json", ...readdirSync(path.join(dir, "ark")).filter((f) => f.endsWith(".json")).map((f) => path.join("ark", f))];
    assert.ok(files.length >= 45, `${files.length} locales`);
    for (const file of files) {
        const grew = JSON.parse(readFileSync(path.join(dir, file), "utf8")).ark.grew;
        assert.ok(grew, `${file} ark.grew`);
        const words = arkGrewWords(grew);
        for (const key of ["line", "total", "note"] as const) assert.ok(typeof grew[key] === "string" && grew[key].trim(), `${file} ark.grew.${key}`);
        for (const stat of ARK_STAT_GAIN_STATS) assert.ok(typeof grew.stats?.[stat] === "string" && grew.stats[stat].trim(), `${file} stats.${stat}`);
        for (const source of ARK_STAT_GAIN_SOURCES) assert.ok(typeof grew.from?.[source] === "string" && grew.from[source].trim(), `${file} from.${source}`);
        for (const p of ["{n}", "{stat}", "{cause}"]) assert.ok(grew.line.includes(p), `${file} line ${p}`);
        assert.ok(grew.total.includes("{n}"), `${file} total {n}`);
        assert.ok(!arkGrewText({stat: "size", points: 1, source: "old"}, words).includes("{"), `${file} fills`);
        if (file === "en.json") assert.deepEqual(grew, ARK_GREW_ENGLISH, "en.json holds the English fallback");
        else assert.notEqual(grew.line, ARK_GREW_ENGLISH.line, `${file} translated`);
    }
});
