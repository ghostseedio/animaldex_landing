import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {test} from "node:test";
import {
    ARK_MOMENT_ENGLISH,
    arkMomentAgo,
    arkMomentCaption,
    arkMomentHref,
    arkMomentRowsFromRpc,
    arkMomentWords,
    parseArkMoment,
    parseArkMoments,
    placeArkMoments,
    planArkMomentSlots,
    type ArkMoment
} from "./ark-moments";
import en from "../data/locales/en.json";
import id from "../data/locales/id.json";

const ANIMAL = "5b0f2a9e-0f6e-4c1a-9a43-3a2d4f1b7c11";

/** The contract's two fixtures: an own young (Grey Crowned Crane) and a public first aboard (Song Sparrow). */
const own = {
    moment_id: "0b6d7a51-3c1e-4f0a-9d2b-000000000001",
    kind: "your_young",
    tier: "own",
    slot: 5,
    happened_at: "2026-11-18T01:00:00Z",
    ark_day: 210,
    species_profile_id: "1c2d3e4f-0000-4000-8000-000000000001",
    species_name: "Grey Crowned Crane",
    species_slug: "grey-crowned-crane",
    model_slug: "grey-crowned-crane",
    zone: "wetland",
    focus_animal_id: ANIMAL,
    facts: {young: 2, from_egg: true},
    credit: null
};
const pub = {
    moment_id: "0b6d7a51-3c1e-4f0a-9d2b-000000000002",
    kind: "first_aboard",
    tier: "public",
    slot: 18,
    happened_at: "2026-11-17T22:00:00Z",
    ark_day: 212,
    species_profile_id: "1c2d3e4f-0000-4000-8000-000000000002",
    species_name: "Song Sparrow",
    species_slug: "song-sparrow",
    model_slug: "song-sparrow",
    zone: "woodland",
    focus_animal_id: "5b0f2a9e-0f6e-4c1a-9a43-3a2d4f1b7c12",
    facts: {},
    credit: {display_name: "Lena", handle: "lena"}
};

const caption = (row: Record<string, unknown>, locale = "en") => arkMomentCaption(parseArkMoment(row) as ArkMoment, ARK_MOMENT_ENGLISH, locale);

test("parses the contract's rows; tier follows the kind; credit only on public rows", () => {
    const a = parseArkMoment(own)!;
    assert.equal(a.kind, "your_young");
    assert.equal(a.tier, "own");
    assert.equal(a.slot, 5);
    assert.deepEqual(a.facts, {young: 2, fromEgg: true});
    assert.equal(a.focusAnimalId, ANIMAL);
    const b = parseArkMoment(pub)!;
    assert.deepEqual(b.credit, {displayName: "Lena", handle: "lena"});
    assert.equal(parseArkMoment({...own, tier: "public", credit: {display_name: "X"}})!.credit, null);
    assert.equal(parseArkMoment({...own, tier: "public"})!.tier, "own");
});

test("unknown kinds and malformed rows are skipped", () => {
    assert.equal(parseArkMoment({...own, kind: "hunt"}), null);
    assert.equal(parseArkMoment({...own, moment_id: "nope"}), null);
    assert.equal(parseArkMoment({...own, ark_day: "210"}), null);
    assert.equal(parseArkMoment({...own, species_name: null}), null);
    assert.equal(parseArkMoment({...own, kind: "your_line", facts: {}}), null);
    assert.equal(parseArkMoment({...own, kind: "species_milestone", facts: {}}), null);
    assert.equal(parseArkMoment(null), null);
    assert.equal(parseArkMoment([own]), null);
    // The Ark's total needs no species; extinction and the total never focus an animal.
    const total = parseArkMoment({...pub, kind: "ark_milestone", species_name: null, facts: {mark: 4000}})!;
    assert.equal(total.focusAnimalId, null);
    assert.equal(parseArkMoment({...pub, kind: "extinction"})!.focusAnimalId, null);
    assert.equal(parseArkMoment({...own, focus_animal_id: "x"})!.focusAnimalId, null);
});

test("a session keeps valid rows once each, own first, at most two", () => {
    const list = parseArkMoments([pub, {...own, kind: "hunt"}, own, own, {...pub, moment_id: "0b6d7a51-3c1e-4f0a-9d2b-000000000003"}]);
    assert.deepEqual(list.map((m) => m.id), [own.moment_id, pub.moment_id]);
    assert.deepEqual(parseArkMoments("nope"), []);
});

