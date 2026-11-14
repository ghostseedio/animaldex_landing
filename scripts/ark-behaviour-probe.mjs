#!/usr/bin/env node
/**
 * The behaviour world in the browser on a phone profile (behaviours pass 2026-11, lane BP perf;
 * docs/ark/behaviour-pass-2026-11/perf.md), by the graphics pass's method (docs/ark/perf-interaction-2026-11.md §4
 * "A wild animal chosen at ark:ready", §5.3 and §5.4): the embed page (the apps' panel), the production bundle, the
 * real Ark as the page's read, headless Chromium on Metal with the CPU throttled.
 *
 *   node scripts/ark-runtime-measure.mjs --serve 4801 --page embed --production [--profile] --population-file <snapshot.json> &
 *   node scripts/ark-behaviour-probe.mjs http://127.0.0.1:4801 <phone|phone-low> <wild|session> <out.json> [--select <animal id>]
 *
 * `wild`: the host's `ark:select` (close up) sent the moment the page says `ark:ready`, as both apps do for the
 * chat's animal: when the behaviour world's build starts and ends, its main-thread work and slices, the spacing's
 * work, when the first animal is on its schedule and when the first is on its rig. 70 s from `ark:ready`.
 *
 * `session`: a CPU profile from the first navigation (serve the bundle with `--profile`: its names kept) over the
 * wild arrival, then twelve animals picked one every 4 s through the host (`ark:select`, some of them resting: a
 * resting one pinned lays the Ark out and wires every schedule again), then the five-minute rotation step (the page
 * is kept until 20 s past the next multiple of 300 s of the clock). Reported per task (a run of profile samples
 * with the page busy, about a frame): the longest stretches under `tripAt` (a trip worked out), `wireSchedules` and
 * the spacing (a re-wire), `newEntry` and `restingAtRoost` (the rotation step's), and the scene's own per-frame
 * figures (`stats().behaviourMs`, `reactiveStats().ms`).
 *
 * A snapshot holds real usernames: only ids, counts and times are written.
 */
