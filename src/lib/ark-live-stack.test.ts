import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {ArkLiveLog, ARK_LIVE_LOG_DEFAULTS, type ArkLiveItem} from "./ark-live-log";
import {ARK_LIVE_STACK_MAX, ARK_LIVE_STACK_MAX_PHONE, ARK_LIVE_STACK_STEPS, arkLiveStackFit, arkLiveStackMax, arkLiveStackOpacity, arkLiveStackPick, arkLiveStackTagged} from "./ark-live-stack";

// Decision 439 (owner 2026-11-20): the live log stacks, newest at the foot, the older pushed up and fading.

function now(id: string, at = 0): ArkLiveItem {
    return {id, kind: "hunting", source: "now", key: `now:hunting:${id}`, animal: "Grey Heron", other: null, count: 1, eggs: null, focus: {animalId: id, speciesId: "heron", zone: null}, activity: null, group: null};
}

test("the stack: 4 lines at once, 3 at a phone's width, the newest kept", () => {
    assert.equal(arkLiveStackMax(1440), ARK_LIVE_STACK_MAX);
    assert.equal(arkLiveStackMax(390), ARK_LIVE_STACK_MAX_PHONE);
    assert.equal(ARK_LIVE_STACK_MAX, 4);
    assert.equal(ARK_LIVE_STACK_MAX_PHONE, 3);
    assert.deepEqual(arkLiveStackPick(["a", "b", "c", "d", "e"], 4), ["b", "c", "d", "e"]);
    assert.deepEqual(arkLiveStackPick(["a", "b", "c", "d", "e"], 3), ["c", "d", "e"]);
    assert.deepEqual(arkLiveStackPick(["a"], 4), ["a"]);
    assert.deepEqual(arkLiveStackPick(["a"], 0), []);
});

test("the older a line, the fainter: 1, 0.7, 0.45, 0.25, times its own fade at the end of its life", () => {
    assert.deepEqual(ARK_LIVE_STACK_STEPS, [1, 0.7, 0.45, 0.25]);
    const full = [0, 1, 2, 3].map((rank) => arkLiveStackOpacity(rank, 10_000));
    assert.deepEqual(full, [1, 0.7, 0.45, 0.25]);
    for (let i = 1; i < full.length; i++) assert.ok(full[i] < full[i - 1]);
    assert.equal(arkLiveStackOpacity(9, 10_000), 0.25, "past the steps: the faintest");
    assert.equal(arkLiveStackOpacity(0, 1500), 0.5, "half its fade left: half");
    assert.equal(arkLiveStackOpacity(1, 1500), 0.35);
    assert.equal(arkLiveStackOpacity(0, 0), 0);
    assert.equal(arkLiveStackOpacity(0, -400), 0, "never below 0");
    assert.equal(arkLiveStackOpacity(-1, 99_999), 1, "never above 1");
});

test("only the newest line carries its tag (\"Now\" is said of the line just come)", () => {
    assert.equal(arkLiveStackTagged(0), true);
    for (const rank of [1, 2, 3]) assert.equal(arkLiveStackTagged(rank), false);
});

test("fit: as many as the room above a card holds, the newest always, never a line cut in half", () => {
    assert.equal(arkLiveStackFit([30, 30, 30, 30], 4, 200), 4);
    assert.equal(arkLiveStackFit([30, 30, 30, 30], 4, 98), 3, "3 rows take 98 px exactly");
    assert.equal(arkLiveStackFit([30, 30, 30, 30], 4, 97), 2);
    assert.equal(arkLiveStackFit([46, 30, 46], 4, 90), 2, "a wrapped line takes its two-line height");
    assert.equal(arkLiveStackFit([30, 30], 4, 10), 1, "no room: the newest still");
    assert.equal(arkLiveStackFit([], 4, 100), 0);
});

