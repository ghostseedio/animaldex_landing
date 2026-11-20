import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import test from "node:test";
import {ARK_RICH_ENGLISH, richItems, richNotes} from "@/ark-scene/live/rich-lines";
import {dungVisitPose, eatsDung} from "@/ark-scene/dung";
import {arkStatusBars, arkStatusText, arkStatusWords} from "@/lib/ark-animal-status";
import {type ArkLiveText} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";

/** Decision 434 (AnimalDex docs/ark/dung-and-logs.md): the rich events' lines, dung users at real dung. */

const en = JSON.parse(readFileSync("src/data/locales/en.json", "utf8"));
const words = {live: {...ARK_LIVE_ENGLISH, ...en.ark.live}, replay: en.ark.replay} as unknown as ArkLiveText;
const at = "2026-11-20T10:00:00.000Z";
const zebra = {id: "z1", name: "Plains Zebra", species_profile_id: "sp-zebra", zone: "grassland"};
const mare = {id: "z2", name: "Plains Zebra", species_profile_id: "sp-zebra", zone: "grassland"};
const beetle = {id: "b1", name: "Dung Beetle", species_profile_id: "sp-beetle", zone: "grassland"};
const rows = [
    {id: 1, kind: "grown_up", at, ark_day: 400.2, animal: zebra, species: "Plains Zebra"},
    {id: 2, kind: "grew_old", at, animal: zebra},
    {id: 3, kind: "breeding_season", at, species: "Plains Zebra", species_profile_id: "sp-zebra", animal: null},
    {id: 4, kind: "carer_left", at, animal: zebra},
    {id: 5, kind: "new_carer", at, animal: zebra},
    {id: 6, kind: "grazed_bare", at, species: "Plains Zebra", species_profile_id: "sp-zebra", animal: null},
    {id: 7, kind: "regrown", at, species: "Plains Zebra", species_profile_id: "sp-zebra", animal: null},
    {id: 8, kind: "mated", at, animal: zebra, other: mare, parents: ["z1", "z2"], first: ["z2"], waited: 812, waiter: "z2"},
    {id: 9, kind: "fed", at, animal: beetle, source: "forage", food: "dung"},
    // Rows that are not rich: said by their own modules, never here.
    {id: 10, kind: "mated", at, animal: zebra, other: mare, parents: ["z1", "z2"]},
    {id: 11, kind: "fed", at, animal: beetle, source: "step"},
    {id: 12, kind: "birth", at, animal: zebra}
];

test("the live log: one line per rich row, in plain English, the rest left to their own modules", () => {
    const items = richItems({events: rows}, 0, () => false, words, "en");
    assert.deepEqual(items.map((i) => i.line), [
        "A Plains Zebra born aboard is now grown up",
        "A Plains Zebra is growing old",
        "Plains Zebras: the breeding season has begun",
        "A Plains Zebra is without its carer for a few days",
        "A Plains Zebra has a new carer",
        "Plains Zebras: their grazing ground is bare",
        "Plains Zebras: their grazing ground is green again",
        "A Plains Zebra found a mate after 812 days",
        "A Dung Beetle found fresh dung"
    ]);
    // A tap flies to the animal it is about (the waiter, the beetle), or to the kind.
    assert.equal(items[7].focus.animalId, "z2");
    assert.equal(items[2].focus.animalId, null);
    assert.equal(items[2].focus.speciesId, "sp-zebra");
    // Said once; none older than `from`.
    assert.equal(richItems({events: rows}, 0, (key) => key === "rich:1", words, "en").length, 8);
    assert.equal(richItems({events: rows}, Date.parse(at) + 1, () => false, words, "en").length, 0);
});

test("the animals' own logs: a first mating replaces that parent's plain line; each said in the reader's words", () => {
    const notes = richNotes({events: rows}, words, "en");
    const first = notes.filter((n) => n.id.startsWith("mated:"));
    assert.deepEqual(first.map((n) => [n.animalId, n.id, n.text]), [["z2", "mated:8:z2", "A Plains Zebra mated for the first time"]]);
    // (No line for a kind's row: it is about no one animal.)
    assert.ok(!notes.some((n) => n.id === "rich:3" || n.id === "rich:6"));
    assert.equal(notes.find((n) => n.id === "rich:1")!.day, 400);
    // The card says a said note as it is.
    const status = {id: "z1", activity: "food", since: 0, goal: null, log: [{id: "rich:1", source: "record", at: Date.parse(at), day: 400, kind: "said", text: "A Plains Zebra born aboard is now grown up"}], bars: arkStatusBars({condition: "well_fed", arkDay: 100})};
    const text = arkStatusText(status as never, arkStatusWords(en.ark as never), "en");
    assert.ok(JSON.stringify(text.log).includes("A Plains Zebra born aboard is now grown up"), JSON.stringify(text.log));
});

test("every language has the lines, with the name's placeholder and the days", () => {
    const files = ["src/data/locales/id.json", ...readdirSync("src/data/locales/ark").map((f) => `src/data/locales/ark/${f}`)];
    assert.equal(files.length, 44);
    for (const file of files) {
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        for (const key of Object.keys(ARK_RICH_ENGLISH)) {
            const line = ark.live[key];
            assert.ok(typeof line === "string" && /\{(aAnimal|animals)\}/.test(line), `${file} ${key}`);
            if (key === "foundMate") assert.ok(line.includes("{days}"), file);
        }
        assert.ok(typeof ark.relations.dung === "string" && ark.relations.dung.length, `${file} relations.dung`);
    }
});

test("dung users: the kinds whose microhabitats include dung, round a mark, never a grazer", () => {
    assert.equal(eatsDung("dung-beetle", "grassland"), true);
    assert.equal(eatsDung("yellow-dung-fly", "grassland"), true);
    assert.equal(eatsDung("plains-zebra", "grassland"), false);
    const mark = {x: 10, z: 5, size: 0.3};
    const a = dungVisitPose(mark, "b1|dung:z1:4", 0, false, 3);
    assert.ok(Math.hypot(a.x - 10, a.z - 5) <= 0.3);
    assert.deepEqual(dungVisitPose(mark, "b1|dung:z1:4", 0, false, 3), a);
    assert.notDeepEqual(dungVisitPose(mark, "b2|dung:z1:4", 0, false, 3), a);
});
