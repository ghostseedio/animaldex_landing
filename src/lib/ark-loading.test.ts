import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ARK_LOAD_START, ARK_LOAD_WEIGHTS, arkAgoText, arkAnimalsShare, arkLoaderStageText, arkLoadAnimals, arkLoadProgress, arkLoadStage, arkLoadStep, arkLoadWorking, arkNewestArrival, arkProgressMessage, arkWhenSettled, readArkProgressMessage, type ArkLoadState, type ArkLoadStep} from "./ark-loading";
import {ARK_POSTER, ARK_POSTER_BLURRED, ARK_POSTER_PLACEHOLDER} from "./ark-poster";

const root = path.join(__dirname, "..", "..");
const english = JSON.parse(readFileSync(path.join(root, "src", "data", "locales", "en.json"), "utf8")).ark;
const embed = readFileSync(path.join(root, "public", "ark", "embed.html"), "utf8");
const entry = readFileSync(path.join(root, "src", "ark-scene", "embed-entry.ts"), "utf8");

const STEPS: ArkLoadStep[] = ["data", "code", "prepared", "frame"];

test("the weights: every step has a share and they make the whole bar", () => {
    const total = Object.values(ARK_LOAD_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `the shares add up to ${total}`);
    for (const weight of Object.values(ARK_LOAD_WEIGHTS)) assert.ok(weight > 0 && weight < 0.5);
});

test("the stages: reading until the data, building until the first frame, the animals until they are in", () => {
    let state: ArkLoadState = ARK_LOAD_START;
    assert.equal(arkLoadStage(state), "data");
    state = arkLoadStep(state, "code");
    assert.equal(arkLoadStage(state), "data", "the code alone is not who is aboard");
    state = arkLoadStep(state, "data");
    assert.equal(arkLoadStage(state), "world");
    state = arkLoadStep(state, "prepared");
    assert.equal(arkLoadStage(state), "world");
    state = arkLoadStep(state, "frame");
    assert.equal(arkLoadStage(state), "animals");
    state = arkLoadAnimals(state, 0.5, false);
    assert.equal(arkLoadStage(state), "animals");
    state = arkLoadAnimals(state, 0.5, true);
    assert.equal(arkLoadStage(state), "done");
});

test("the bar: only real steps move it, never back, and it is full only when the animals are in", () => {
    const orders: ArkLoadStep[][] = [STEPS, ["code", "data", "prepared", "frame"], ["data", "code", "frame", "prepared"]];
    for (const order of orders) {
        let state: ArkLoadState = ARK_LOAD_START;
        let last = arkLoadProgress(state);
        assert.equal(last, 0);
        for (const step of order) {
            state = arkLoadStep(state, step);
            const now = arkLoadProgress(state);
            assert.ok(now > last, `${step} moves the bar (${last} → ${now})`);
            last = now;
        }
        assert.ok(last < 1, "the first frame is not the end");
        for (const share of [0.2, 0.1, 0.6, 0.99]) {
            state = arkLoadAnimals(state, share, false);
            const now = arkLoadProgress(state);
            assert.ok(now >= last, "the animals' share never goes back");
            last = now;
        }
        assert.ok(last < 1, "99% of the models is not all of them");
        state = arkLoadAnimals(state, 0.99, true);
        assert.equal(arkLoadProgress(state), 1);
    }
});

test("the animals' share counts only after the first frame (before it, nothing is asked for the view)", () => {
    const before = arkLoadAnimals(arkLoadStep(ARK_LOAD_START, "data"), 0.8, false);
    assert.equal(arkLoadProgress(before), ARK_LOAD_WEIGHTS.data);
});

test("a step done twice changes nothing (the same state back)", () => {
    const once = arkLoadStep(ARK_LOAD_START, "data");
    assert.equal(arkLoadStep(once, "data"), once);
    const animals = arkLoadAnimals(arkLoadStep(once, "frame"), 0.4, false);
    assert.equal(arkLoadAnimals(animals, 0.4, false), animals);
});

