import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ArkLiveLog, arkLiveLineText, arkLiveServerItems, ARK_LIVE_LOG_DEFAULTS, type ArkLiveItem, type ArkLiveText} from "./ark-live-log";
import {crisisItems, crisisText, recordItems} from "@/ark-scene/live/crisis-lines";
import {ARK_LIVE_ENGLISH} from "./ark-live-words";
import {ArkLiveFixtureFeed} from "./ark-live-fixture";
import {ARK_EVENT_KINDS, decodeArkEvents, isQuietArkReplay, planArkReplay} from "./ark-life";
import {arkLiteFeedFromEvents, arkLiteFeedLines, arkLiteFeedMerge} from "./ark-lite-feed";
import {arkEventsNet, arkPopulationThen} from "./ark-population-change";
import {arkHappeningsSince, arkPopulationSeries} from "./ark-population-series";
import {arkSpeciesTrends} from "./ark-species-trend";
import {ArkReplayUnavailable, planArkEventReplay} from "@/ark-scene/replay/event-replay";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import fixtureEvents from "@/ark-scene/fixtures/events.json";
import crisisFixture from "@/ark-scene/fixtures/events-crises.json";

/**
 * AnimalDex E4 (docs/ark/crises-e4.md) adds four public event kinds behind `voyage_config.crises`: `crisis`, `saved`,
 * `extinct_wild`, `returned_to_care`. Before the owner switches it on, every reader must say them calmly and correctly:
 * by species only, never gendered, never with an internal kind name, and never losing a line of the log.
 */

const NEW_KINDS = ["crisis", "saved", "extinct_wild", "returned_to_care"] as const;
const localesDir = path.join(__dirname, "..", "data", "locales");
const readLocale = (file: string) => JSON.parse(readFileSync(path.join(localesDir, file), "utf8")) as {ark: {live: Record<string, string>}};
const english = readLocale("en.json").ark as unknown as ArkLiveText;
const snapshot = decodeArkSnapshot(fixtureV2)!;
const rows = (crisisFixture as {events: Array<Record<string, unknown>>}).events;
const events = decodeArkEvents(crisisFixture, snapshot);
/** A line as the log and Ark Lite say it: the crisis layer's words first, the rest by `arkLiveLineText`. */
const say = (item: ArkLiveItem, words: ArkLiveText = english, locale = "en") => crisisText(item, words) ?? arkLiveLineText(item, words, locale);
/** What no line may say: an internal kind name, a pronoun for an animal, a number, a person. */
const FORBIDDEN = /extinct_wild|returned_to_care|wildGone|toCare|\b(he|she|his|her|hers|him|himself|herself|male|female|mother|father)\b|@|Voyager|\d/i;

test("decode: the four kinds read from the public read's shape; an unknown kind is still dropped and never takes the rest", () => {
    for (const kind of NEW_KINDS) assert.ok((ARK_EVENT_KINDS as readonly string[]).includes(kind), kind);
    assert.deepEqual(events.map((event) => event.kind), ["crisis", "crisis", "saved", "extinct_wild", "returned_to_care"]);
    const rabbit = events[0];
    assert.equal(rabbit.species?.name, "European Rabbit");
    assert.equal(rabbit.animal?.name, "European Rabbit");
    assert.equal(rabbit.id, "9001");
    // A kind this page has never heard of (a later layer) is dropped; the rows around it are kept, a malformed one too.
    const mixed = decodeArkEvents([rows[0], {id: 1, kind: "future_kind", at: "2026-11-18T10:00:00Z", species: "Mallard"}, null, "x", {id: 2, kind: "crisis"}, rows[2]], snapshot);
    assert.deepEqual(mixed.map((event) => event.kind), ["crisis", "saved"]);
});

test("the log: each kind is one calm line, by species, with its own words (English)", () => {
    const items = recordItems(events);
    assert.deepEqual(items.map((item) => item.kind), ["crisis", "crisis", "saved", "wildGone", "toCare"]);
    assert.deepEqual(arkLiveServerItems(events), [], "the static module says none of them: they come with the scene");
    assert.deepEqual(crisisItems(events).map((item) => item.id), items.map((item) => item.id));
    assert.deepEqual(items.map((item) => say(item)), [
        "European Rabbit: only a few left in the wild",
        "Barn Owl: only a few left in the wild",
        "Barn Owl: out of danger in the wild",
        "Meerkat: none left in the wild",
        "Meerkat: now cared for in the zoo"
    ]);
    for (const item of items) {
        const text = say(item);
        assert.ok(!FORBIDDEN.test(text), text);
        assert.equal(item.source, "server");
        assert.equal(item.count, 1);
    }
    // A crisis and a recovery of one kind do not fold into each other; the same kind and species twice do.
    assert.notEqual(items[1].key, items[2].key);
    const again = {...items[0], id: "again", count: 2};
    assert.equal(say(again), say(items[0]), "a repeat adds nothing to the words (no ×2)");
    // Where a tap goes: a kind in trouble or out of it, one of its kind; none in the wild, only the region; a recovering animal, itself.
    assert.deepEqual([items[0].focus.animalId, items[0].focus.speciesId], [null, rows[0].species_profile_id]);
    assert.deepEqual(items[3].focus, {animalId: null, speciesId: null, zone: "desert"});
    assert.equal(items[4].focus.animalId, (rows[4].animal as {id: string}).id);
});

