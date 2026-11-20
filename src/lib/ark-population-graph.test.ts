import assert from "node:assert/strict";
import test from "node:test";
import React, {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import path from "node:path";
import {ArkGraphWordsContext} from "@/app/[locale]/(composited)/ark/ark-graph-context";
import {ArkGoneRow, ArkHudControls, ArkHudGraphPane, ArkHudNone, ArkPopulationGraph, ArkRowSpark, arkHudLines, arkPeriodLabel, type ArkHudWhere} from "@/app/[locale]/(composited)/ark/ark-population-graph";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkKindWhere} from "@/lib/ark-kind-where";
import type {ArkGraphWords} from "@/lib/ark-graph-words";
import {arkCompactHistory, arkRebucketDays, arkStatsChangeText, decodeArkHistory} from "@/lib/ark-population-history";

// A small record in the server's shape (test data only).
const H = 3_600_000;
const T0 = Date.parse("2026-11-16T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const history = decodeArkHistory(arkCompactHistory({
    available: true, bucket: "hour", bucket_seconds: 3600, t0: iso(T0), as_of: iso(T0 + 3 * H), first_at: iso(T0 - 48 * H), started_at: iso(T0 - 48 * H),
    base: [["zebra", 0, 4], ["lynx", 0, 1]],
    steps: [["zebra", 0, 1, 0, 2, 0, 0, 0], ["lynx", 0, 2, 0, 0, 0, 1, 0]],
    gone: {lynx: {name: "Eurasian Lynx", model_slug: "eurasian_lynx"}}
}))!;
const noop = () => undefined;
// The species icon is written for the automatic JSX runtime (Next); the test runner compiles JSX to React.createElement.
(globalThis as {React?: typeof React}).React = React;

test("the HUD's lines and orders for a period", () => {
    const {lines, ranked} = arkHudLines(history, "24h", ["zebra"], "both", "declining");
    assert.deepEqual(ranked, ["lynx"]);
    assert.deepEqual(lines.get("zebra")?.series.counts, [4, 4, 6, 6]);
    assert.equal(arkHudLines(history, "24h", ["zebra"], "both", "biggest").ranked, null);
});

test("the graph: an accessible picture, its numbers, and no fly-to for a kind that died out", () => {
    const {lines} = arkHudLines(history, "24h", ["zebra"], "both", "biggest");
    const zebra = lines.get("zebra")!;
    const html = renderToStaticMarkup(createElement(ArkPopulationGraph, {name: "Plains Zebra", icon: null, history, series: zebra.series, stats: zebra.stats, period: "24h", onPeriod: noop, onBack: noop, onFly: noop, locale: "en"}));
    assert.match(html, /role="img" aria-label="Plains Zebra population, 24 h: 4 to 6"/);
    assert.match(html, /\+2/);
    assert.match(html, /\+50%/);
    assert.match(html, /2 born/);
    assert.match(html, /Show in the Ark/);
    assert.match(html, /aria-pressed="true"[^>]*aria-label="24 h"/);
    const lynx = lines.get("lynx")!;
    const gone = renderToStaticMarkup(createElement(ArkPopulationGraph, {name: "Eurasian Lynx", icon: null, history, series: lynx.series, stats: lynx.stats, period: "24h", onPeriod: noop, onBack: noop, onFly: null, locale: "en"}));
    assert.match(gone, /None aboard now/);
    assert.match(gone, /1 died/);
    assert.doesNotMatch(gone, /Show in the Ark/);
});