test("the work under way: the next step's share, then what the animals have left, then nothing", () => {
    assert.equal(arkLoadWorking(ARK_LOAD_START), ARK_LOAD_WEIGHTS.data);
    assert.equal(arkLoadWorking(arkLoadStep(ARK_LOAD_START, "data")), ARK_LOAD_WEIGHTS.code);
    const framed = STEPS.reduce(arkLoadStep, ARK_LOAD_START);
    assert.equal(arkLoadWorking(framed), ARK_LOAD_WEIGHTS.animals);
    assert.equal(arkLoadWorking(arkLoadAnimals(framed, 0.5, false)), ARK_LOAD_WEIGHTS.animals / 2);
    assert.equal(arkLoadWorking(arkLoadAnimals(framed, 0.5, true)), 0);
    // The bar and the sheen never run past the end.
    let state = ARK_LOAD_START;
    for (const step of STEPS) {
        state = arkLoadStep(state, step);
        assert.ok(arkLoadProgress(state) + arkLoadWorking(state) <= 1 + 1e-9);
    }
});

test("the models' share: what was asked less what is still pending; nothing asked is 0", () => {
    assert.equal(arkAnimalsShare(0, 0), 0);
    assert.equal(arkAnimalsShare(10, 10), 0);
    assert.equal(arkAnimalsShare(4, 10), 0.6);
    assert.equal(arkAnimalsShare(0, 10), 1);
    assert.equal(arkAnimalsShare(12, 10), 0);
});

test("the newest arrival: came aboard (not born), a real species (not the placeholder), the latest", () => {
    const animals = [
        {name: "Plains Zebra", model_slug: "plains-zebra", arrived_at: "2026-11-12T10:00:00Z", origin: "arrived" as const},
        {name: "Zebra foal", model_slug: "plains-zebra", arrived_at: "2026-11-13T10:00:00Z", origin: "born" as const},
        {name: "Unknown", model_slug: "placeholder--abc", arrived_at: "2026-11-13T11:00:00Z", origin: "arrived" as const, placeholder: true},
        {name: "Komodo Dragon", model_slug: "komodo-dragon", arrived_at: "2026-11-13T09:00:00Z"},
        {name: "Bad date", model_slug: "x", arrived_at: "not a date"}
    ];
    assert.equal(arkNewestArrival(animals)?.name, "Komodo Dragon");
    assert.equal(arkNewestArrival([]), null);
    assert.equal(arkNewestArrival([animals[1], animals[2]]), null);
});

test("how long ago, in the reader's language (Intl): no words of our own", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    assert.equal(arkAgoText("2026-11-13T11:59:30Z", now, "en"), "now");
    assert.equal(arkAgoText("2026-11-13T11:15:00Z", now, "en"), "45 minutes ago");
    assert.equal(arkAgoText("2026-11-13T09:00:00Z", now, "en"), "3 hours ago");
    assert.equal(arkAgoText("2026-11-12T09:00:00Z", now, "en"), "yesterday");
    assert.equal(arkAgoText("2026-11-10T09:00:00Z", now, "en"), "3 days ago");
    assert.equal(arkAgoText("2026-10-20T09:00:00Z", now, "en"), "3 weeks ago");
    assert.equal(arkAgoText("2026-11-13T09:00:00Z", now, "id"), "3 jam yang lalu");
    assert.equal(arkAgoText("2026-11-13T13:00:00Z", now, "en"), "now", "a clock ahead reads as now");
    assert.equal(arkAgoText("nonsense", now, "en"), "");
    assert.ok(arkAgoText("2026-11-13T09:00:00Z", now, "zz-not-a-locale").length > 0);
});

test("the stage's words", () => {
    const words = english.loader;
    assert.equal(arkLoaderStageText("data", words), "Reading who is aboard");
    assert.equal(arkLoaderStageText("world", words), "Building the island");
    assert.equal(arkLoaderStageText("animals", words), "Bringing the animals into view");
});

test("ark:progress out and in: the stage and the bar, anything else is not one", () => {
    const state = arkLoadStep(arkLoadStep(ARK_LOAD_START, "code"), "data");
    const message = arkProgressMessage(state);
    assert.deepEqual(message, {type: "ark:progress", stage: "world", progress: Math.round((ARK_LOAD_WEIGHTS.code + ARK_LOAD_WEIGHTS.data) * 1000) / 1000});
    assert.deepEqual(readArkProgressMessage(message), {stage: "world", progress: message.progress});
    assert.deepEqual(readArkProgressMessage({type: "ark:progress", stage: "done", progress: 7}), {stage: "done", progress: 1});
    assert.equal(readArkProgressMessage({type: "ark:ready"}), null);
    assert.equal(readArkProgressMessage({type: "ark:progress", stage: "nearly", progress: 0.5}), null);
    assert.equal(readArkProgressMessage({type: "ark:progress", stage: "data"}), null);
    assert.equal(readArkProgressMessage(null), null);
});

