import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
    ARK_ENDANGERED_WORDS_EN,
    arkCrisesUrl,
    arkCrisisBandWord,
    arkCrisisCountries,
    arkCrisisDuration,
    arkCrisisFocus,
    arkCrisisFromQuery,
    arkCrisisLink,
    arkCrisisSeeItPath,
    arkCrisisSummary,
    arkEndangeredWords,
    decodeArkCrises,
    fetchArkCrises
} from "./ark-crises";
import {ARK_CRISES_FIXTURE_IDS, arkCrisesFixture} from "./ark-crises-fixture";

const NOW = Date.parse("2026-11-27T08:10:00Z");
const fixture = () => arkCrisesFixture(NOW, true);
const reply = (status: number, body: unknown) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), {status});

test("decode: the contract's rows, last one first, then critical newest first, then ended; a malformed row is dropped, never the list", () => {
    const rows = fixture().crises;
    const list = decodeArkCrises({crises: [...rows, {name: "no id"}, {...rows[0], id: "not-a-uuid"}, {...rows[0], id: "11111111-2222-4333-8444-555555555555", band: "last", wild_count: 2}]})!;
    assert.deepEqual(list.map((one) => one.name), ["Wild Boar", "Red Squirrel", "Eurasian Lynx", "Snow Leopard", "Giant Panda"]);
    assert.deepEqual(list.map((one) => one.status), ["open", "open", "open", "saved", "extinct"]);
    assert.equal(list[0].wildCount, 1);
    assert.deepEqual(list[1].lastAnimalIds.length, 2);
    assert.equal(decodeArkCrises(null), null);
    assert.equal(decodeArkCrises({nope: 1}), null);
    assert.deepEqual(decodeArkCrises({crises: []}), []);
});

test("truthful: an open crisis is exactly 2 left (critical) or 1 left (last); anything else is not a crisis row", () => {
    const boar = fixture().crises[0];
    assert.equal(decodeArkCrises([{...boar, wild_count: 3}])!.length, 0, "3 left is not a crisis");
    assert.equal(decodeArkCrises([{...boar, band: "critical", wild_count: 1}])!.length, 0, "band and count disagree");
    assert.equal(decodeArkCrises([{...boar, band: "nope"}])!.length, 0);
    assert.equal(decodeArkCrises([{...boar, opened_at: "yesterday-ish"}])!.length, 0, "no time, no duration");
    assert.equal(decodeArkCrises([{...boar, status: "doomed"}])!.length, 0);
    assert.equal(decodeArkCrises([{...boar, status: "extinct", wild_count: 1}])!.length, 0, "extinct means none left");
});

test("decode: one row per crisis id (the newest), ids lower-cased, animal ids and countries cleaned", () => {
    const boar = fixture().crises[0];
    const newer = {...boar, id: String(boar.id).toUpperCase(), opened_at: "2026-11-27T07:00:00Z", countries: ["de", "PL", "xx1", "DE", 5], last_animal_ids: ["B7F4A3D2-9E1C-4B6A-8F20-3C5D7E9A1B02", "nope", "b7f4a3d2-9e1c-4b6a-8f20-3c5d7e9a1b02"]};
    const list = decodeArkCrises([boar, newer])!;
    assert.equal(list.length, 1);
    assert.equal(list[0].id, ARK_CRISES_FIXTURE_IDS.boar);
    assert.equal(list[0].openedAt, "2026-11-27T07:00:00Z");
    assert.deepEqual(list[0].countries, ["DE", "PL"], "country codes only, upper case, once");
    assert.deepEqual(list[0].lastAnimalIds, ["b7f4a3d2-9e1c-4b6a-8f20-3c5d7e9a1b02"]);
});

test("decode: nothing finer than a country, no predator and no estimate leaks through", () => {
    const boar = {...fixture().crises[0], threat_predator_kind: "wolf", eta: "3 h", lat: 1.5, city: "Berlin", owner_id: "u1"};
    const [one] = decodeArkCrises([boar])!;
    assert.deepEqual(Object.keys(one).sort(), ["band", "countries", "endedArkDay", "endedAt", "habitat", "id", "lastAnimalIds", "modelSlug", "name", "openedArkDay", "openedAt", "pageSlug", "scientificName", "speciesProfileId", "status", "wildCount"]);
    assert.ok(!JSON.stringify(one).match(/wolf|Berlin|u1|3 h/));
});

