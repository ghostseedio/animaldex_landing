import assert from "node:assert/strict";
import test from "node:test";
import React, {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ArkGoneRow, ArkHudControls, ArkPopulationGraph, ArkRowSpark, arkHudLines} from "@/app/[locale]/(composited)/ark/ark-population-graph";
import {arkCompactHistory, decodeArkHistory} from "@/lib/ark-population-history";

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