test("a missing RPC or any error is no moments", () => {
    assert.deepEqual(arkMomentRowsFromRpc(null, {code: "PGRST202", message: "Could not find the function"}), []);
    assert.deepEqual(arkMomentRowsFromRpc([own], {code: "42883"}), []);
    assert.deepEqual(arkMomentRowsFromRpc({}, null), []);
    assert.deepEqual(arkMomentRowsFromRpc([own, pub], null), [own, pub]);
});

test("placement: no poll, the moments keep their slots", () => {
    const [a, b] = parseArkMoments([own, pub]);
    assert.deepEqual(planArkMomentSlots([a, b], null).map((p) => p.slot), [5, 18]);
});

test("placement: the poll keeps its slot and moments move to stay 8 apart", () => {
    const [a, b] = parseArkMoments([own, pub]);
    // Poll at 6: the own moment (5) is within 8, so it goes to 14; the public one (18) is within 8 of 14, so 22.
    assert.deepEqual(planArkMomentSlots([a, b], 6).map((p) => p.slot), [14, 22]);
    // Poll at 8, moment at 4: |4 - 8| < 8 -> 16.
    assert.deepEqual(planArkMomentSlots([{...a, slot: 4}], 8).map((p) => p.slot), [16]);
    // A moment far enough from the poll stays.
    assert.deepEqual(planArkMomentSlots([{...b, slot: 16}], 8).map((p) => p.slot), [16]);
    // Two moments close together, no poll: the second goes 8 after the first.
    assert.deepEqual(planArkMomentSlots([{...a, slot: 6}, {...b, slot: 8}], null).map((p) => p.slot), [6, 14]);
    // Never more than two.
    const c = {...b, id: "0b6d7a51-3c1e-4f0a-9d2b-000000000009", slot: 30};
    assert.equal(planArkMomentSlots([a, b, c], null).length, 2);
});

test("placement in the feed: after N posts, not counting debates or the poll, dropped beyond the loaded posts", () => {
    const [a, b] = parseArkMoments([own, pub]);
    type Slot = {kind: "post"; n: number} | {kind: "debate"} | {kind: "poll"} | {kind: "moment"; id: string};
    const posts = (count: number): Slot[] => Array.from({length: count}, (_, i) => ({kind: "post", n: i + 1}));
    const feed: Slot[] = [...posts(3), {kind: "debate"}, ...posts(3), {kind: "poll"}, ...posts(14)];
    const placed = placeArkMoments<Slot>(feed, planArkMomentSlots([a, b], null), (m) => ({kind: "moment", id: m.id}));
    const at = (id: string) => placed.findIndex((s) => s.kind === "moment" && s.id === id);
    const postsBefore = (index: number) => placed.slice(0, index).filter((s) => s.kind === "post").length;
    assert.equal(postsBefore(at(own.moment_id)), 5);
    assert.equal(placed[at(own.moment_id) - 1].kind, "post");
    assert.equal(postsBefore(at(pub.moment_id)), 18);
    // Only 12 posts loaded: the second moment (slot 18) is not shown yet.
    const short = placeArkMoments<Slot>(posts(12), planArkMomentSlots([a, b], null), (m) => ({kind: "moment", id: m.id}));
    assert.deepEqual(short.filter((s) => s.kind === "moment").map((s) => (s as {id: string}).id), [own.moment_id]);
    // Exactly as many posts as the slot: shown, last.
    const exact = placeArkMoments<Slot>(posts(5), planArkMomentSlots([a], null), (m) => ({kind: "moment", id: m.id}));
    assert.equal(exact[exact.length - 1].kind, "moment");
    assert.deepEqual(placeArkMoments<Slot>([], planArkMomentSlots([a], null), (m) => ({kind: "moment", id: m.id})), []);
});