test("the hand-off waits for the second drawn frame (the first is a fog wash), at most the cap", () => {
    const queue: Array<() => void> = [];
    const schedule = (callback: () => void) => {
        queue.push(callback);
        return () => undefined;
    };
    let clock = 0;
    let drawn = 1;
    let calls = 0;
    arkWhenSettled({runtime: () => ({drawn})}, () => calls++, 2000, schedule, () => clock);
    assert.equal(calls, 0, "not at the wash");
    queue.shift()!();
    assert.equal(calls, 0);
    drawn = 2;
    queue.shift()!();
    assert.equal(calls, 1, "at the second frame");
    assert.equal(queue.length, 0, "and no more checks");
    // A scene that never draws again: the cap.
    let capped = 0;
    arkWhenSettled({runtime: () => ({drawn: 1})}, () => capped++, 2000, schedule, () => clock);
    clock = 2500;
    queue.shift()!();
    assert.equal(capped, 1);
    // No runtime numbers (an older scene): at once.
    let bare = 0;
    arkWhenSettled({}, () => bare++, 2000, schedule, () => clock);
    assert.equal(bare, 1);
    // Cancelled: never.
    let cancelled = 0;
    const cancel = arkWhenSettled({runtime: () => ({drawn: 1})}, () => cancelled++, 2000, schedule, () => clock);
    cancel();
    queue.splice(0).forEach((callback) => callback());
    assert.equal(cancelled, 0);
});

// MARK: The embed (public/ark/embed.html) keeps to the same

test("the embed's English before its words are read is en.json's", () => {
    const match = embed.match(/var ENGLISH = (\{.*?\});\n/);
    assert.ok(match, "the embed's English fallback");
    const fallback = JSON.parse(match![1].replace(/([{,]\s*)(\w+):/g, "$1\"$2\":")) as Record<string, string>;
    assert.deepEqual(fallback, {
        data: english.loader.data,
        world: english.loader.world,
        animals: english.loader.animals,
        newest: english.loader.newest,
        loading: english.loading,
        chip: english.hud.chip,
        speciesOne: english.speciesOne,
        speciesOther: english.speciesOther
    });
});

test("the embed's first frame is the page's poster, blurred: the same placeholders, and no request of its own", () => {
    assert.ok(embed.includes(`url("${ARK_POSTER_BLURRED.tall}")`), "the tall placeholder, blurred");
    assert.ok(embed.includes(`url("${ARK_POSTER_BLURRED.wide}")`), "the wide placeholder, blurred");
    // (Blurred by its own SVG, never by a CSS filter on the full-screen layer: redone on every animated frame.)
    assert.ok(!/#ark-loader[^{]*\{[^}]*[^-]filter: blur/.test(embed), "no CSS blur filter on the loading screen's frame (the card's backdrop blur is its own)");
    for (const src of Object.values(ARK_POSTER_BLURRED)) assert.ok(!src.includes("#") && !src.includes("<") && !src.includes("\""), "safe inside url(\"…\")");
    // (The full poster in the embed took bandwidth from the scene's code: 0.4 s later to the first frame on slow 4G.)
    assert.ok(!embed.includes(path.basename(ARK_POSTER.tall)) && !embed.includes(path.basename(ARK_POSTER.wide)), "no poster download");
    for (const src of Object.values(ARK_POSTER_PLACEHOLDER)) {
        assert.match(src, /^data:image\/webp;base64,/);
        assert.ok(src.length < 600, "a few hundred bytes");
    }
});

test("every loading function the embed calls is on the bundle's window.AnimalDexArk", () => {
    const used = new Set(Array.from(embed.matchAll(/\bArk\.((?:ark|ARK_|markArk)\w*)/g), (m) => m[1]).filter((name) => /Load|Animals|Newest|Ago|Progress|ARK_LOAD/.test(name)));
    assert.ok(used.size >= 10, `the embed uses the loading functions (${Array.from(used).join(", ")})`);
    for (const name of Array.from(used)) assert.match(entry, new RegExp(`^    ${name},?$`, "m"), `${name} exported`);
});