import {existsSync, readdirSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {chromium} from "playwright-core";

const [base, deviceName, mode, out] = process.argv.slice(2);
const option = (name) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
};
if (!base || !deviceName || !mode || !out) throw new Error("usage: ark-behaviour-probe.mjs <base url> <phone|phone-low> <wild|session> <out.json> [--select <id>]");
const DEVICES = {
    phone: {throttle: 4, cores: 8, memory: 4, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"},
    "phone-low": {throttle: 6, cores: 4, memory: 3, userAgent: "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"}
};
const device = DEVICES[deviceName];
if (!device) throw new Error(`no device ${deviceName}`);
function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return undefined;
    for (const name of readdirSync(cache).filter((e) => /^chromium-\d+$/.test(e)).sort().reverse()) {
        const c = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(c)) return c;
    }
    return undefined;
}
const load = () => os.loadavg().map((n) => n.toFixed(1)).join(" ");
const loadStart = load();
const browser = await chromium.launch({executablePath: process.env.ARK_CHROMIUM || cachedChromium(), headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--enable-precise-memory-info", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]});
const context = await browser.newContext({viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: device.userAgent});
await context.addInitScript(({cores, memory, id}) => {
    Object.defineProperty(navigator, "hardwareConcurrency", {get: () => cores});
    Object.defineProperty(navigator, "deviceMemory", {get: () => memory});
    window.__log = [];
    window.__frames = [];
    window.__marks = [];
    // Each animation frame's own main-thread time, kept when it is 50 ms or more (with the clock's time, for the rotation step).
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
        raf((time) => {
            const t = performance.now();
            try {
                callback(time);
            } finally {
                const took = performance.now() - t;
                if (took >= 50) window.__frames.push({at: Math.round(t), clock: Date.now(), ms: Math.round(took)});
            }
        });
    let ark;
    Object.defineProperty(window, "AnimalDexArk", {configurable: true, get: () => ark, set: (value) => {
        for (const name of ["mountArchipelago", "mountArk"]) {
            const mount = value?.[name];
            if (typeof mount !== "function") continue;
            value[name] = (el, options) => {
                const handle = mount(el, options);
                window.__arkHandle = handle;
                return handle;
            };
        }
        ark = value;
    }});
    window.AndroidArk = {postMessage: (text) => {
        try {
            const m = JSON.parse(text);
            if (m.type === "ark:ready" && !window.__ready) {
                window.__ready = performance.now();
                window.__readyClock = Date.now();
                // (As both apps do for the chat's animal.)
                if (id) window.AnimalDexArkHost.send({type: "ark:select", id, closeUp: true});
            }
        } catch {
            // Not the page's own message.
        }
    }};
    setInterval(() => {
        const h = window.__arkHandle;
        const s = h?.stats?.();
        if (!s) return;
        const r = h.reactiveStats?.();
        window.__log.push({at: Math.round(performance.now()), build: s.behaviourBuildMs, slices: s.behaviourBuildSlices, longest: s.behaviourBuildLongestMs, spacing: s.behaviourSpacingMs, scheduled: s.scheduled, behaviour: s.behaviourMs, reactive: r?.ms ?? null, reactiveAgents: r?.agents ?? null, interval: s.intervalMs, frame: s.frameMs, live: s.live, rigged: s.rigged, tier: s.tier, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null});
    }, 250);
}, {cores: device.cores, memory: device.memory, id: option("select") ?? ""});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", {rate: device.throttle});
let profileClock = 0;
if (mode === "session") {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", {interval: 1000});
    await cdp.send("Profiler.start");
    profileClock = Date.now();
}
await page.goto(`${base}/ark/embed.html?snapshot=/population-file.json&perf=1`, {waitUntil: "commit"});
await page.evaluate(() => window.AnimalDexArkHost?.send({type: "ark:power", saver: false, thermal: "nominal", battery: 1, charging: true})).catch(() => undefined);
await page.waitForFunction(() => window.__ready, null, {timeout: 300000, polling: 250});
await page.waitForTimeout(70_000);
const picks = [];
let rotationAt = null;
if (mode === "session") {
    // Twelve animals picked through the host, spread over the read's list (drawn and resting alike), 4 s apart; not
    // across a rotation step (it would be counted as theirs).
    const untilStep = 300_000 - (Date.now() % 300_000);
    if (untilStep < 60_000) await page.waitForTimeout(untilStep + 20_000);
    const ids = await page.evaluate(async () => {
        const read = await (await fetch("/population-file.json")).json();
        const animals = read.animals ?? read.snapshot?.animals ?? [];
        return Array.from({length: 12}, (_, i) => animals[Math.floor(((i + 0.5) / 12) * animals.length)]?.id).filter(Boolean);
    });
    for (const id of ids) {
        const at = await page.evaluate((pick) => {
            const now = {at: Math.round(performance.now()), clock: Date.now()};
            window.AnimalDexArkHost.send({type: "ark:select", id: pick, closeUp: false});
            return now;
        }, id);
        picks.push({id, ...at});
        await page.waitForTimeout(4000);
    }
    await page.evaluate(() => window.AnimalDexArkHost.send({type: "ark:select", id: null})).catch(() => undefined);
    // The rotation step: every 300 s of the clock (`live-budget.ts` ARK_REST_STEP_SECONDS).
    rotationAt = Math.ceil(Date.now() / 300_000) * 300_000;
    await page.waitForTimeout(rotationAt - Date.now() + 20_000);
}
const data = await page.evaluate(() => ({ready: Math.round(window.__ready), readyClock: window.__readyClock, log: window.__log, frames: window.__frames, joined: performance.getEntriesByName("ark:town:joined").map((e) => Math.round(e.startTime))}));
const log = data.log;
const first = (test) => log.find(test)?.at ?? null;
const lastChange = (key) => {
    let last = null;
    for (let i = 1; i < log.length; i++) if (log[i][key] !== log[i - 1][key]) last = log[i].at;
    return last;
};
const buildStart = first((l) => l.build > 0);
const buildEnd = lastChange("build");
const sorted = (list) => [...list].filter((n) => typeof n === "number").sort((a, b) => a - b);
const q = (list, share) => {
    const s = sorted(list);
    return s.length ? s[Math.min(Math.floor(s.length * share), s.length - 1)] : null;
};
const steady = log.filter((l) => l.at > data.ready + 45_000 && l.at < data.ready + 70_000);
const summary = {
    device: deviceName,
    mode,
    load: `${loadStart} → ${load()}`,
    ready: data.ready,
    buildStart: buildStart === null ? null : buildStart - data.ready,
    buildEnd: buildEnd === null ? null : buildEnd - data.ready,
    buildWall: buildStart !== null && buildEnd !== null ? buildEnd - buildStart : null,
    buildWorkMs: log.at(-1)?.build ?? null,
    buildSlices: log.at(-1)?.slices ?? null,
    buildLongestSlice: log.at(-1)?.longest ?? null,
    spacingWorkMs: steady.at(-1)?.spacing ?? log.at(-1)?.spacing ?? null,
    scheduledFirst: (first((l) => l.scheduled > 0) ?? NaN) - data.ready,
    riggedFirst: (first((l) => l.rigged > 0) ?? NaN) - data.ready,
    tier: [...new Set(log.map((l) => l.tier))].join(">"),
    // The scene's own figures over ready +45 s to +70 s (the world built, the chosen animal close up): a frame's schedule and reactive work.
    scheduleMsMedian: q(steady.map((l) => l.behaviour), 0.5),
    scheduleMsP95: q(steady.map((l) => l.behaviour), 0.95),
    reactiveMsMedian: q(steady.map((l) => l.reactive), 0.5),
    reactiveMsP95: q(steady.map((l) => l.reactive), 0.95),
    reactiveAgents: q(steady.map((l) => l.reactiveAgents), 0.5),
    scheduled: q(steady.map((l) => l.scheduled), 0.5),
    frameMsMedian: q(steady.map((l) => l.frame), 0.5),
    heapEnd: log.at(-1)?.heap ?? null,
    framesOver50: data.frames.length,
    worstFrames: [...data.frames].sort((a, b) => b.ms - a.ms).slice(0, 8).map((f) => ({after: f.at - data.ready, ms: f.ms})),
    errors
};
let profileSummary = null;
if (mode === "session") {
    const {profile} = await cdp.send("Profiler.stop");
    // Tasks: runs of samples with the page busy (not idle); in each, the time with a function of interest on the stack.
    const TARGETS = ["tripAt", "wireSchedules", "stepSpacing", "spaceHomesTasks", "refreshLive", "setSnapshot", "newEntry", "restingAtRoost", "scheduleFed", "statusOf", "stepReactive", "poseOnTrip", "placedIntent", "soarHeights", "patrolRoute", "naturalWay", "stationed"];
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const flags = new Map();
    const flagsOf = (id) => {
        let known = flags.get(id);
        if (known !== undefined) return known;
        const node = byId.get(id);
        const up = parent.has(id) ? flagsOf(parent.get(id)) : 0;
        const index = TARGETS.indexOf(node.callFrame.functionName);
        known = up | (index >= 0 ? 1 << index : 0);
        flags.set(id, known);
        return known;
    };
    const idle = new Set(profile.nodes.filter((n) => n.callFrame.functionName === "(idle)" || n.callFrame.functionName === "(program)").map((n) => n.id));
    const tasks = [];
    let now = profile.startTime;
    let task = null;
    for (let i = 0; i < profile.samples.length; i++) {
        const dt = profile.timeDeltas[i + 1] ?? 0;
        now += profile.timeDeltas[i];
        const id = profile.samples[i];
        if (idle.has(id)) {
            if (task) tasks.push(task);
            task = null;
            continue;
        }
        task ??= {clock: profileClock + (now - profile.startTime) / 1000, ms: 0, under: {}};
        task.ms += dt / 1000;
        const f = flagsOf(id);
        for (let k = 0; k < TARGETS.length; k++) if (f & (1 << k)) task.under[TARGETS[k]] = (task.under[TARGETS[k]] ?? 0) + dt / 1000;
    }
    if (task) tasks.push(task);
    const top = (name, from, to, count = 5) =>
        tasks
            .filter((t) => t.clock >= from && t.clock < to && (t.under[name] ?? 0) > 0)
            .sort((a, b) => b.under[name] - a.under[name])
            .slice(0, count)
            .map((t) => ({ms: Math.round(t.under[name]), task: Math.round(t.ms), after: Math.round(t.clock - data.readyClock)}));
    const total = (name, from, to) => Math.round(tasks.filter((t) => t.clock >= from && t.clock < to).reduce((sum, t) => sum + (t.under[name] ?? 0), 0));
    const busy = (from, to) => Math.round(tasks.filter((t) => t.clock >= from && t.clock < to).reduce((sum, t) => sum + t.ms, 0));
    const longest = (from, to, count = 5) =>
        tasks
            .filter((t) => t.clock >= from && t.clock < to)
            .sort((a, b) => b.ms - a.ms)
            .slice(0, count)
            .map((t) => ({ms: Math.round(t.ms), after: Math.round(t.clock - data.readyClock), under: Object.fromEntries(Object.entries(t.under).filter(([, ms]) => ms >= 5).map(([name, ms]) => [name, Math.round(ms)]))}));
    const ready = data.readyClock;
    const pickFrom = picks[0]?.clock ?? Infinity;
    const pickTo = (picks.at(-1)?.clock ?? -Infinity) + 6000;
    const windows = {arrival: [ready, ready + 70_000], picks: [pickFrom, pickTo], rotation: [rotationAt - 1000, rotationAt + 15_000], whole: [ready, Infinity]};
    profileSummary = {};
    for (const [name, [from, to]] of Object.entries(windows)) {
        profileSummary[name] = {
            busyMs: busy(from, to),
            totals: Object.fromEntries(TARGETS.map((t) => [t, total(t, from, to)]).filter(([, ms]) => ms > 0)),
            longestTasks: longest(from, to),
            longestTripAt: top("tripAt", from, to),
            longestWire: top("wireSchedules", from, to, 3),
            longestSpacing: top("stepSpacing", from, to, 3),
            longestNewEntry: top("newEntry", from, to, 3),
            longestResting: top("restingAtRoost", from, to, 3),
            longestSetSnapshot: top("setSnapshot", from, to, 3)
        };
    }
    // Each pick: the longest frame in the 4 s after it.
    summary.picks = picks.map((p) => ({after: p.at - data.ready, worstFrame: Math.max(0, ...data.frames.filter((f) => f.at >= p.at && f.at < p.at + 4000).map((f) => f.ms))}));
    summary.rotationWorstFrame = Math.max(0, ...data.frames.filter((f) => f.clock >= rotationAt - 1000 && f.clock < rotationAt + 15_000).map((f) => f.ms));
    summary.rotationAfterReady = rotationAt - data.readyClock;
}
writeFileSync(out, JSON.stringify({summary, profile: profileSummary, frames: data.frames, log}, null, 1));
console.log(JSON.stringify({summary, profile: profileSummary}, null, 1));
await browser.close();