test("fetch: a list, an empty list, no read yet (404 / available false), and an error are four different states", async () => {
    const ready = await fetchArkCrises({}, reply(200, fixture()));
    assert.equal(ready.state, "ready");
    assert.equal(ready.crises.length, 5);
    const none = await fetchArkCrises({}, reply(200, {available: true, crises: []}));
    assert.deepEqual(none, {state: "ready", crises: []});
    for (const status of [404, 410, 501]) assert.deepEqual(await fetchArkCrises({}, reply(status, "")), {state: "absent", crises: []}, String(status));
    assert.deepEqual(await fetchArkCrises({}, reply(200, {available: false, crises: []})), {state: "absent", crises: []});
    assert.deepEqual(await fetchArkCrises({}, reply(500, "")), {state: "error", crises: []});
    assert.deepEqual(await fetchArkCrises({}, reply(200, "not json")), {state: "error", crises: []});
    assert.deepEqual(await fetchArkCrises({}, reply(200, {available: true})), {state: "error", crises: []});
    assert.deepEqual(await fetchArkCrises({}, async () => { throw new Error("offline"); }), {state: "error", crises: []});
});

test("the request: ?crisis= only for a crisis id, ?lang= as the apps say it", () => {
    assert.equal(arkCrisesUrl(), "/api/ark/crises");
    assert.equal(arkCrisesUrl({crisis: ARK_CRISES_FIXTURE_IDS.boar, lang: "ja"}), `/api/ark/crises?crisis=${ARK_CRISES_FIXTURE_IDS.boar}&lang=ja`);
    assert.equal(arkCrisesUrl({crisis: "../../x"}), "/api/ark/crises");
});

test("how long it has been open: one rounded-down unit, never under a minute, in the reader's language", () => {
    const at = (ms: number) => new Date(NOW - ms).toISOString();
    assert.equal(arkCrisisDuration(at(5_000), NOW, "en"), "1 minute");
    assert.equal(arkCrisisDuration(at(12 * 60_000 + 40_000), NOW, "en"), "12 minutes");
    assert.equal(arkCrisisDuration(at(59 * 60_000 + 59_000), NOW, "en"), "59 minutes");
    assert.equal(arkCrisisDuration(at(60 * 60_000), NOW, "en"), "1 hour");
    assert.equal(arkCrisisDuration(at(5 * 3_600_000 + 1_000), NOW, "en"), "5 hours");
    assert.equal(arkCrisisDuration(at(47 * 3_600_000 + 59 * 60_000), NOW, "en"), "47 hours");
    assert.equal(arkCrisisDuration(at(48 * 3_600_000), NOW, "en"), "2 days");
    assert.equal(arkCrisisDuration(at(-3_600_000), NOW, "en"), "1 minute", "a clock a little ahead never shows a negative time");
    assert.equal(arkCrisisDuration(at(5 * 3_600_000), NOW, "de"), "5 Stunden");
    assert.equal(arkCrisisDuration(at(5 * 3_600_000), NOW, "not-a-locale-xx-"), "5 hours");
});

test("countries: names in the reader's language, from the codes; an unknown code stays as it is", () => {
    assert.deepEqual(arkCrisisCountries(["DE", "PL", "FR"], "en"), ["Germany", "Poland", "France"]);
    assert.deepEqual(arkCrisisCountries(["DE"], "de"), ["Deutschland"]);
    assert.deepEqual(arkCrisisCountries(["ZZ", "NOT"], "en"), ["ZZ", "NOT"]);
    assert.deepEqual(arkCrisisCountries([], "en"), []);
});

