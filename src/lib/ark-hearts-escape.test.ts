import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ARK_HEARTS_ENGLISH, arkHeartsWords, arkLivesText, arkRecoveringText, decodeArkOwnerHearts} from "./ark-hearts";
import {arkAgeRisk, arkHeartsEscape, arkHeartsVariant, arkOldAgeFinal, decodeArkHeartsRules, type ArkHeartsRules} from "./ark-hearts-rules";
import {arkLiveLineText, arkLiveServerItems, type ArkLiveText} from "./ark-live-log";
import {ARK_LIVE_ENGLISH} from "./ark-live-words";
import {decodeArkEvents, planArkReplay} from "./ark-life";
import {arkReadEvents} from "./ark-rankings";
import {arkCauseBars} from "./ark-rankings-text";
import {arkSpeciesTrendLine, arkSpeciesTrends} from "./ark-species-trend";
import {ARK_LOST_WORDS_EN, arkExtinctHow, decodeArkExtinctions} from "./ark-extinct";
import {decodeArkLife} from "./ark-life";
import {arkCompactHistory, arkKindSeries, arkRebucketDays, decodeArkHistory} from "./ark-population-history";
import {arkReleaseWords, ARK_RELEASE_ENGLISH} from "./ark-release";
import {arkSurvivalHeartsWords} from "./ark-rankings-words";
import {companionWords, companionWordsForHearts} from "./companion-bond";
import {arkMomentText} from "./ark-life-so-far";
import {escapeActs, escapeItems, escapeText} from "@/ark-scene/live/escape-lines";
import {forestItems, forestText} from "@/ark-scene/live/forest-lines";
import {closeCallRow, closeCallText, heartsNotes, rescueItems, rescueText} from "@/ark-scene/live/hearts-lines";
import {planArkEventReplay} from "@/ark-scene/replay/event-replay";
import {arkReplayText} from "@/ark-scene/replay/text";
import {arkSeenGroup} from "@/ark-scene/seen/live-cast";
import type {ArkSnapshot} from "@/ark-scene/types";

const locales = path.join(__dirname, "..", "data", "locales");
const english = JSON.parse(readFileSync(path.join(locales, "en.json"), "utf8"));
const words = english.ark as ArkLiveText;

const OFF: ArkHeartsRules = {hearts: true, escape: false, oldAge: "return"};
const FINAL: ArkHeartsRules = {hearts: true, escape: true, oldAge: "final"};
const RETURN: ArkHeartsRules = {hearts: true, escape: true, oldAge: "return"};