test("rows: a sparkline button with its label, a gone row, the switches", () => {
    const {lines} = arkHudLines(history, "24h", ["zebra"], "both", "biggest");
    const spark = renderToStaticMarkup(createElement(ArkRowSpark, {name: "Plains Zebra", line: lines.get("zebra")!, onOpen: noop}));
    assert.match(spark, /aria-label="Plains Zebra: population graph"/);
    assert.match(spark, /<path d="M/);
    const gone = renderToStaticMarkup(createElement(ArkGoneRow, {name: "Eurasian Lynx", slug: "eurasian_lynx", line: lines.get("lynx")!, locale: "en", onOpen: noop, setsize: 1, posinset: 1}));
    assert.match(gone, /Eurasian Lynx: 0, None aboard now/);
    const controls = renderToStaticMarkup(createElement(ArkHudControls, {mode: "thriving", onMode: noop, period: "7d", onPeriod: noop}));
    assert.match(controls, /aria-pressed="true"[^>]*>.*Thriving/);
    assert.match(controls, /aria-label="Time period"/);
});

// MARK: Words and the viewer's days

const bundle = (language: string) => JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "ark", `${language}.json`), "utf8")).ark.graph as ArkGraphWords;
const inLanguage = (words: ArkGraphWords | undefined, child: React.ReactElement) => createElement(ArkGraphWordsContext.Provider, {value: words}, child);

test("the graph and its switches in another language: every word from the page's bundle, the numbers filled in", () => {
    const de = bundle("de");
    const {lines} = arkHudLines(history, "24h", ["zebra"], "both", "biggest");
    const zebra = lines.get("zebra")!;
    const html = renderToStaticMarkup(inLanguage(de, createElement(ArkPopulationGraph, {name: "Steppenzebra", icon: null, history, series: zebra.series, stats: zebra.stats, period: "24h", onPeriod: noop, onBack: noop, onFly: noop, locale: "de"})));
    assert.ok(html.includes(`aria-label="Bestand Steppenzebra, ${de.periods["24h"]}: 4 bis 6"`), "the graph's accessible name, filled in");
    assert.ok(html.includes("2 geboren"), "a count sits in its line");
    assert.ok(html.includes(de.flyTo) && html.includes(de.back) && html.includes(de.now) && html.includes(de.peak));
    assert.ok(!html.includes("Show in the Ark") && !html.includes("All species") && !html.includes("Peak"), "no English left");
    const controls = renderToStaticMarkup(inLanguage(de, createElement(ArkHudControls, {mode: "thriving", onMode: noop, period: "7d", onPeriod: noop})));
    for (const word of [de.sortLabel, de.periodLabel, de.biggest, de.thriving, de.declining, de.periods["7d"], de.periodsShort["30d"]]) assert.ok(controls.includes(word), word);
    assert.ok(!/Biggest|Thriving|Declining|Time period/.test(controls));
    const spark = renderToStaticMarkup(inLanguage(de, createElement(ArkRowSpark, {name: "Steppenzebra", line: zebra, onOpen: noop})));
    assert.ok(spark.includes(`aria-label="Steppenzebra: ${de.openGraph.split(": ")[1]}"`));
    const none = renderToStaticMarkup(inLanguage(de, createElement(ArkHudNone, {mode: "declining"})));
    assert.ok(none.includes(de.noneDeclining));
    const gone = renderToStaticMarkup(inLanguage(de, createElement(ArkGoneRow, {name: "Luchs", slug: "lynx", line: lines.get("lynx")!, locale: "de", onOpen: noop, setsize: 1, posinset: 1})));
    assert.ok(gone.includes(`Luchs: 0, ${de.goneNow}`));
    // Without a provider, or with a bundle from before these words: English.
    const plain = renderToStaticMarkup(inLanguage(undefined, createElement(ArkHudNone, {mode: "thriving"})));
    assert.match(plain, /No species grew in this period\./);
    assert.equal(arkPeriodLabel(zebra.stats, "7d", "de", de), `${arkStatsChangeText(zebra.stats, "de").percent}, ${de.periods["7d"]}`);
    assert.equal(arkPeriodLabel(zebra.stats, "7d", "en"), "+50%, 7 days");
});