test("captions from kind and facts, in the contract's words", () => {
    assert.deepEqual(caption(own), {title: "Your Grey Crowned Crane is a parent", facts: "2 young hatched · Ark day 210", credit: null});
    assert.deepEqual(caption(pub), {title: "The first Song Sparrow came aboard the Ark", facts: "Ark day 212", credit: "Brought aboard by Lena"});
    assert.equal(caption({...pub, credit: {display_name: "", handle: "lena"}}).credit, "Brought aboard by @lena");
    assert.equal(caption({...pub, credit: null}).credit, null);
    assert.equal(caption({...own, kind: "your_first_aboard", facts: {}}).title, "Your Grey Crowned Crane is the first of its kind on the Ark");
    assert.equal(caption({...own, kind: "your_line", facts: {generation: 3}}).title, "Your Grey Crowned Crane's line reached generation 3");
    const firstYoung = caption({...pub, kind: "first_young", facts: {young: 3, from_egg: false}});
    assert.deepEqual(firstYoung, {title: "First Song Sparrow young born on the Ark", facts: "3 young born · Ark day 212", credit: "From Lena's line"});
    assert.equal(caption({...pub, kind: "first_young", facts: {young: 2, from_egg: true}}).title, "First Song Sparrow young hatched on the Ark");
    assert.deepEqual(caption({...pub, kind: "new_generation", facts: {generation: 4}, credit: null}), {title: "Generation 4 is born on the Ark", facts: "Song Sparrow · Ark day 212", credit: null});
    assert.equal(caption({...pub, kind: "species_milestone", facts: {mark: 25}}).title, "Song Sparrow: 25 now aboard the Ark");
    assert.equal(caption({...pub, kind: "ark_milestone", species_name: null, facts: {mark: 4000}}).title, "4,000 animals now aboard the Ark");
    assert.equal(caption({...pub, kind: "ark_milestone", species_name: null, facts: {mark: 4000}}, "de").title, "4.000 animals now aboard the Ark");
    assert.deepEqual(caption({...pub, kind: "extinction", facts: {first_ark_day: 82}, credit: null}), {
        title: "The last Song Sparrow on the Ark has died",
        facts: "It came aboard on day 82. · Ark day 212",
        credit: null
    });
    assert.equal(caption({...pub, kind: "extinction", facts: {}, credit: null}).facts, "Ark day 212");
});

test("the button opens the Ark on the animal and follows it, or the plain Ark", () => {
    assert.equal(arkMomentHref(parseArkMoment(own)!), `/ark?focus=${ANIMAL}&follow=1`);
    assert.equal(arkMomentHref(parseArkMoment({...pub, kind: "extinction"})!), "/ark");
});

test("how long ago", () => {
    const now = Date.parse("2026-11-18T03:00:00Z");
    assert.equal(arkMomentAgo("2026-11-18T01:00:00Z", "en", now), "2 hr. ago");
    assert.equal(arkMomentAgo(null, "en", now), null);
    assert.equal(arkMomentAgo("2026-11-15T03:00:00Z", "en", now), "3 days ago");
});

test("words: every locale file has every key, the same placeholders, and nothing gendered in English", () => {
    const keys = Object.keys(ARK_MOMENT_ENGLISH) as (keyof typeof ARK_MOMENT_ENGLISH)[];
    assert.deepEqual(arkMomentWords(en), ARK_MOMENT_ENGLISH);
    assert.deepEqual(arkMomentWords(null), ARK_MOMENT_ENGLISH);
    const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
    const files: Record<string, unknown> = {en, id};
    const dir = new URL("../data/locales/ark/", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) files[file] = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    for (const [name, messages] of Object.entries(files)) {
        const raw: Record<string, unknown> | undefined = (messages as {ark?: {moments?: Record<string, unknown>}}).ark?.moments;
        assert.ok(raw, `${name}: ark.moments`);
        for (const key of keys) {
            const text: unknown = raw[key];
            assert.equal(typeof text, "string", `${name}: ${key}`);
            assert.equal(holes(text as string), holes(ARK_MOMENT_ENGLISH[key]), `${name}: ${key} placeholders`);
            if (name !== "en" && key !== "label") assert.notEqual(text, ARK_MOMENT_ENGLISH[key], `${name}: ${key} untranslated`);
        }
    }
    for (const text of Object.values(ARK_MOMENT_ENGLISH)) assert.doesNotMatch(text, /\b(he|she|his|her|mother|father)\b/i);
    assert.equal(arkMomentWords(id).notNow !== "Not now", true);
});
