import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ARK_LOST_WORDS_EN, arkExtinctForHost, arkExtinctHow, arkExtinctionOf, arkExtinctWhen, arkLostThisWeek, arkLostWords, decodeArkExtinctions, fetchArkExtinct} from "./ark-extinct";

// The two the live server logged (2026-11-15 rehearsal of voyage_extinctions_v1), as it answers them.
const FLEA = {
    aboard: 0,
    ark_day: 117,
    at: "2026-11-13T12:07:12Z",
    back_aboard: false,
    cause: "died_old",
    eaten_by: null,
    model_slug: "common-water-flea",
    name: "Common Water Flea",
    page_slug: "common-water-flea",
    scientific_name: "Daphnia pulex",
    species_profile_id: "a9257dd9-0baa-45a3-b3f0-4846577b6ce9"
};
const APHID = {...FLEA, ark_day: 95, at: "2026-11-12T14:07:11Z", model_slug: "green-peach-aphid", name: "Green Peach Aphid", page_slug: "green-peach-aphid", scientific_name: "Myzus persicae", species_profile_id: "e1cce964-e4d5-497d-a891-ee8364c37618"};

test("decode: the server's rows, newest first; a malformed row is dropped, never the list", () => {
    const list = decodeArkExtinctions({extinctions: [APHID, {name: "no id"}, FLEA, {...FLEA, species_profile_id: "not-a-uuid"}], as_of: "x"})!;
    assert.deepEqual(list.map((one) => one.name), ["Common Water Flea", "Green Peach Aphid"]);
    assert.equal(list[0].arkDay, 117);
    assert.equal(list[0].cause, "died_old");
    assert.equal(decodeArkExtinctions(null), null);
    assert.equal(decodeArkExtinctions({nope: 1}), null);
    assert.deepEqual(decodeArkExtinctions({extinctions: []}), []);
});

test("decode: one row per species (its newest extinction)", () => {
    const again = {...FLEA, at: "2026-11-14T08:00:00Z", ark_day: 140};
    const list = decodeArkExtinctions([FLEA, again])!;
    assert.equal(list.length, 1);
    assert.equal(list[0].arkDay, 140);
});

test("truthful: back aboard only when the read says so and one is counted alive", () => {
    assert.equal(decodeArkExtinctions([{...FLEA, back_aboard: true, aboard: 0}])![0].backAboard, false);
    assert.equal(decodeArkExtinctions([{...FLEA, back_aboard: false, aboard: 3}])![0].backAboard, false);
    assert.equal(decodeArkExtinctions([{...FLEA, back_aboard: true, aboard: 2}])![0].backAboard, true);
});

test("how the last one went: as the event recorded it, an eater only for eaten", () => {
    const eater = {species_profile_id: "11111111-2222-3333-4444-555555555555", name: "Northern Pike", model_slug: "northern-pike"};
    const [eaten] = decodeArkExtinctions([{...FLEA, cause: "eaten", eaten_by: eater}])!;
    assert.equal(arkExtinctHow(ARK_LOST_WORDS_EN, eaten), "Last one eaten by Northern Pike");
    const [eatenUnknown] = decodeArkExtinctions([{...FLEA, cause: "eaten", eaten_by: null}])!;
    assert.equal(arkExtinctHow(ARK_LOST_WORDS_EN, eatenUnknown), "Last one eaten");
    const [old] = decodeArkExtinctions([{...FLEA, eaten_by: eater}])!;
    assert.equal(old.eatenBy, null, "an eater is never said for one that died of old age");
    assert.equal(arkExtinctHow(ARK_LOST_WORDS_EN, old), "Last one died of old age");
    assert.equal(arkExtinctHow(ARK_LOST_WORDS_EN, decodeArkExtinctions([{...FLEA, cause: "starved"}])![0]), "Last one starved");
    assert.equal(arkExtinctHow(ARK_LOST_WORDS_EN, decodeArkExtinctions([{...FLEA, cause: "struck by lightning"}])![0]), null);
});

