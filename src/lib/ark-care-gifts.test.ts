import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import test from "node:test";
import {ARK_CARE_ENGLISH, arkCareDoes, arkCareError, arkCareLines, arkCareWords, parseArkCare} from "@/lib/ark-care-gifts";
import {careItems, careNotes} from "@/ark-scene/live/care-lines";
import {escapeItems} from "@/ark-scene/live/escape-lines";
import {type ArkLiveText} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";

/** Gifts as Ark care (AnimalDex GIFTS-CARE, decision 387; docs/ark/gifts-care.md): the card's care and the log lines. */

const en = JSON.parse(readFileSync("src/data/locales/en.json", "utf8"));
const words = {live: {...ARK_LIVE_ENGLISH, ...en.ark.live}, replay: en.ark.replay} as unknown as ArkLiveText;
const NOW = Date.parse("2026-11-21T12:00:00.000Z");
const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

const serverCare = {
    enabled: true,
    card: "c0000000-0000-4000-8000-000000000001",
    mine: false,
    care: [
        {care: "meal", state: "applied", sent_at: iso(NOW - 2 * H), until_at: iso(NOW + 48 * H), by_username: "ada"},
        {care: "shelter", state: "applied", sent_at: iso(NOW - 3 * H), until_at: iso(NOW + 20 * H), used_at: iso(NOW - H), by_you: true},
        {care: "nest", state: "queued", sent_at: iso(NOW - 60_000)},
        {care: "meal", state: "applied", sent_at: iso(NOW - 100 * H), until_at: iso(NOW - H)},
        {care: "xp", state: "applied", sent_at: iso(NOW)},
        {care: "meal", state: "applied", sent_at: iso(NOW), until_at: iso(NOW + 5 * H), by_username: "<script>"}
    ],
    catalog: {
        enabled: true,
        definitions: [
            {id: "d1", slug: "ark_meal", care_kind: "meal", credit_cost: 5, available: true, effect: {real_days: 2}},
            {id: "d2", slug: "ark_shelter", care_kind: "shelter", credit_cost: 5, available: false, reason: "launch_grace"},
            {id: "d3", slug: "ark_nest", care_kind: "nest", credit_cost: 10, available: true, effect: {real_days: 3}}
        ]
    }
};

test("off, missing or broken: nothing shows", () => {
    assert.equal(parseArkCare({care: null}), null);
    assert.equal(parseArkCare({care: {enabled: false}}), null);
    assert.equal(parseArkCare(null), null);
    assert.equal(parseArkCare("x"), null);
});

test("the card says what each gift did, and who gave it only as the server allows", () => {
    const care = parseArkCare({care: serverCare})!;
    assert.equal(care.card, serverCare.card);
    // The unknown kind is dropped; an unsafe username is never shown (a visitor instead).
    assert.equal(care.items.length, 5);
    const w = arkCareWords(null);
    assert.deepEqual(arkCareLines(care, w, "en", NOW, 5), [
        "Fed by a visitor · fuller for 5 hours",
        "Nesting help from a visitor · on its way",
        "Fed by @ada · fuller for 2 days",
        "Sheltered by you · it stopped a hunt"
    ]);
    assert.deepEqual(arkCareLines(care, w, "en", NOW).length, 3, "at most three");
});

test("the offers: only what would work now, each saying what it does before it costs anything", () => {
    const care = parseArkCare({care: serverCare})!;
    const w = arkCareWords(null);
    assert.deepEqual(care.offers.map((o) => [o.care, o.available, o.cost]), [["meal", true, 5], ["shelter", false, 5], ["nest", true, 10]]);
    assert.equal(arkCareDoes(care.offers[0], w, "en"), "Fuller for 2 days");
    assert.equal(arkCareDoes(care.offers[1], w, "en"), "Safe from one hunt for 1 day");
    assert.equal(arkCareDoes(care.offers[2], w, "en"), "A better chance of young for 3 days");
    assert.equal(arkCareDoes(care.offers[0], w, "de"), "Fuller for 2 Tage", "the span in the reader's language");
});

test("a failed send in plain words", () => {
    const w = ARK_CARE_ENGLISH;
    assert.equal(arkCareError("insufficient_credits", w), w.noCredits);
    assert.equal(arkCareError("gift_rate_limited", w), w.limit);
    assert.equal(arkCareError("gift_account_too_new", w), w.tooNew);
    assert.equal(arkCareError("gift_not_available", w), w.notNow);
    assert.equal(arkCareError("boom", w), w.failed);
});

const at = "2026-11-21T10:00:00.000Z";
const fox = {id: "f1", name: "Red Fox", species_profile_id: "sp-fox", zone: "woodland"};
const vole = {id: "v1", name: "Field Vole", species_profile_id: "sp-vole", zone: "woodland"};
const rows = [
    {id: 1, kind: "fed", at, ark_day: 400.2, animal: fox, source: "gift"},
    {id: 2, kind: "escaped", at, animal: vole, other: fox, reason: "shelter"},
    {id: 3, kind: "mated", at, animal: vole, other: vole, parents: ["v1"], nest: true},
    // Not care: said by their own modules.
    {id: 4, kind: "fed", at, animal: fox, source: "step"},
    {id: 5, kind: "escaped", at, animal: vole, other: fox},
    {id: 6, kind: "mated", at, animal: vole, other: vole, parents: ["v1"]}
];

test("the live log: a visitor's meal, shelter and nesting help, never who gave it", () => {
    const items = careItems({events: rows}, 0, () => false, words);
    assert.deepEqual(items.map((i) => i.line), [
        "A Red Fox was given a meal by a visitor",
        "A Field Vole was safe from a Red Fox in a visitor's shelter",
        "A Field Vole mated, with a visitor's nesting help"
    ]);
    assert.equal(items[1].focus.animalId, "v1");
    assert.equal(careItems({events: rows}, 0, (key) => key === "care:1", words).length, 2);
    assert.equal(careNotes({events: rows}, words).map((n) => n.animalId).join(","), "f1,v1,v1");
    // A shelter's escape is not said again as a plain escape.
    assert.deepEqual(escapeItems({events: rows}, 0, () => false).map((i) => i.id), ["event:5"]);
});

test("every Ark language has the care words, with the same placeholders", () => {
    const dir = "src/data/locales/ark";
    const bundles = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => `${dir}/${f}`);
    const all = ["src/data/locales/en.json", "src/data/locales/id.json", ...bundles];
    assert.equal(all.length, 45);
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const file of all) {
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        for (const [key, english] of Object.entries(ARK_CARE_ENGLISH)) {
            assert.equal(typeof ark.care?.[key], "string", `${file} care.${key}`);
            assert.equal(holes(ark.care[key]), holes(english), `${file} care.${key}`);
        }
        for (const key of ["giftMeal", "giftShelter", "giftNest"] as const) {
            assert.equal(holes(ark.live[key]), holes(ARK_LIVE_ENGLISH[key]!), `${file} live.${key}`);
        }
    }
    assert.deepEqual(en.ark.care, ARK_CARE_ENGLISH, "en.json is the English");
});
