import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ArkLiveLog, ArkSeenMemory, arkLiveArrivalsFromSnapshot, arkLiveLineText, arkLiveServerItems, arkSeenItems, arkSeenKind, ARK_LIVE_LOG_DEFAULTS, type ArkLiveItem, type ArkLiveText} from "./ark-live-log";
import {ArkLiveFixtureFeed} from "./ark-live-fixture";
import {ARK_LIVE_ENGLISH} from "./ark-live-words";
import {decodeArkEvents} from "./ark-life";
import {arkPopulation} from "./ark-population";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import fixtureEvents from "@/ark-scene/fixtures/events.json";

const english = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "en.json"), "utf8")).ark as ArkLiveText;
const snapshot = decodeArkSnapshot(fixtureV2)!;

function item(partial: Partial<ArkLiveItem> & Pick<ArkLiveItem, "id" | "key">): ArkLiveItem {
    return {kind: "arrival", source: "server", animal: "House Sparrow", other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: null, zone: null}, ...partial};
}

test("English: the live words in en.json are the ones the embed falls back to", () => {
    assert.deepEqual(english.live, ARK_LIVE_ENGLISH);
});

test("the Ark's record: a meal names the predator and is one line with its eaten row; a litter is one line", () => {
    const events = decodeArkEvents(fixtureEvents, snapshot);
    const items = arkLiveServerItems(events);
    const meals = events.filter((e) => e.kind === "meal").length;
    assert.equal(items.filter((i) => i.kind === "meal").length, meals, "one line per meal, its `eaten` half not said again");
    const meal = items.find((i) => i.kind === "meal")!;
    assert.equal(meal.animal, "African Lion");
    assert.equal(meal.other, "Plains Zebra");
    assert.equal(arkLiveLineText(meal, english, "en"), "The African Lion ate a Plains Zebra");
    assert.ok(items.every((i) => i.source === "server"));
    assert.ok(!items.some((i) => ["milestone", "hungry", "fed", "eaten", "revised"].includes(i.kind)));
    // A litter of two born at once: one item counting both.
    const litter = arkLiveServerItems(decodeArkEvents([
        {id: 1, kind: "birth", at: "2026-11-11T10:00:00Z", animal: {id: "y1", species_profile_id: "z", name: "Plains Zebra", model_slug: "plains-zebra", zone: "grassland"}, parents: ["p1", "p2"]},
        {id: 2, kind: "birth", at: "2026-11-11T10:00:00Z", animal: {id: "y2", species_profile_id: "z", name: "Plains Zebra", model_slug: "plains-zebra", zone: "grassland"}, parents: ["p2", "p1"]}
    ], null));
    assert.equal(litter.length, 1);
    assert.equal(litter[0].count, 2);
    assert.equal(arkLiveLineText(litter[0], english, "en"), "2 Plains Zebra young were born");
});

test("privacy: no line carries a bringer, a person or a place", () => {
    const events = decodeArkEvents(fixtureEvents, snapshot);
    const labels = new Set(snapshot.animals.flatMap((a) => [a.brought_by.label, ...(a.bringers ?? []).map((b) => b.label)]).filter(Boolean));
    for (const line of arkLiveServerItems(events)) {
        const text = arkLiveLineText(line, english, "en");
        for (const label of Array.from(labels)) assert.ok(!text.includes(label), `"${text}" names ${label}`);
        assert.ok(!/Voyager|@/.test(text), text);
    }
});

test("words: English plurals for a group, the replay's articles, eggs, a kind gone", () => {
    assert.equal(arkLiveLineText(item({id: "a", key: "k", count: 3}), english, "en"), "3 House Sparrows came aboard");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", animal: "Arctic Fox"}), english, "en"), "An Arctic Fox came aboard");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", kind: "hatched", animal: "Mallard"}), english, "en"), "A Mallard hatched");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", kind: "laid", animal: "Mallard", eggs: 4}), english, "en"), "A Mallard laid 4 eggs");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", kind: "death", animal: "Roe Deer", count: 2}), english, "en"), "2 Roe Deer died of old age");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", kind: "starved", animal: "Jaguar"}), english, "en"), "The Jaguar starved");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", kind: "contest", source: "seen", animal: "Red Deer"}), english, "en"), "Red Deer rivals are clashing");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", kind: "fishing", source: "seen", animal: "Grey Heron", count: 2}), english, "en"), "A Grey Heron caught a fish ×2");
    assert.equal(arkLiveLineText(item({id: "a", key: "k", kind: "more", count: 12}), english, "en"), "+12 more");
    // Another language: the name as it is, the language's own words.
    const german = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "ark", "de.json"), "utf8")).ark as ArkLiveText;
    assert.equal(arkLiveLineText(item({id: "a", key: "k", count: 3, animal: "Haussperling"}), german, "de"), "Haussperling: 3 sind an Bord gekommen");
});