const id = (n: number) => `0000feed-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const at = "2026-11-27T10:00:00.000Z";
const animal = (n: number, name: string, slug: string, species: string, over: Record<string, unknown> = {}) => ({id: id(n), species_profile_id: species, name, model_slug: slug, zone: "woodland", island: "wild", area: null, enclosure: null, slot: n, slot_rank: 0, origin: "arrived", generation: 0, activity: "diurnal", sociality: null, arrived_at: "2026-11-01T00:00:00Z", status: "present", thrive: "ordinary", placeholder: false, ...over});
const vole = (n = 1, over: Record<string, unknown> = {}) => animal(n, "Field Vole", "field-vole", "sp-vole", over);
const fox = (n = 9, over: Record<string, unknown> = {}) => animal(n, "Red Fox", "red-fox", "sp-fox", over);
const row = (serial: number, kind: string, more: Record<string, unknown> = {}) => ({id: serial, kind, at, ark_day: 472.1, animal: null, other: null, parents: [], bringers: [], from_egg: false, clutch: null, phrase: null, source: null, thrive: null, species: "Field Vole", species_profile_id: "sp-vole", ...more});

// What the public read sends while hearts_escape is ON (docs/ark/hearts-escape.md, "Public read"), and what it sends with it OFF.
const wounded = row(1, "escaped", {animal: vole(1), other: fox(9), wounded: true, lives: {heartsLeft: 2, returnsDay: 500.5}, payload: {encounter: {t: Date.parse(at) / 1000 - 30, predator: {x: 1, z: 2}, prey: {x: 3, z: 4, r: 2}}}});
const woundedLast = row(2, "escaped", {animal: vole(2), other: fox(9), wounded: true, lives: {heartsLeft: 0, returnsDay: 500.5}});
const woundedNoLives = row(3, "escaped", {animal: vole(3), other: fox(9), wounded: true});
const plain = row(4, "escaped", {animal: vole(4), other: fox(9)});
const shelter = row(5, "escaped", {animal: vole(5), other: fox(9), reason: "shelter"});
const rescue = row(6, "fed", {animal: vole(6), rescued: true, lives: {heartsLeft: 1, returnsDay: 505}});
const feed = row(7, "fed", {animal: vole(7), source: "step"});
const oldFinal = row(8, "death_old", {animal: vole(8, {status: "died_old"}), lives: {heartsLeft: 3, final: true}});
const oldBack = row(9, "death_old", {animal: vole(9, {status: "died_old"}), lives: {heartsLeft: 1, returnsDay: 600}});
const back = row(10, "revived", {animal: vole(10), lives: {heartsLeft: 1, ageReset: false, cause: "eaten"}});
const backYoung = row(11, "revived", {animal: vole(11), lives: {heartsLeft: 0, ageReset: true, cause: "died_old"}});
const logging = row(12, "deforested", {animal: vole(12, {status: "died_old"}), forest: {x: 1, z: 2, lives: {heartsLeft: 2, returnsDay: 520}}});
const loggingFinal = row(13, "deforested", {animal: vole(13, {status: "died_old"}), forest: {x: 1, z: 2, lives: {heartsLeft: 0, final: true}}});

test("the rule: decoded, and a read that is missing or says nothing is today's rule", () => {
    assert.deepEqual(decodeArkHeartsRules({hearts: true, escape: true, oldAge: "final"}), FINAL);
    assert.deepEqual(decodeArkHeartsRules({hearts: true, escape: true, oldAge: "return"}), RETURN);
    assert.deepEqual(decodeArkHeartsRules({hearts: true, escape: false, oldAge: "return"}), OFF);
    // The escape needs hearts; with the escape off old age is not "final" whatever the read says.
    assert.deepEqual(decodeArkHeartsRules({hearts: false, escape: true, oldAge: "final"}), {hearts: false, escape: false, oldAge: "return"});
    assert.deepEqual(decodeArkHeartsRules({hearts: true, escape: false, oldAge: "final"}), OFF);
    assert.equal(decodeArkHeartsRules(null), null);
    assert.equal(decodeArkHeartsRules([]), null);
    assert.equal(decodeArkHeartsRules({escape: true}), null);
    assert.equal(arkHeartsEscape(null), false);
    assert.equal(arkHeartsEscape(OFF), false);
    assert.equal(arkHeartsEscape(FINAL), true);
    assert.equal(arkOldAgeFinal(FINAL), true);
    assert.equal(arkOldAgeFinal(RETURN), false);
    assert.equal(arkOldAgeFinal(OFF), false);
    assert.equal(arkHeartsVariant(null, "plain", "final", "return"), "plain");
    assert.equal(arkHeartsVariant(OFF, "plain", "final", "return"), "plain");
    assert.equal(arkHeartsVariant(FINAL, "plain", "final", "return"), "final");
    assert.equal(arkHeartsVariant(RETURN, "plain", "final", "return"), "return");
    assert.equal(arkHeartsVariant(RETURN, "plain", "final", undefined), "plain", "never the other state's words");
    assert.equal(arkHeartsVariant(FINAL, "plain", undefined, "return"), "plain");
});

test("the card's hearts words: off they are the lives' exactly; on they say hearts and what a heart does, in both states of old age", () => {
    const lives = arkHeartsWords(null);
    assert.equal(arkLivesText(3, lives), "3 lives in the Ark");
    assert.equal(arkLivesText(1, lives), "1 life in the Ark");
    assert.equal(arkLivesText(0, lives), "No lives left in the Ark");
    assert.equal(lives.note, "Each heart is one more life for your animal in the Ark.");
    // Off (a read that does not say, the escape off): the same object, key by key, as before the rule existed.
    for (const rules of [undefined, null, OFF, {hearts: false, escape: true, oldAge: "final"} as ArkHeartsRules]) {
        const same = arkHeartsWords(english.ark.hearts, rules);
        assert.equal(same.recoveringByCause, undefined);
        for (const key of ["livesOne", "livesOther", "livesNone", "note", "recovering", "away"] as const) assert.equal(same[key], english.ark.hearts[key], key);
    }
    const final = arkHeartsWords(english.ark.hearts, FINAL);
    assert.equal(arkLivesText(3, final), "3 hearts in the Ark");
    assert.equal(arkLivesText(1, final), "1 heart in the Ark");
    assert.equal(arkLivesText(0, final), "No hearts left in the Ark");
    assert.equal(final.note, "Each heart lets your animal survive one attack or one hungry spell in the Ark. Hearts can't hold back old age.");
    const back = arkHeartsWords(english.ark.hearts, RETURN);
    assert.equal(back.note, "Each heart lets your animal survive one attack or one hungry spell in the Ark. A heart also brings it back from old age as a young adult.");
    assert.equal(arkLivesText(2, back), "2 hearts in the Ark");
    // Nothing of the lives' words is left in either state.
    for (const w of [final, back]) assert.equal(/\blives?\b|another life/i.test([w.livesOne, w.livesOther, w.livesNone, w.note].join(" ")), false);
});

test("the Recovering chip says what the heart was spent surviving, only while a heart is a survived attack", () => {
    const now = Date.UTC(2026, 10, 27, 4);
    const returnsAt = new Date(now + 24 * 3_600_000).toISOString();
    const lives = arkHeartsWords(english.ark.hearts, null);
    const on = arkHeartsWords(english.ark.hearts, FINAL);
    for (const cause of ["eaten", "starved", "deforested", "died_old", null] as const) assert.equal(arkRecoveringText({returnsAt, cause}, now, lives), "Recovering · returns tomorrow", String(cause));
    assert.equal(arkRecoveringText({returnsAt, cause: "eaten"}, now, on), "Lying up, wounded · returns tomorrow");
    assert.equal(arkRecoveringText({returnsAt, cause: "starved"}, now, on), "In the town's care · returns tomorrow");
    assert.equal(arkRecoveringText({returnsAt, cause: "deforested"}, now, on), "Lost its home · returns tomorrow");
    // (A recovery from old age, still possible while old age returns, and one with no cause: the plain chip.)
    assert.equal(arkRecoveringText({returnsAt, cause: "died_old"}, now, arkHeartsWords(english.ark.hearts, RETURN)), "Recovering · returns tomorrow");
    assert.equal(arkRecoveringText({returnsAt, cause: null}, now, on), "Recovering · returns tomorrow");
    assert.equal(arkRecoveringText({returnsAt: null, cause: "eaten"}, now, on), "Lying up, wounded · returns tomorrow");
});

test("the owner's hearts read carries the rule, and a logging recovery is a cause", () => {
    const CARD = "33333333-3333-4333-8333-333333333333";
    const A = "11111111-1111-4111-8111-111111111111";
    const read = decodeArkOwnerHearts({healCost: 5, animals: {[A]: {captureId: CARD, hearts: 2, status: "recovering", cause: "deforested", returnsAt: at}}}, {hearts: true, escape: true, oldAge: "final"});
    assert.deepEqual(read?.rules, FINAL);
    assert.equal(read?.animals[A].cause, "deforested");
    assert.equal(decodeArkOwnerHearts({healCost: 5, animals: {}})?.rules, undefined);
    assert.equal(decodeArkOwnerHearts({healCost: 5, animals: {}}, "nonsense")?.rules, undefined);
});

test("the live log: a wounded escape is said as one, with its hearts left; a plain miss and a shelter's are as they were", () => {
    const items = escapeItems({events: [wounded, woundedLast, woundedNoLives, plain, shelter]}, 0, () => false);
    assert.deepEqual(items.map((i) => i.id), ["event:1", "event:2", "event:3", "event:4"], "a shelter's escape is care-lines'");
    assert.deepEqual(items.map((i) => [Boolean(i.hurt), i.hearts]), [[true, 2], [true, 0], [true, undefined], [false, undefined]]);
    const said = items.map((i) => escapeText(i, words, "en"));
    assert.deepEqual(said, [
        "A Field Vole got away from a Red Fox, wounded, and is lying up · 2 ♥ left",
        "A Field Vole got away from a Red Fox, wounded, and is lying up · no ♥ left",
        "A Field Vole got away from a Red Fox, wounded, and is lying up",
        "A Field Vole got away from a Red Fox"
    ]);
    // Never folded into a plain "got away ×2": its own key.
    assert.notEqual(items[0].key, items[3].key);
    assert.equal(items[3].key, "escaped:sp-vole:sp-fox", "the plain escape's key is exactly what it was");
    assert.deepEqual(items[3], {id: "event:4", kind: "revived", say: "escaped", source: "server", key: "escaped:sp-vole:sp-fox", animal: "Field Vole", other: "Red Fox", count: 1, eggs: null, focus: {animalId: id(4), speciesId: "sp-vole", zone: "woodland"}}, "the plain escape's item is byte for byte what it was");
    // A language without the new line says the plain one's words (English under it) rather than nothing.
    assert.equal(escapeText(items[0], {...words, live: {...words.live, escapedWounded: undefined}} as ArkLiveText, "en"), "A Field Vole got away from a Red Fox, wounded, and is lying up · 2 ♥ left");
});

test("the scene still acts a wounded escape with the escape act and its limp: one act, the prey and the hunter, from the encounter's step, never a death", () => {
    const acts = escapeActs({events: [wounded, plain]}, -Infinity);
    assert.deepEqual(acts.map((a) => [a.key, a.prey, a.predator]), [["escaped:1", id(1), id(9)], ["escaped:4", id(4), id(9)]]);
    assert.ok(acts[0].encounter, "the encounter's geometry rides with it");
    // No death line, no death body: the rows carry no `eaten`, and a wounded escape makes no item that is a death.
    assert.equal(escapeItems({events: [wounded]}, 0, () => false).some((i) => i.kind === "death" || i.kind === "starved"), false);
    // The prey has left the read (it lies up: `recovering`): the cast brings it back as a stand-in for the act, whole.
    const snapshot: ArkSnapshot = {voyage: {slug: "first", name: "Ark", started_at: null}, counts: {animals: 1, species: 1, founders: 1}, zones: [], animals: [], as_of: at, ark_day: 472};
    const group = arkSeenGroup("1", {events: [wounded]}, snapshot, Date.parse(at) + 90_000);
    assert.ok(group, "an escaped row is acted with a cast");
    assert.equal(group!.kind, "escaped");
    assert.deepEqual(group!.records.map((r) => r.id).sort(), [id(1), id(9)].sort());
    assert.equal(group!.records.every((r) => r.status === "present" || r.status === null), true, "both are drawn whole, the prey is not an `eaten` body");
});

test("the replay of a wounded escape says it wounded, a plain one as it did", () => {
    const snapshot: ArkSnapshot = {voyage: {slug: "first", name: "Ark", started_at: null}, counts: {animals: 0, species: 0, founders: 0}, zones: [], animals: [], as_of: at, ark_day: 472};
    const log = {events: [wounded, plain]};
    const now = Date.parse(at) + 600_000;
    const hurt = planArkEventReplay("1", log, snapshot, {now});
    const miss = planArkEventReplay("4", log, snapshot, {now});
    assert.equal(hurt.kind, "escaped");
    assert.equal(hurt.feed.escapes?.[0].hurt, true);
    assert.equal(hurt.feed.escapes?.[0].hearts, 2);
    assert.equal(miss.feed.escapes?.[0].hurt, undefined);
    assert.equal(arkReplayText(hurt, null, "en").headline, "A Field Vole got away from a Red Fox, wounded, and is lying up · 2 ♥ left");
    assert.equal(arkReplayText(miss, null, "en").headline, "A Field Vole got away from a Red Fox");
});

test("a rescue: found starving and taken into care, with its hearts left; an ordinary feed says nothing new", () => {
    const items = rescueItems({events: [rescue, feed, plain]}, 0, () => false);
    assert.equal(items.length, 1);
    assert.equal(items[0].say, "rescued");
    assert.equal(items[0].hearts, 1);
    assert.equal(rescueText(items[0], words, "en"), "A Field Vole was found starving and taken into care · 1 ♥ left");
    assert.equal(rescueText({animal: "Field Vole", say: "rescued"}, words, "en"), "A Field Vole was found starving and taken into care");
    assert.equal(rescueText({animal: "Field Vole", say: "escaped"}, words, "en"), null);
    assert.equal(rescueItems({events: [rescue]}, 0, (key) => key === "event:6").length, 0, "said once");
    // The animal's own log (and "Its day") gets the same sentences: its rescue, and its wounded escape (the hunter's own log nothing).
    const notes = heartsNotes({events: [wounded, rescue, plain, shelter, feed]}, words, "en");
    assert.deepEqual(notes.map((n) => [n.animalId, n.kind, n.text]), [
        [id(1), "said", "A Field Vole got away from a Red Fox, wounded, and is lying up · 2 ♥ left"],
        [id(6), "said", "A Field Vole was found starving and taken into care · 1 ♥ left"]
    ]);
});

test("a rescue decodes with its hearts, as a death's do; a final death carries no hearts tail", () => {
    const events = decodeArkEvents({events: [rescue, feed, oldFinal, oldBack, back, backYoung]}, null);
    const byId = new Map(events.map((e) => [e.id, e]));
    assert.equal(byId.get("6")?.rescued, true);
    assert.equal(byId.get("6")?.lives?.heartsLeft, 1);
    assert.equal(byId.get("6")?.lives?.returnsDay, 505);
    assert.equal(byId.get("7")?.rescued, undefined);
    // Old age final: the hearts it still held are not a tail (a final death is not protected by them).
    assert.equal(byId.get("8")?.lives?.final, true);
    const items = arkLiveServerItems(events);
    const oldFinalLine = arkLiveLineText(items.find((i) => i.id === "8")!, words, "en");
    assert.equal(oldFinalLine, "The Field Vole died of old age");
    // Old age that still returns (hearts_escape_rules.oldAge "return"): its tail and its young adult's return, as ever.
    assert.equal(arkLiveLineText(items.find((i) => i.id === "9")!, words, "en"), "The Field Vole died of old age · 1 ♥ left");
    assert.equal(arkLiveLineText(items.find((i) => i.id === "10")!, words, "en"), "Field Vole is back");
    assert.equal(arkLiveLineText(items.find((i) => i.id === "11")!, words, "en"), "Field Vole is back, a young adult again", "only an animal recovering from old age at the switch-on");
});

test("logging: a recovery is a lost home while a heart is a survived attack, a death otherwise; no body for the first", () => {
    const sun = {events: [logging, loggingFinal]};
    // (The animals are named as an old-age death names them: the same decoder.)
    const asDeath = forestItems(sun, null, 0, () => false);
    assert.deepEqual(asDeath.map((i) => [i.lost, i.hearts]), [[undefined, 2], [undefined, undefined]]);
    assert.equal(forestText(asDeath[0], words, "en"), "A Field Vole died: its forest was cut down · 2 ♥ left", "off: as it always was");
    const lost = forestItems(sun, null, 0, () => false, true);
    assert.deepEqual(lost.map((i) => [i.lost, i.hearts]), [[true, 2], [undefined, undefined]], "only the one that recovers is a lost home; a final one is a death");
    assert.equal(forestText(lost[0], words, "en"), "A Field Vole lost its home: its forest was cut down · 2 ♥ left");
    assert.equal(forestText(lost[1], words, "en"), "A Field Vole died: its forest was cut down");
});

test("the release sheet's hearts lines: the lives' off, a survived attack on, and old age said as the server runs it", () => {
    const plainWords = arkReleaseWords(english.ark.release, null);
    assert.equal(plainWords.hearts, english.ark.release.hearts);
    assert.equal(plainWords.lastOfKind, english.ark.release.lastOfKind);
    assert.deepEqual(arkReleaseWords(english.ark.release, OFF), plainWords);
    const final = arkReleaseWords(english.ark.release, FINAL);
    assert.equal(final.hearts, "It keeps its hearts. A heart lets it survive one attack or one hungry spell in the wild. With no heart left, a catch is final. Old age is final.");
    assert.equal(final.lastOfKind, "It is the last of its kind aboard. If it is caught with no heart left, or dies of old age, its kind is gone from the Ark.");
    const back = arkReleaseWords(english.ark.release, RETURN);
    assert.equal(back.hearts, "It keeps its hearts. A heart lets it survive one attack or one hungry spell in the wild, and brings it back from old age as a young adult. With no heart left, a catch is final.");
    assert.equal(back.lastOfKind, english.ark.release.lastOfKind, "old age still ends it with no heart left: the line stays true");
    for (const w of [final, back]) assert.equal(/comes back in the wild|loses that heart|it dies\b/i.test(w.hearts), false);
});

test("the survival page's words: 'some get away', not 'some come back', only while a heart is a survived attack", () => {
    const s = english.ark.rankings.survival;
    assert.deepEqual(arkSurvivalHeartsWords(s, null), s);
    assert.deepEqual(arkSurvivalHeartsWords(s, OFF), s);
    const final = arkSurvivalHeartsWords(s, FINAL);
    assert.equal(final.intro, s.introEscape);
    assert.equal(final.placesDescription, s.placesDescriptionEscape);
    assert.equal(final.recoverNote, s.recoverNoteEscape);
    assert.match(final.recoverNote, /Old age is final\.$/);
    const back = arkSurvivalHeartsWords(s, RETURN);
    assert.equal(back.recoverNote, s.recoverNoteEscapeOld);
    assert.match(back.recoverNote, /young adult/);
    assert.equal(/come back|comes back/.test(final.intro + final.placesDescription + final.recoverNote), false);
});

test("the Companions card's hearts band: lives off, hearts on, old age said both ways", () => {
    const words0 = companionWords(english.companions);
    const flags = {heartsInDebates: false, arkHearts: true};
    const lives = companionWordsForHearts(words0, {...flags, rules: OFF});
    assert.equal(lives.heal.lives, "{n} lives in the Ark");
    assert.equal(lives.heal.note, "Each heart is one more life for your animal in the Ark.");
    assert.equal(lives.heal.title, "Lives in the Ark");
    assert.deepEqual(companionWordsForHearts(words0, flags), lives, "no rule read: as today");
    const final = companionWordsForHearts(words0, {...flags, rules: FINAL});
    assert.equal(final.heal.title, "Hearts in the Ark");
    assert.equal(final.heal.lives, "{n} hearts in the Ark");
    assert.equal(final.heal.life, "1 heart in the Ark");
    assert.equal(final.heal.full, "3 hearts in the Ark");
    assert.equal(final.debateWeb.outOfHearts, "No hearts left in the Ark");
    assert.match(final.heal.note, /Hearts can't hold back old age\.$/);
    assert.match(companionWordsForHearts(words0, {...flags, rules: RETURN}).heal.note, /young adult/);
    // Ark hearts off: nothing about the Ark whatever the rule says.
    assert.equal(companionWordsForHearts(words0, {heartsInDebates: false, arkHearts: false, rules: FINAL}).heal.title, "Hearts");
});

test("Life so far: a return reads 'Back after lying up' while a heart is a survived attack, 'another life' otherwise", () => {
    const moment = {id: "x", kind: "revived" as const, at: Date.parse(at), arkDay: 1, island: null, area: null};
    assert.equal(arkMomentText(moment), "Came back for another life");
    assert.equal(arkMomentText(moment, {escape: false}), "Came back for another life");
    assert.equal(arkMomentText(moment, {escape: true}), "Back after lying up");
});

test("every Ark language has the hearts-escape words, with the same placeholders", () => {
    const dir = path.join(locales, "ark");
    const all = [path.join(locales, "en.json"), path.join(locales, "id.json"), ...readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f))];
    assert.equal(all.length, 45);
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const survival = ["introEscape", "placesDescriptionEscape", "recoverNoteEscape", "recoverNoteEscapeOld"];
    const spec: Array<[string, string[], Record<string, string>]> = [
        ["live", ["escapedWounded", "rescued", "lostHome"], ARK_LIVE_ENGLISH as unknown as Record<string, string>],
        ["release", ["escapeHearts", "escapeHeartsOld", "escapeLastOfKind"], ARK_RELEASE_ENGLISH as unknown as Record<string, string>],
        ["hearts", ["escapeLivesOne", "escapeLivesOther", "escapeLivesNone", "escapeNote", "escapeNoteOld", "recoveringWounded", "recoveringCare", "recoveringHome"], ARK_HEARTS_ENGLISH as unknown as Record<string, string>]
    ];
    for (const file of all) {
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        for (const [group, keys, base] of spec) {
            for (const key of keys) {
                assert.equal(typeof ark[group]?.[key], "string", `${file} ark.${group}.${key}`);
                assert.ok(ark[group][key].trim().length > 3, `${file} ark.${group}.${key} is not empty`);
                assert.equal(holes(ark[group][key]), holes(base[key]), `${file} ark.${group}.${key} placeholders`);
            }
        }
        for (const key of survival) {
            assert.equal(typeof ark.rankings.survival[key], "string", `${file} survival.${key}`);
            assert.equal(holes(ark.rankings.survival[key]), holes(english.ark.rankings.survival[key]), `${file} survival.${key} placeholders`);
        }
        // The chip keeps its "· returns {when}" slot, the wounded line its hearts-left tail's room (no full stop at its end).
        for (const key of ["recoveringWounded", "recoveringCare", "recoveringHome"]) assert.ok(ark.hearts[key].includes("{when}"), `${file} ${key} has {when}`);
        assert.equal(/[.。]$/.test(ark.live.escapedWounded.trim()) || /[.。]$/.test(ark.live.rescued.trim()) || /[.。]$/.test(ark.live.lostHome.trim()), false, `${file}: the log lines end with no full stop`);
    }
    // English is the code's English (a test holds en.json to it); the site's pages carry the how-it-works hearts text in en and id.
    for (const lang of ["en", "id"]) {
        const file = JSON.parse(readFileSync(path.join(locales, `${lang}.json`), "utf8"));
        for (const key of ["title", "p1", "p2", "p2Old"]) assert.ok(file.pages.howItWorks.hearts[key].length > 20, `${lang} howItWorks.hearts.${key}`);
        for (const key of ["arkTitleEscape", "arkLifeEscape", "arkLivesEscape", "arkNoneEscape", "arkNoteEscape", "arkNoteEscapeOld"]) assert.equal(typeof file.companions.heal[key], "string", `${lang} companions.heal.${key}`);
    }
});

// AGE-RISK (docs/ark/age-risk.md): what the public read sends for a clock death the Ark cannot call old age, and a survived close call.
const unknownDeath = row(21, "death_old", {animal: vole(21, {status: "died_old"}), unknown: true});
const unknownDeath2 = row(22, "death_old", {animal: vole(22, {status: "died_old"}), unknown: true});
const oldAgeDeath = row(23, "death_old", {animal: vole(23, {status: "died_old"})});
const closeCall = row(24, "death_old", {animal: vole(24), unknown: true, closeCall: true, lives: {heartsLeft: 2, returnsDay: 600}});
const closeCallLast = row(25, "death_old", {animal: vole(25), unknown: true, closeCall: true, lives: {heartsLeft: 0, returnsDay: 600}});

test("age risk: a death whose cause is not known is said so, never as old age, and never folded with the deaths of old age", () => {
    const events = decodeArkEvents({events: [unknownDeath, oldAgeDeath, closeCall]}, null);
    const byId = new Map(events.map((e) => [e.id, e]));
    assert.equal(byId.get("21")?.unknown, true);
    assert.equal(byId.get("21")?.closeCall, undefined);
    assert.equal(byId.get("23")?.unknown, undefined);
    assert.equal(byId.get("24")?.closeCall, true);
    assert.equal(byId.get("24")?.unknown, true, "a close call is one whose cause is not known");
    const items = arkLiveServerItems(events);
    const unknown = items.find((i) => i.id === "21")!;
    const old = items.find((i) => i.id === "23")!;
    assert.equal(unknown.unknown, true);
    assert.notEqual(unknown.key, old.key);
    assert.equal(arkLiveLineText(unknown, words, "en"), "The Field Vole died. The cause is not known");
    assert.equal(arkLiveLineText({...unknown, count: 3}, words, "en"), "3 Field Voles died, cause not known");
    assert.equal(arkLiveLineText(old, words, "en"), "The Field Vole died of old age", "a death of old age is as it was");
    assert.equal(/old age/.test(arkLiveLineText({...unknown, count: 2}, words, "en") + arkLiveLineText(unknown, words, "en")), false);
    // The same row with a heart (old age that still returns): its tail as a death's has it.
    const withHeart = arkLiveServerItems(decodeArkEvents({events: [row(26, "death_old", {animal: vole(26), unknown: true, lives: {heartsLeft: 1, returnsDay: 600}})]}, null))[0];
    assert.equal(arkLiveLineText(withHeart, words, "en"), "The Field Vole died. The cause is not known · 1 ♥ left");
});

test("age risk: a survived close call is its own line, alive, with its hearts, and no death", () => {
    const events = decodeArkEvents({events: [closeCall, closeCallLast]}, null);
    const items = arkLiveServerItems(events);
    assert.deepEqual(items.map((i) => [i.say, i.kind, i.hearts]), [["closeCall", "revived", 2], ["closeCall", "revived", 0]]);
    assert.equal(closeCallText(items[0], words, "en"), "A Field Vole came close to dying. The cause is not known. It pulled through · 2 ♥ left");
    assert.equal(closeCallText(items[1], words, "en"), "A Field Vole came close to dying. The cause is not known. It pulled through · no ♥ left");
    assert.equal(closeCallText({animal: "Field Vole", say: "closeCall"}, words, "en"), "A Field Vole came close to dying. The cause is not known. It pulled through");
    assert.equal(closeCallText({animal: "Field Vole", say: "rescued"}, words, "en"), null);
    assert.equal(closeCallRow(closeCall), true);
    assert.equal(closeCallRow(unknownDeath), false);
    assert.equal(closeCallRow(row(30, "escaped", {closeCall: true})), false);
    assert.equal(closeCallRow({kind: "death_old", payload: {closeCall: true}}), true);
    // Its own log line (the animal's card, "Its day").
    assert.deepEqual(heartsNotes({events: [closeCall, unknownDeath]}, words, "en").map((n) => [n.animalId, n.text]), [[id(24), "A Field Vole came close to dying. The cause is not known. It pulled through · 2 ♥ left"]]);
});

test("age risk: the replay counts a death of unknown cause apart, a close call not at all, and says each", () => {
    const events = decodeArkEvents({events: [unknownDeath, unknownDeath2, oldAgeDeath, closeCall]}, null);
    const plan = planArkReplay(events);
    assert.equal(plan.summary.deaths, 1);
    assert.equal(plan.summary.unknownDeaths, 2);
    const deaths = plan.acts.filter((a) => a.kind === "death");
    assert.equal(deaths.length, 3, "a close call is no death act");
    assert.deepEqual(deaths.map((a) => (a as {unknown?: boolean}).unknown === true), [true, true, false]);
    const snapshot: ArkSnapshot = {voyage: {slug: "first", name: "Ark", started_at: null}, counts: {animals: 0, species: 0, founders: 0}, zones: [], animals: [], as_of: at, ark_day: 472};
    const log = {events: [unknownDeath, oldAgeDeath, closeCall]};
    const now = Date.parse(at) + 600_000;
    const unknown = planArkEventReplay("21", log, snapshot, {now});
    assert.equal(unknown.unknownCause, true);
    assert.equal(arkReplayText(unknown, null, "en").headline, "The Field Vole died. The cause is not known");
    const old = planArkEventReplay("23", log, snapshot, {now});
    assert.equal(old.unknownCause, undefined);
    assert.equal(arkReplayText(old, null, "en").headline, "The Field Vole died of old age");
    assert.throws(() => planArkEventReplay("24", log, snapshot, {now}), /close call/);
    // A close call is no cast either: nothing died, nobody is brought in for a dying act.
    assert.equal(arkSeenGroup("24", log, snapshot, now), null);
});

test("the log's flows count a wounded escape and a rescue as leaving, so their return is not an extra animal", () => {
    const flows = (rows: unknown[]) => arkReadEvents({events: rows}).flows.map((f) => f.delta);
    assert.deepEqual(flows([wounded, plain, rescue, feed, back]), [-1, -1, 1], "a plain miss and an ordinary feed are not flows; the return is +1");
    assert.deepEqual(arkReadEvents({events: [wounded, rescue]}).falls, [], "and neither is a death");
    assert.deepEqual(flows([plain, feed]), []);
});

test("Life so far: a survived close call and a death of unknown cause are said as they are", () => {
    const base = {id: "x", at: Date.parse(at), arkDay: 1, island: null, area: null};
    assert.equal(arkMomentText({...base, kind: "close_call"}), "Came close to dying, and pulled through");
    assert.equal(arkMomentText({...base, kind: "died", way: "unknown"}), "Died, cause not known");
    assert.equal(arkMomentText({...base, kind: "died", way: "death_old"}), "Died of old age");
});

test("every Ark language has the age-risk words, with the same placeholders", () => {
    const dir = path.join(locales, "ark");
    const all = [path.join(locales, "en.json"), path.join(locales, "id.json"), ...readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f))];
    assert.equal(all.length, 45);
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const spec: Array<[string, string[]]> = [["live", ["deathUnknownOther", "closeCall"]], ["replay", ["deathUnknown", "deathsUnknownOne", "deathsUnknownOther"]]];
    for (const file of all) {
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        for (const [group, keys] of spec) for (const key of keys) {
            assert.equal(typeof ark[group]?.[key], "string", `${file} ark.${group}.${key}`);
            assert.equal(holes(ark[group][key]), holes(english.ark[group][key]), `${file} ark.${group}.${key} placeholders`);
        }
        assert.equal(/[.。]$/.test(ark.live.closeCall.trim()), false, `${file}: the close call line ends with no full stop (a hearts tail may follow)`);
    }
    assert.equal(ARK_LIVE_ENGLISH.deathUnknownOther, english.ark.live.deathUnknownOther);
    assert.equal(ARK_LIVE_ENGLISH.closeCall, english.ark.live.closeCall);
});

test("the population history counts an animal lying up as leaving, so its return is not an extra animal", () => {
    const H = 3_600_000;
    const T0 = Date.parse("2026-11-16T00:00:00Z");
    const iso = (ms: number) => new Date(ms).toISOString();
    // The server's shape (migration 20270104120000): a 12th number on a step with an animal lying up (a wounded escape, a rescue).
    const answer = {
        available: true, bucket: "hour", bucket_seconds: 3600, t0: iso(T0), since: iso(T0), as_of: iso(T0 + 5.5 * H), first_at: iso(T0 - 48 * H), started_at: iso(T0 - 48 * H),
        base: [["vole", 0, 3]],
        steps: [
            ["vole", 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1], // one wounded, lying up
            ["vole", 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1], // one rescued, lying up
            ["vole", 0, 3, 0, 0, 1, 0, 0], // one back
            ["vole", 0, 4, 0, 0, 1, 0, 0] // the other back
        ],
        gone: {}
    };
    const history = decodeArkHistory(arkCompactHistory(answer))!;
    const series = arkKindSeries(history, "vole", "both");
    assert.deepEqual(series.counts, [3, 3, 2, 1, 2, 3, 3], "3 aboard, 2 lie up, both return: 3 again, never 5");
    assert.deepEqual(series.revived, [0, 0, 0, 0, 1, 1, 0]);
    // A step without the 12th number, as the server sends it today: as before.
    const old = decodeArkHistory(arkCompactHistory({...answer, steps: [["vole", 0, 3, 0, 0, 1, 0, 0]]}))!;
    assert.deepEqual(arkKindSeries(old, "vole", "both").counts, [3, 3, 3, 3, 4, 4, 4], "(an old answer with a return and no departure: as it always counted)");
    // Local days keep the departures.
    const days = arkRebucketDays(history, "UTC");
    assert.equal(arkKindSeries(days, "vole", "both").counts.at(-1), 3);
});

test("age risk on the rule read: ageRisk is read, absent means off", () => {
    assert.equal(arkAgeRisk(decodeArkHeartsRules({hearts: true, escape: false, oldAge: "return", ageRisk: true})), true);
    assert.equal(arkAgeRisk(decodeArkHeartsRules({hearts: true, escape: false, oldAge: "return"})), false);
    assert.equal(arkAgeRisk(decodeArkHeartsRules({hearts: false, escape: false, oldAge: "final", ageRisk: true})), true, "it does not need hearts");
    assert.equal(arkAgeRisk(null), false);
    assert.deepEqual(decodeArkHeartsRules({hearts: true, escape: true, oldAge: "final", ageRisk: "yes"}), FINAL, "only a real true");
});

test("age risk: the survival record keeps a death of unknown cause apart, and a close call is no death", () => {
    const read = arkReadEvents({events: [unknownDeath, oldAgeDeath, closeCall, row(40, "eaten", {animal: vole(40), other: fox(9)})]});
    assert.deepEqual(read.falls.map((f) => f.cause), ["unknown", "old", "eaten"], "the close call is in no cause");
    assert.deepEqual(read.flows.map((f) => f.delta), [-1, -1, -1, -1], "but it is a -1 for the population record, as its return is a +1");
    const falls = {old: 1, starved: 0, eaten: 1, unknown: 1};
    const survival = {causes: {falls, lostForGood: {old: 1, starved: 0, eaten: 1, unknown: 1}}} as never;
    const bars = arkCauseBars(survival, english.ark.rankings as never, "en");
    assert.deepEqual(bars.map((b) => [b.cause, b.name, b.falls]), [["old", "Old age", 1], ["starved", "Starved", 0], ["eaten", "Eaten", 1], ["unknown", "Cause not known", 1]]);
    // Until the record holds one, the bars are as they were.
    const none = arkCauseBars({causes: {falls: {...falls, unknown: 0}, lostForGood: {old: 1, starved: 0, eaten: 1, unknown: 0}}} as never, english.ark.rankings as never, "en");
    assert.deepEqual(none.map((b) => b.cause), ["old", "starved", "eaten"]);
});

test("age risk: a species' trend counts a death of unknown cause apart", () => {
    const trends = arkSpeciesTrends({events: [unknownDeath, unknownDeath2, oldAgeDeath, closeCall]}, () => "k");
    const trend = trends.get("k")!;
    assert.deepEqual([trend.diedOld, trend.diedUnknown, trend.net], [1, 2, -3]);
    const words = {line: "In the 7 days to {date}: {changes}.", none: "n", arrived: "{count} came aboard", born: "{count} born", eaten: "{count} eaten", diedOld: "{count} died of old age", diedUnknown: "{count} died, cause not known", starved: "{count} starved", separator: ", "};
    assert.equal(arkSpeciesTrendLine(trend, words, "Nov 27", "en"), "In the 7 days to Nov 27: 1 died of old age, 2 died, cause not known.");
});

test("age risk: Lost from the Ark says the last one died, cause not known, and the card's ended row can", () => {
    const base = {species_profile_id: "11111111-1111-4111-8111-111111111111", name: "Wood Mouse", at, ark_day: 100, aboard: 0};
    const list = decodeArkExtinctions([{...base, cause: null, cause_unknown: true}, {...base, species_profile_id: "22222222-2222-4222-8222-222222222222", cause: "died_old"}, {...base, species_profile_id: "33333333-3333-4333-8333-333333333333", cause: null}])!;
    const how = list.map((one) => arkExtinctHow(ARK_LOST_WORDS_EN, one));
    assert.deepEqual(how.sort(), [null, "Last one died of old age", "Last one died, cause not known"].sort());
    const life = (died: unknown) => decodeArkLife({id: "a", origin: {kind: "arrived"}, died})!;
    assert.equal(life({at, kind: "died_old", unknown: true}).died?.unknown, true);
    assert.equal(life({at, kind: "died_old"}).died?.unknown, undefined);
    assert.equal(life({at, kind: "eaten", unknown: true}).died?.unknown, undefined, "only an old-age end can be unknown");
});

test("every Ark language has the age-risk follow-up words, with the same placeholders", () => {
    const dir = path.join(locales, "ark");
    const all = [path.join(locales, "en.json"), path.join(locales, "id.json"), ...readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f))];
    assert.equal(all.length, 45);
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const spec: Array<[string[], string]> = [[["life"], "endedUnknown"], [["lost"], "diedUnknown"], [["rankings", "survival"], "causeUnknown"], [["rankings", "survival"], "faqA2Unknown"], [["lifeHelp"], "endRisk"]];
    for (const file of all) {
        const ark = JSON.parse(readFileSync(file, "utf8")).ark;
        const at = (o: Record<string, unknown>, keys: string[]) => keys.reduce((x, k) => x?.[k] as Record<string, unknown>, o as Record<string, unknown>) as Record<string, string>;
        for (const [group, key] of spec) {
            assert.equal(typeof at(ark, group)?.[key], "string", `${file} ark.${group.join(".")}.${key}`);
            assert.equal(holes(at(ark, group)[key]), holes(at(english.ark, group)[key]), `${file} ark.${group.join(".")}.${key} placeholders`);
        }
    }
    for (const lang of ["en", "id"]) {
        const file = JSON.parse(readFileSync(path.join(locales, `${lang}.json`), "utf8"));
        assert.ok(file.species.inTheArk.trendDiedUnknown.includes("{count}"), `${lang} trendDiedUnknown`);
        assert.ok(file.pages.howItWorks.seasons.p3Risk.length > 60, `${lang} seasons.p3Risk`);
    }
});