test("a line goes on its own after about 8-12 s; in a burst each stays readable at least 1.5 s before the next pushes it up", () => {
    for (const life of [ARK_LIVE_LOG_DEFAULTS.serverLife, ARK_LIVE_LOG_DEFAULTS.seenLife, ARK_LIVE_LOG_DEFAULTS.nowLife]) assert.ok(life >= 8_000 && life <= 12_000, `${life} ms`);
    assert.ok(ARK_LIVE_LOG_DEFAULTS.gap >= 1_500);
    assert.equal(ARK_LIVE_LOG_DEFAULTS.maxLines, ARK_LIVE_STACK_MAX);
    // 40 of the schedule's moments at once (and 40 more a moment later): shown one at a time, never sooner than the gap.
    const log = new ArkLiveLog({seenGap: 0});
    log.push(Array.from({length: 40}, (_, i) => now(`a${i}`)), 0);
    log.push(Array.from({length: 40}, (_, i) => now(`b${i}`)), 100);
    assert.ok(log.waiting <= ARK_LIVE_LOG_DEFAULTS.maxSoftQueue, `${log.waiting} waiting: a burst never piles up`);
    const shownAt: number[] = [];
    for (let t = 0; t <= 6_000; t += 100) {
        const before = log.lines.map((l) => l.id).join();
        log.step(t);
        if (log.lines.map((l) => l.id).join() !== before && log.lines.length) shownAt.push(log.lines[log.lines.length - 1].shownAt);
        assert.ok(log.lines.length <= ARK_LIVE_LOG_DEFAULTS.maxLines);
    }
    const distinct = Array.from(new Set(shownAt));
    assert.ok(distinct.length >= 2);
    for (let i = 1; i < distinct.length; i++) assert.ok(distinct[i] - distinct[i - 1] >= 1_500, `${distinct[i] - distinct[i - 1]} ms between two lines`);
    // The newest of the burst are the ones that wait (the oldest were no longer happening).
    assert.ok(log.lines.every((l) => l.id.startsWith("b")), log.lines.map((l) => l.id).join());
});

test("the record's burst still folds into \"+N more\" and the soft cap never drops a record line", () => {
    const log = new ArkLiveLog();
    const record = Array.from({length: 12}, (_, i): ArkLiveItem => ({id: `e${i}`, kind: "arrival", source: "server", key: `arrival:s${i}`, animal: `Bird ${i}`, other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: null, zone: null}}));
    log.push([...record, ...Array.from({length: 30}, (_, i) => now(`n${i}`))], 0);
    let t = 0;
    const kinds: string[] = [];
    while (log.waiting && t < 60_000) {
        log.step(t);
        const last = log.lines[log.lines.length - 1];
        if (last && last.shownAt === t) kinds.push(last.kind);
        t += 100;
    }
    assert.equal(kinds.filter((k) => k === "arrival").length, ARK_LIVE_LOG_DEFAULTS.maxQueue - 1);
    assert.ok(kinds.includes("more"));
});

test("the view: transforms and opacity only, reduced motion fades without sliding, the covered stack fits instead of hiding", () => {
    const view = readFileSync("src/ark-scene/live/log-view.ts", "utf8");
    // Every animation's keyframes: transform, opacity or the fold flash's background, never layout.
    for (const m of Array.from(view.matchAll(/\.animate\?\.\(([^;]*)/g))) {
        assert.ok(!/\b(top|bottom|left|right|height|width|margin|padding)\s*:/.test(m[1]), `layout in an animation: ${m[1].slice(0, 120)}`);
    }
    assert.ok(/reducedMotion \? \[\{opacity: 0\}, \{opacity: target\}\]/.test(view), "reduced motion: the new line only fades in");
    assert.ok(/if \(this\.options\.reducedMotion \|\| this\.collapsed\) \{\s*change\(\);\s*return;/.test(view), "reduced motion: nothing slides");
    assert.ok(!view.includes(":not(:last-child)"), "a card no longer hides all but the newest line");
    assert.ok(/arkLiveStackTagged\(rank\)/.test(view), "the tag on the newest line only");
    assert.ok(!/setInterval|requestAnimationFrame/.test(view), "no per-frame work of its own: the controller's tick renders");
    assert.ok(/this\.timers\.forEach\(\(timer\) => clearTimeout\(timer\)\)/.test(view), "dispose clears the leaving lines' timers");
});