test("seen: an episode is said once, only at its characteristic part; fishing only with its fish; alarms once", () => {
    assert.equal(arkSeenKind("antler_clash"), "contest");
    assert.equal(arkSeenKind("court_dance"), "courting");
    assert.equal(arkSeenKind("graze"), null);
    const memory = new ArkSeenMemory();
    const act = {id: "d1", name: "Red Deer", speciesId: "deer", zone: "woodland" as const, recipe: "antler_clash", episode: "pair#1", block: "walk", fish: false};
    assert.equal(arkSeenItems({acts: [act], alarms: []}, memory).length, 0, "walking to meet is not the clash");
    const clash = arkSeenItems({acts: [{...act, block: "fight"}, {...act, id: "d2", block: "fight"}], alarms: []}, memory);
    assert.equal(clash.length, 1, "two rivals in one episode: one line");
    assert.equal(clash[0].source, "seen");
    assert.equal(arkSeenItems({acts: [{...act, block: "fight"}], alarms: []}, memory).length, 0, "said once");
    const heron = {id: "h1", name: "Grey Heron", speciesId: "heron", zone: "wetland" as const, recipe: "wade_spear", episode: "h#1", block: "strike", fish: false};
    assert.equal(arkSeenItems({acts: [heron], alarms: []}, memory).length, 0, "a strike that missed is not a catch");
    assert.equal(arkSeenItems({acts: [{...heron, fish: true}], alarms: []}, memory)[0].kind, "fishing");
    const alarm = {id: "m1", name: "Meerkat", speciesId: "meerkat", zone: "desert" as const, at: 12.34, threat: "lion"};
    assert.equal(arkSeenItems({acts: [], alarms: [alarm, alarm]}, memory).length, 1);
    assert.equal(arkSeenItems({acts: [], alarms: [{...alarm, at: 30}]}, memory).length, 0, "the same caller at the same threat within the minute: not again");
    assert.equal(arkSeenItems({acts: [], alarms: [{...alarm, at: 75}]}, memory).length, 1, "a call a minute later is a new line");
});

test("the log: repeats fold into one line, bursts end in +N more, seen lines wait their turn and go stale", () => {
    const log = new ArkLiveLog();
    let now = 0;
    log.push([item({id: "1", key: "arrival:sparrow"}), item({id: "2", key: "arrival:sparrow"}), item({id: "3", key: "arrival:sparrow"})], now);
    log.step(now);
    assert.equal(log.lines.length, 1);
    assert.equal(log.lines[0].count, 3, "three arrivals of one kind waiting: one line of three");
    now += 2000;
    log.push([item({id: "4", key: "arrival:sparrow"})], now);
    assert.equal(log.lines[0].count, 4, "another soon after folds into the line on screen");
    // A burst bigger than the log.
    const burst = Array.from({length: 12}, (_, i) => item({id: `b${i}`, key: `birth:k${i}`, kind: "birth"}));
    burst.push(item({id: "meal", key: "meal:lion:zebra", kind: "meal", animal: "African Lion", other: "Plains Zebra"}));
    log.push(burst, now);
    assert.ok(log.waiting <= ARK_LIVE_LOG_DEFAULTS.maxQueue + 1, `${log.waiting} waiting`);
    const shown = new Set<string>();
    for (let i = 0; i < 20; i++) {
        now += ARK_LIVE_LOG_DEFAULTS.gap;
        log.step(now);
        for (const line of log.lines) shown.add(line.kind);
    }
    assert.ok(shown.has("meal"), "the rare kind stays");
    assert.ok(shown.has("more"), "the rest fold into +N more");
    assert.ok(log.lines.length <= ARK_LIVE_LOG_DEFAULTS.maxLines);
    // Lines go when their time is up.
    now += ARK_LIVE_LOG_DEFAULTS.serverLife + 1;
    log.step(now);
    assert.equal(log.lines.length, 0);
    // Seen: one at a time, a gap between them, stale ones dropped.
    log.push([item({id: "s1", key: "courting:crane", kind: "courting", source: "seen"}), item({id: "s2", key: "nest:sparrow", kind: "nest", source: "seen"}), item({id: "s3", key: "alarm:meerkat", kind: "alarm", source: "seen"})], now);
    log.step(now);
    assert.equal(log.lines.length, 1);
    now += ARK_LIVE_LOG_DEFAULTS.seenGap - 1;
    log.step(now);
    assert.equal(log.lines.length, 1, "seen lines keep their gap");
    now += 1;
    log.step(now);
    assert.equal(log.lines.length, 2, "the next seen line after the gap");
    now += ARK_LIVE_LOG_DEFAULTS.seenStale;
    log.step(now);
    assert.equal(log.waiting, 0, "the third waited past its moment and is dropped");
    // Alarms: one line, then none for a while however many call.
    const alarms = new ArkLiveLog();
    alarms.push([item({id: "a1", key: "alarm:horse", kind: "alarm", source: "seen"})], 0);
    alarms.step(0);
    alarms.push([item({id: "a2", key: "alarm:goose", kind: "alarm", source: "seen"})], ARK_LIVE_LOG_DEFAULTS.seenGap);
    alarms.step(ARK_LIVE_LOG_DEFAULTS.seenGap);
    assert.equal(alarms.lines.length, 1, "a second alarm so soon waits, and goes stale");
});