test("the log: a row that cannot be named says nothing, never an empty or an internal line", () => {
    const bare = (kind: string, extra: Record<string, unknown> = {}) => decodeArkEvents([{id: 50, kind, at: "2026-11-18T10:00:00Z", ...extra}], null);
    for (const kind of NEW_KINDS) assert.deepEqual(recordItems(bare(kind)), [], `${kind}: no species, no animal`);
    // A kind with a name but no animal is still said; a return to care is about an animal and needs it.
    assert.equal(say(recordItems(bare("crisis", {species: "Mallard", species_profile_id: "m"}))[0]), "Mallard: only a few left in the wild");
    assert.equal(say(recordItems(bare("extinct_wild", {species: "Mallard"}))[0]), "Mallard: none left in the wild");
    assert.deepEqual(recordItems(bare("returned_to_care", {species: "Mallard"})), []);
    // Never the bare internal name, whatever the line is.
    assert.equal(say({kind: "crisis", animal: "Mallard", other: null, count: 1, eggs: null} as ArkLiveItem, {live: {} as never, replay: english.replay}), "Mallard: only a few left in the wild");
});

test("words: a language that lacks the lines says them in English, key by key; the fallback is en.json's", () => {
    const missing = {live: {...ARK_LIVE_ENGLISH}, replay: english.replay} as ArkLiveText;
    for (const key of ["crisis", "saved", "wildGone", "toCare"] as const) delete (missing.live as Record<string, unknown>)[key];
    for (const item of recordItems(events)) assert.equal(say(item, missing, "de"), say(item));
    for (const key of ["crisis", "saved", "wildGone", "toCare"] as const) assert.equal(english.live[key], ARK_LIVE_ENGLISH[key]);
});

test("words: every locale has the four lines, one {animal} each, none left in English, none with an internal name", () => {
    const files = ["en.json", "id.json", ...readdirSync(path.join(localesDir, "ark")).filter((file) => file.endsWith(".json")).map((file) => path.join("ark", file))];
    assert.equal(files.length, 45);
    const en = english.live;
    for (const file of files) {
        const live = readLocale(file).ark.live;
        for (const key of ["crisis", "saved", "wildGone", "toCare"] as const) {
            const text = live[key];
            assert.equal(typeof text, "string", `${file}: ${key}`);
            assert.equal((text.match(/\{[A-Za-z]+\}/g) ?? []).join(","), "{animal}", `${file}: ${key} placeholders`);
            assert.ok(text.length <= 90 && text.startsWith("{animal}"), `${file}: ${key} short, the kind first`);
            assert.ok(!/extinct_wild|returned_to_care|wildGone|toCare/.test(text), `${file}: ${key} internal name`);
            if (file !== "en.json") assert.notEqual(text, en[key], `${file}: ${key} untranslated`);
        }
        // The four lines of one language are four different sentences.
        assert.equal(new Set(["crisis", "saved", "wildGone", "toCare"].map((key) => live[key])).size, 4, file);
    }
    for (const key of ["crisis", "saved", "wildGone", "toCare"] as const) assert.doesNotMatch(en[key], FORBIDDEN);
});

test("the log on screen: the four are shown in turn; a burst keeps them over arrivals and never hides the rest", () => {
    const items = recordItems(events);
    const log = new ArkLiveLog();
    log.push(items, 0);
    const shown: string[] = [];
    for (let at = 0; at < 6 * ARK_LIVE_LOG_DEFAULTS.gap; at += ARK_LIVE_LOG_DEFAULTS.gap) {
        log.step(at);
        for (const line of log.lines) if (!shown.includes(line.id)) shown.push(line.id);
    }
    assert.deepEqual(shown, items.map((item) => item.id), "all five, in the record's order");
    // A burst bigger than the queue: the rare ones stay, the many arrivals fold into "+N more".
    const arrivals = Array.from({length: 12}, (_, index): ArkLiveItem => ({id: `a${index}`, kind: "arrival", source: "server", key: `arrival:s${index}`, animal: `Species ${index}`, other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: null, zone: null}}));
    const burst = new ArkLiveLog({maxLines: 20});
    burst.push([...arrivals, ...items], 0);
    const ids: string[] = [];
    const kinds = new Set<string>();
    for (let at = 0; at < 12 * ARK_LIVE_LOG_DEFAULTS.gap; at += ARK_LIVE_LOG_DEFAULTS.gap) {
        burst.step(at);
        for (const line of burst.lines) {
            if (!ids.includes(line.id)) ids.push(line.id);
            kinds.add(line.kind);
        }
    }
    for (const kept of items) assert.ok(ids.includes(kept.id), `${kept.kind} survives the burst`);
    assert.ok(!kinds.has("arrival"), "the many arrivals gave way");
    assert.ok(kinds.has("more"), "and are said as +N more");
});