test("the axis and the hover name the viewer's days: the same record, two time zones", () => {
    // Zebras arrive at 16:30Z and 17:10Z on the 10th; the record's first row is 03:00Z that day; read at 09:30Z on the 13th.
    const raw = arkCompactHistory({
        available: true, bucket: "hour", bucket_seconds: 3600, t0: iso(Date.parse("2026-11-10T00:00:00Z")), as_of: iso(Date.parse("2026-11-13T09:30:00Z")), first_at: iso(Date.parse("2026-11-10T03:00:00Z")), started_at: iso(Date.parse("2026-11-10T03:00:00Z")),
        base: [], steps: [["zebra", 0, 16, 1, 0, 0, 0, 0], ["zebra", 0, 17, 1, 0, 0, 0, 0]], gone: {}
    });
    const render = (zone: string) => {
        const days = arkRebucketDays(decodeArkHistory(raw, zone)!, zone);
        const {lines} = arkHudLines(days, "all", ["zebra"], "both", "biggest");
        const zebra = lines.get("zebra")!;
        return {days, zebra, html: renderToStaticMarkup(createElement(ArkPopulationGraph, {name: "Plains Zebra", icon: null, history: days, series: zebra.series, stats: zebra.stats, period: "all", onPeriod: noop, onBack: noop, onFly: null, locale: "en"}))};
    };
    const jakarta = render("Asia/Jakarta");
    const la = render("America/Los_Angeles");
    // The axis starts where the record does: 10:00 on the 10th in Jakarta (UTC+7), 19:00 on the 9th in Los Angeles (UTC−8).
    assert.match(jakarta.html, />Nov 10<\/text>/);
    assert.match(la.html, />Nov 9<\/text>/);
    assert.ok(jakarta.html.includes("The record starts Nov 10") && la.html.includes("The record starts Nov 9"));
    // Days are the viewer's: Jakarta's 10th (to 17:00Z) closes with the 16:30Z arrival (23:30 there) and its 11th with the 17:10Z one;
    // Los Angeles' 10th runs 08:00Z to 08:00Z on the 11th, so it closes with both.
    assert.deepEqual(jakarta.zebra.series.counts.slice(0, 3), [0, 1, 2]);
    assert.deepEqual(la.zebra.series.counts.slice(0, 3), [0, 0, 2]);
    assert.equal(jakarta.zebra.series.counts.at(-1), 2);
    assert.equal(la.zebra.series.counts.at(-1), 2);
    // The aria label's start and end are the period's counts; nothing says UTC.
    assert.match(jakarta.html, /population, All: 0 to 2/);
});

// MARK: What the count is, and where the animals are (owner, 2026-11-20)

const zebra = (id: string, extra: Partial<ArkAnimal> = {}) => ({id, species_profile_id: "zebra", name: "Plains Zebra", scientific_name: null, model_slug: "zebra", zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "@someone", named: true}, mine: false, island: "town", ...extra}) as ArkAnimal;
const zebras = [zebra("z1", {area: "zoo", enclosure: "savanna_paddocks-1"}), zebra("z2", {area: "house"}), zebra("z3", {island: "wild"}), zebra("z4", {island: "wild"})];
const ark: ArkSnapshot = {voyage: {slug: "ark", name: "Ark", started_at: null}, counts: {animals: 4, species: 1, founders: 1}, zones: [], animals: zebras, as_of: null};

test("the graph says its count is the whole Ark, the places, where this one is, the breeding rule and what moves the line", () => {
    const {lines} = arkHudLines(history, "24h", ["zebra"], "both", "biggest");
    const line = lines.get("zebra")!;
    const html = renderToStaticMarkup(createElement(ArkPopulationGraph, {name: "Plains Zebra", icon: null, history, series: line.series, stats: line.stats, period: "24h", onPeriod: noop, onBack: noop, onFly: noop, locale: "en", where: arkKindWhere(ark, "zebra", "z1")}));
    assert.match(html, /4 in the whole Ark · 2 wild · 1 in homes · 1 at the zoo/);
    assert.match(html, /This one: alone in its zoo enclosure/);
    assert.match(html, /Breeds only with others in the same place\./);
    assert.match(html, /Up: animals brought aboard from photos, or born\. Down: animals that died or were eaten\./);
    // Without it (a kind that died out, an older caller): the chart and its legend only.
    const bare = renderToStaticMarkup(createElement(ArkPopulationGraph, {name: "Plains Zebra", icon: null, history, series: line.series, stats: line.stats, period: "24h", onPeriod: noop, onBack: noop, onFly: noop, locale: "en"}));
    assert.doesNotMatch(bare, /whole Ark|This one/);
    assert.match(bare, /Up: animals brought aboard/);
});