test("See it in the Ark: an animal alive now, else the kind; never for a kind lost from the wild", () => {
    const [boar, , , saved, extinct] = decodeArkCrises(fixture().crises)!;
    assert.equal(arkCrisisFocus(boar), "b7f4a3d2-9e1c-4b6a-8f20-3c5d7e9a1b02");
    assert.equal(arkCrisisSeeItPath(boar), "/ark?focus=b7f4a3d2-9e1c-4b6a-8f20-3c5d7e9a1b02&follow=1");
    assert.equal(arkCrisisSeeItPath({...boar, lastAnimalIds: []}), `/ark?focus=${boar.speciesProfileId}`);
    assert.ok(arkCrisisSeeItPath(saved));
    assert.equal(arkCrisisSeeItPath(extinct), null);
});

test("deep link: /ark/endangered?crisis=<id>; only a crisis id counts", () => {
    assert.equal(arkCrisisLink(ARK_CRISES_FIXTURE_IDS.lynx), `/ark/endangered?crisis=${ARK_CRISES_FIXTURE_IDS.lynx}`);
    assert.equal(arkCrisisFromQuery(ARK_CRISES_FIXTURE_IDS.lynx.toUpperCase()), ARK_CRISES_FIXTURE_IDS.lynx);
    assert.equal(arkCrisisFromQuery("nope"), null);
    assert.equal(arkCrisisFromQuery(undefined), null);
});

test("a crisis in words, for a screen reader and the plain-text view", () => {
    const [boar, , , saved] = decodeArkCrises(fixture().crises)!;
    assert.equal(arkCrisisBandWord(ARK_ENDANGERED_WORDS_EN, boar), "Last one");
    assert.equal(arkCrisisSummary(ARK_ENDANGERED_WORDS_EN, boar, NOW, "en"), "Wild Boar, Last one, In the wild: 1, In danger for 5 hours");
    assert.equal(arkCrisisSummary(ARK_ENDANGERED_WORDS_EN, saved, NOW, "en"), "Snow Leopard, Saved: this kind is out of danger");
});

test("words: English key by key under a locale's missing or empty ones", () => {
    assert.equal(arkEndangeredWords({title: "  ", empty: "Rien"}).title, "Endangered now");
    assert.equal(arkEndangeredWords({title: "  ", empty: "Rien"}).empty, "Rien");
    assert.equal(arkEndangeredWords(null).seeInArk, "See it in the Ark");
});

test("the locale files carry every word, with the same placeholders, in all 45 languages and never gendered pronouns in English", () => {
    const root = path.join(__dirname, "..", "data", "locales");
    const english = JSON.parse(readFileSync(path.join(root, "en.json"), "utf8")).ark.endangered as Record<string, string>;
    assert.deepEqual(Object.keys(english).sort(), Object.keys(ARK_ENDANGERED_WORDS_EN).sort());
    for (const [key, value] of Object.entries(ARK_ENDANGERED_WORDS_EN)) assert.equal(english[key], value, `en ${key} is the code's English`);
    assert.ok(!/\b(he|she|his|her|him)\b/i.test(Object.values(english).join(" ")));
    const languages = ["id", "ar", "bn", "ca", "cs", "da", "de", "el", "es", "fa", "fi", "fil", "fr", "gu", "he", "hi", "hr", "hu", "it", "ja", "kn", "ko", "ml", "mr", "ms", "nb", "nl", "pa", "pl", "pt", "ro", "ru", "sk", "sv", "sw", "ta", "te", "th", "tr", "uk", "ur", "vi", "zh-Hans", "zh-Hant"];
    for (const language of languages) {
        const file = language === "id" ? path.join(root, "id.json") : path.join(root, "ark", `${language}.json`);
        const local = JSON.parse(readFileSync(file, "utf8")).ark.endangered as Record<string, string>;
        for (const [key, source] of Object.entries(english)) {
            assert.ok(local[key]?.trim(), `${language} lacks ${key}`);
            assert.deepEqual(local[key].match(/\{\w+\}/g) ?? [], source.match(/\{\w+\}/g) ?? [], `${language} ${key}: placeholders`);
        }
        if (language !== "id") assert.notEqual(local.title, english.title, `${language}: the title is translated`);
    }
});