test("Ark Lite's Latest on the Ark: the four are lines of the feed, in time, each its own, never folded across kinds", () => {
    const entries = arkLiteFeedFromEvents(events);
    assert.equal(entries.length, 5);
    assert.deepEqual(entries.map((entry) => entry.slug), ["european-rabbit", "barn-owl", "barn-owl", "meerkat", "meerkat"]);
    const merged = arkLiteFeedMerge([], entries);
    assert.equal(merged.length, 5);
    assert.deepEqual(merged.map((entry) => entry.id), ["9005", "9004", "9003", "9002", "9001"], "newest first");
    // Within ten minutes a kind and species fold (a crisis that moved from two to one is one line); a different kind does not.
    const close = arkLiteFeedMerge([], arkLiteFeedFromEvents(decodeArkEvents([
        {...rows[0], id: 1, at: "2026-11-18T10:00:00.000000Z"},
        {...rows[0], id: 2, at: "2026-11-18T10:03:00.000000Z"},
        {...rows[2], id: 3, species_profile_id: rows[0].species_profile_id, species: "European Rabbit", at: "2026-11-18T10:05:00.000000Z"}
    ], snapshot)));
    const lines = arkLiteFeedLines(close);
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map((line) => say(line.item)), ["European Rabbit: out of danger in the wild", "European Rabbit: only a few left in the wild"]);
});

test("the replay: none is acted or counted; a log of only these is a quiet one; a single replay of one is refused calmly", () => {
    const plan = planArkReplay(events);
    assert.deepEqual(plan.acts, []);
    assert.equal(plan.total, 0);
    assert.ok(isQuietArkReplay(plan.summary));
    // Beside others: the others are as they were.
    const others = decodeArkEvents(fixtureEvents, snapshot);
    const mixed = planArkReplay([...others, ...events], 1000);
    const alone = planArkReplay(others, 1000);
    assert.deepEqual(mixed.summary, alone.summary);
    assert.deepEqual(mixed.acts, alone.acts);
    // (The recorder's single-event replay has no scene for them: a refusal with a code, never a crash.)
    assert.throws(() => planArkEventReplay("9001", crisisFixture, snapshot, {now: Date.parse("2026-11-19T00:00:00Z")}), (error) => error instanceof ArkReplayUnavailable && error.code === "not_replayable");
});

test("the counts: none of the four changes who is aboard, a population's change, a trend or a day's happenings", () => {
    const base = (fixtureEvents as {events: unknown[]}).events;
    const withThem = [...base, ...rows];
    assert.deepEqual(Array.from(arkEventsNet(withThem, snapshot).entries()), Array.from(arkEventsNet(base, snapshot).entries()));
    assert.deepEqual(arkPopulationThen(snapshot, withThem, 0, ""), arkPopulationThen(snapshot, base, 0, ""));
    assert.deepEqual(Array.from(arkSpeciesTrends(withThem, () => null).entries()), Array.from(arkSpeciesTrends(base, () => null).entries()));
    assert.deepEqual(arkHappeningsSince(withThem, 0), arkHappeningsSince(base, 0));
    const times = ["2026-10-30T00:00:00Z", "2026-11-18T00:00:00Z"];
    assert.deepEqual(arkPopulationSeries(snapshot, withThem, {times, top: 3}), arkPopulationSeries(snapshot, base, {times, top: 3}));
});

test("the development feed (?fixture=live) says the four early, in the server's shape, and changes no snapshot for them", () => {
    const feed = new ArkLiveFixtureFeed(snapshot);
    let current = snapshot;
    const seen: string[] = [];
    for (let step = 0; step < 8; step++) {
        const made = feed.next(new Date(Date.parse("2026-11-18T09:00:00Z") + step * 8000), current);
        if (!made) continue;
        const decoded = decodeArkEvents(made.events, made.snapshot);
        assert.equal(decoded.length, (made.events as unknown[]).length, `${made.beat}: every row decodes`);
        if (NEW_KINDS.some((kind) => decoded[0]?.kind === kind)) {
            assert.equal(made.snapshot.animals.length, current.animals.length, `${made.beat}: nobody comes or goes`);
            const line = recordItems(decoded).map((item) => say(item)).join("");
            assert.ok(line.includes(": ") && !FORBIDDEN.test(line), line);
        }
        for (const event of decoded) seen.push(event.kind);
        current = made.snapshot;
    }
    for (const kind of NEW_KINDS) assert.ok(seen.includes(kind), `the feed makes ${kind}`);
});