test("the panel's graph counts the whole Ark whatever island its rows are of, and says where the tapped animal is", () => {
    // The rows are the town island's (scope "town"): the line handed in is the town's, the pane reads the whole Ark's again.
    const town = arkHudLines(history, "24h", ["zebra"], "town", "biggest").lines.get("zebra")!;
    assert.equal(town.stats.now, 0, "the record has its zebras on the wild island");
    const ctx: ArkHudWhere = {snapshot: ark, selectedKey: "zebra", selectedId: "z2", scope: "town", locale: "en"};
    const rows = new Map([["zebra", {name: "Plains Zebra", slug: "zebra"}]]);
    const html = renderToStaticMarkup(createElement(ArkHudGraphPane, {history, graphKey: "zebra", rows, line: town, period: "24h", onPeriod: noop, onBack: noop, onFly: noop, locale: "en", ctx}));
    assert.match(html, /Plains Zebra population, 24 h: 4 to 6/, "the whole Ark's line, not the town's");
    assert.match(html, /This one: 1 of 1 in homes|This one: alone in homes/);
    // Another kind tapped: the graph still says where the kind is, with no "this one".
    const elsewhere = renderToStaticMarkup(createElement(ArkHudGraphPane, {history, graphKey: "zebra", rows, line: town, period: "24h", onPeriod: noop, onBack: noop, onFly: noop, locale: "en", ctx: {...ctx, selectedKey: "lynx", selectedId: "l1"}}));
    assert.match(elsewhere, /4 in the whole Ark/);
    assert.doesNotMatch(elsewhere, /This one/);
});

test("the list's strip: the tapped animal's kind across the Ark, shown only while one is tapped", () => {
    const ctx: ArkHudWhere = {snapshot: ark, selectedKey: "zebra", selectedId: "z3", scope: "both", locale: "en"};
    const withStrip = renderToStaticMarkup(createElement(ArkHudControls, {mode: "biggest", onMode: noop, period: "24h", onPeriod: noop, ctx}));
    assert.match(withStrip, /Plains Zebra/);
    assert.match(withStrip, /4 in the whole Ark · 2 wild · 1 in homes · 1 at the zoo/);
    assert.match(withStrip, /This one: 1 of 2 on the wild island/);
    assert.doesNotMatch(withStrip, /Breeds only/, "the rule shows for an animal alone in its place");
    const lone = renderToStaticMarkup(createElement(ArkHudControls, {mode: "biggest", onMode: noop, period: "24h", onPeriod: noop, ctx: {...ctx, selectedId: "z1"}}));
    assert.match(lone, /This one: alone in its zoo enclosure/);
    assert.match(lone, /Breeds only with others in the same place\./);
    const none = renderToStaticMarkup(createElement(ArkHudControls, {mode: "biggest", onMode: noop, period: "24h", onPeriod: noop, ctx: {...ctx, selectedKey: null, selectedId: null}}));
    assert.doesNotMatch(none, /whole Ark/);
    assert.doesNotMatch(renderToStaticMarkup(createElement(ArkHudControls, {mode: "biggest", onMode: noop, period: "24h", onPeriod: noop})), /whole Ark/);
});

test("the new lines in another language: the page's words, the holes filled", () => {
    const de = bundle("de");
    const {lines} = arkHudLines(history, "24h", ["zebra"], "both", "biggest");
    const line = lines.get("zebra")!;
    const html = renderToStaticMarkup(inLanguage(de, createElement(ArkPopulationGraph, {name: "Steppenzebra", icon: null, history, series: line.series, stats: line.stats, period: "24h", onPeriod: noop, onBack: noop, onFly: noop, locale: "de", where: arkKindWhere(ark, "zebra", "z1")})));
    assert.ok(html.includes("4 in der gesamten Ark"), "the whole Ark's count");
    assert.ok(html.includes("Dieses Tier: allein in seinem Zoogehege"));
    assert.ok(html.includes(de.breedsSamePlace) && html.includes(de.riseFall));
    assert.ok(!/in the whole Ark|This one|Breeds only|Up: animals/.test(html), "no English left");
});