test("when: the Ark day and the date", () => {
    const [flea] = decodeArkExtinctions([FLEA])!;
    assert.equal(arkExtinctWhen(ARK_LOST_WORDS_EN.when, flea, "en-GB"), "Extinct on Ark day 117 · 13 Nov");
    assert.match(arkExtinctWhen(ARK_LOST_WORDS_EN.when, flea, "not a locale!"), /117/);
});

test("a species' entry: by id, else by page slug; nothing for one never logged", () => {
    const list = decodeArkExtinctions([FLEA, APHID])!;
    assert.equal(arkExtinctionOf(list, {speciesProfileId: APHID.species_profile_id.toUpperCase()})?.name, "Green Peach Aphid");
    assert.equal(arkExtinctionOf(list, {slug: "common-water-flea"})?.name, "Common Water Flea");
    assert.equal(arkExtinctionOf(list, {speciesProfileId: "00000000-0000-0000-0000-000000000000", slug: "common-water-flea"}), null, "an id that differs is never matched by slug");
    assert.equal(arkExtinctionOf(null, {slug: "common-water-flea"}), null);
});

test("lost this week: the newest still gone in the last 7 days", () => {
    const list = decodeArkExtinctions([FLEA, APHID])!;
    assert.equal(arkLostThisWeek(list, Date.parse("2026-11-15T00:00:00Z"))?.name, "Common Water Flea");
    assert.equal(arkLostThisWeek(list, Date.parse("2026-12-01T00:00:00Z")), null);
    const back = decodeArkExtinctions([{...FLEA, back_aboard: true, aboard: 1}, APHID])!;
    assert.equal(arkLostThisWeek(back, Date.parse("2026-11-15T00:00:00Z"))?.name, "Green Peach Aphid");
});

test("fetch: the route's answer; anything else hides the section", async () => {
    const answer = (body: unknown, ok = true) => async () => ({ok, json: async () => body}) as Response;
    assert.deepEqual((await fetchArkExtinct("/x", answer({available: true, extinctions: [FLEA]}))).extinctions.map((one) => one.name), ["Common Water Flea"]);
    assert.equal((await fetchArkExtinct("/x", answer({available: false, extinctions: []}))).available, false);
    assert.equal((await fetchArkExtinct("/x", answer({}, false))).available, false);
    assert.equal((await fetchArkExtinct("/x", async () => { throw new Error("offline"); })).available, false);
});

test("for the host: the read's field names, round trip", () => {
    const list = decodeArkExtinctions([FLEA, APHID])!;
    const host = arkExtinctForHost({available: true, extinctions: list});
    assert.deepEqual(host.extinctions[0], FLEA);
    assert.deepEqual(decodeArkExtinctions(host), list);
});

test("words: every Ark language has every key, with the same placeholders as English", () => {
    const root = path.join(__dirname, "..", "data", "locales");
    const files = [path.join(root, "en.json"), path.join(root, "id.json"), ...readdirSync(path.join(root, "ark")).filter((f) => f.endsWith(".json")).map((f) => path.join(root, "ark", f))];
    const english = JSON.parse(readFileSync(path.join(root, "en.json"), "utf8")).ark.lost;
    assert.deepEqual(english, ARK_LOST_WORDS_EN, "en.json is the code's English");
    const holes = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort().join();
    for (const file of files) {
        const lost = JSON.parse(readFileSync(file, "utf8")).ark.lost as Record<string, string>;
        for (const key of Object.keys(ARK_LOST_WORDS_EN) as (keyof typeof ARK_LOST_WORDS_EN)[]) {
            assert.ok(lost?.[key]?.trim(), `${path.basename(file)}: ark.lost.${key}`);
            assert.equal(holes(lost[key]), holes(ARK_LOST_WORDS_EN[key] ?? ""), `${path.basename(file)}: ark.lost.${key} placeholders`);
        }
    }
    assert.equal(arkLostWords({title: "  "}).title, "Lost from the Ark");
    assert.equal(arkLostWords(null).back, "Back aboard");
});