test("newcomers stand in for the event log: arrivals and births, from the snapshot", () => {
    const items = arkLiveArrivalsFromSnapshot([{...snapshot.animals[0], origin: "born"}, snapshot.animals[1]]);
    assert.deepEqual(items.map((i) => i.kind), ["birth", "arrival"]);
    assert.ok(items.every((i) => i.focus.animalId));
});

test("the fixture feed: every kind the owner asked about within a cycle, in the server's shapes, the counts kept", () => {
    const feed = new ArkLiveFixtureFeed(snapshot);
    const kinds = new Set<string>();
    let current = snapshot;
    let at = Date.parse("2026-11-11T09:00:00Z");
    for (let i = 0; i < 24; i++) {
        at += 8000;
        const step = feed.next(new Date(at), current);
        if (!step) continue;
        const decoded = decodeArkEvents(step.events, step.snapshot);
        assert.equal(decoded.length, (step.events as unknown[]).length, `${step.beat}: every row decodes`);
        for (const event of decoded) kinds.add(event.from_egg ? "hatch" : event.kind);
        current = step.snapshot;
        assert.equal(current.counts.animals, current.animals.length);
        assert.equal(new Set(current.animals.map((a) => a.id)).size, current.animals.length, "no animal twice");
    }
    for (const kind of ["arrival", "birth", "laid", "hatch", "meal", "eaten", "death_old", "starved"]) assert.ok(kinds.has(kind), `the feed makes ${kind}`);
    // No kind ended by the feed.
    const before = new Set(arkPopulation(snapshot).regions.flatMap((r) => r.species.map((s) => s.key)));
    const after = new Set(arkPopulation(current).regions.flatMap((r) => r.species.map((s) => s.key)));
    for (const key of Array.from(before)) assert.ok(after.has(key), `${key} is still aboard`);
    // Deterministic.
    const again = new ArkLiveFixtureFeed(snapshot);
    const first = again.next(new Date("2026-11-11T09:00:08Z"), snapshot)!;
    const other = new ArkLiveFixtureFeed(snapshot).next(new Date("2026-11-11T09:00:08Z"), snapshot)!;
    assert.deepEqual(first.events, other.events);
});

test("the fixture feed with a pool (?fixture=grow): arrivals come from the pool first", () => {
    const start = {...snapshot, animals: snapshot.animals.slice(0, 6)};
    const feed = new ArkLiveFixtureFeed(start, {pool: snapshot.animals});
    const step = feed.next(new Date("2026-11-11T09:00:08Z"), start)!;
    assert.equal(step.beat, "pair");
    assert.ok(step.snapshot.animals.slice(6).every((a) => snapshot.animals.some((b) => b.id === a.id)), "the newcomers are the fixture's next animals");
});
