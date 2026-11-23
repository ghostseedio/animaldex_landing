import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/flows/flow-params.json";
import {CARD_RETURN_SECONDS, cardRuns, FLOW_TICK_SECONDS, flowStepAt, flowSteps, forgetFlows, stepCard, stepLine, stepMoment, tickOf, tickSteps, type FlowServer, type FlowSubject} from "@/ark-scene/flows/flows";
import {foodWordsOf, type FlowParams} from "@/ark-scene/flows/params";
import {islandHours} from "@/lib/ark-clock";

const P = (table as unknown as {species: Record<string, FlowParams>}).species;
const hoursAt = (epoch: number) => islandHours(epoch * 1000);
const subject = (slug: string, server: Partial<FlowServer> = {}, id = `id-${slug}`): FlowSubject => ({id, params: P[slug], server: {fedOn: () => true, ...server}, hoursAt});
// 2026-11-23 11:00 UTC: the island's late morning; a long day's worth of ticks after it.
const T0 = Date.UTC(2026, 10, 23, 11) / 1000;
const TICKS = Array.from({length: 40}, (_, k) => tickOf(T0) + k);

test("flows: the same for every viewer (read in any order, after forgetting)", () => {
    for (const slug of Object.keys(P)) {
        forgetFlows();
        const a = TICKS.map((tick) => JSON.stringify(tickSteps(subject(slug), tick)));
        forgetFlows();
        const b = [...TICKS].reverse().map((tick) => JSON.stringify(tickSteps(subject(slug), tick))).reverse();
        assert.deepEqual(a, b, slug);
        // A viewer arriving mid-tick reads the step the other one is on.
        const t = T0 + 1234.5;
        forgetFlows();
        const one = flowStepAt(subject(slug), t);
        forgetFlows();
        flowSteps(subject(slug), T0, T0 + 4000);
        assert.deepEqual(flowStepAt(subject(slug), t), one, slug);
    }
});

test("flows: a tick's steps are in order, inside the tick, and never overlap", () => {
    for (const slug of Object.keys(P)) {
        for (const tick of TICKS) {
            const steps = tickSteps(subject(slug), tick);
            const start = tick * FLOW_TICK_SECONDS;
            for (let i = 0; i < steps.length; i++) {
                assert.ok(steps[i].from >= start - 1e-6 && steps[i].to <= start + FLOW_TICK_SECONDS + 1e-6, `${slug} ${tick}`);
                assert.ok(steps[i].to > steps[i].from, `${slug} empty step`);
                if (i) assert.ok(steps[i].from >= steps[i - 1].to - 1e-6, `${slug} overlap`);
            }
        }
    }
});

test("flows: eating, catching and caching are always still (never in the air, never moving)", () => {
    for (const slug of Object.keys(P)) for (const tick of TICKS) for (const step of tickSteps(subject(slug, {kills: [{at: tick * FLOW_TICK_SECONDS + 1500, prey: "Bank Vole"}]}), tick)) {
        if (["eat", "catch", "cache", "found", "keptEat", "mate"].includes(step.kind)) assert.equal(step.pose, "still", `${slug} ${step.kind}`);
    }
});

test("flows: no catch without the server's kill; the kill is caught at its time, with its prey", () => {
    forgetFlows();
    for (const slug of ["red-fox", "domestic-cat", "grey-heron", "black-and-yellow-garden-spider"]) {
        for (const tick of TICKS) assert.ok(!tickSteps(subject(slug), tick).some((s) => s.kind === "catch"), `${slug} caught with no kill`);
        // A fox awake at dusk (crepuscular): the kill at 16:40 UTC.
        const at = Date.UTC(2026, 10, 23, 16, 40) / 1000;
        const steps = flowSteps(subject(slug, {kills: [{at, prey: "Bank Vole"}], version: "kill"}), at - 3600, at + 600);
        const catches = steps.filter((s) => s.kind === "catch");
        if (!steps.some((s) => s.kind !== "sleep" && s.from <= at && s.to > at - 5)) continue; // asleep then (its kind's hours)
        assert.equal(catches.length, 1, slug);
        assert.ok(Math.abs(catches[0].from - at) < 1, slug);
        assert.equal(catches[0].detail, "Bank Vole");
        assert.equal(stepLine(catches[0]), "Caught a Bank Vole");
    }
});

test("flows: no eating on a day the engine did not feed it; on a fed day it eats", () => {
    for (const slug of ["red-deer", "house-sparrow", "eurasian-jay", "western-honey-bee", "greater-sage-grouse"]) {
        let fedTicks = 0;
        let fedAte = 0;
        for (const tick of TICKS) {
            const hungry = tickSteps(subject(slug, {fedOn: () => false}, `h-${slug}`), tick);
            assert.ok(!hungry.some((s) => s.kind === "eat" || s.kind === "found"), `${slug} ate while unfed`);
            const fed = tickSteps(subject(slug), tick);
            const awake = fed.filter((s) => s.kind !== "sleep").reduce((n, s) => n + s.to - s.from, 0);
            if (awake < FLOW_TICK_SECONDS * 0.9) continue;
            fedTicks++;
            if (fed.some((s) => s.kind === "eat")) fedAte++;
        }
        assert.ok(fedTicks > 0, `${slug}: no waking tick`);
        assert.ok(fedAte / fedTicks >= 0.9, `${slug}: ate on ${fedAte} of ${fedTicks} fed ticks`);
    }
});

test("flows: no mating without the server's; a neutered or kept-alone animal never courts", () => {
    const repro = {inSeason: true, sex: "male" as const, partner: true};
    for (const tick of TICKS) assert.ok(!tickSteps(subject("red-deer", {repro}), tick).some((s) => s.kind === "mate"));
    for (const tick of TICKS) assert.ok(!tickSteps(subject("red-deer", {repro: {...repro, neutered: true}}, "neutered"), tick).some((s) => ["court", "display", "mate", "build"].includes(s.kind)));
    for (const tick of TICKS) assert.ok(!tickSteps(subject("red-deer", {repro: {...repro, partner: false}}, "alone"), tick).some((s) => s.kind === "court"));
    // (17:30 UTC: a crepuscular deer's dusk.)
    const at = Date.UTC(2026, 10, 23, 17, 30) / 1000;
    const steps = flowSteps(subject("red-deer", {repro: {...repro, mated: [at]}}, "mated"), at - 600, at + 600);
    assert.equal(steps.filter((s) => s.kind === "mate").length, 1);
});

test("flows: a cache is played only when the engine saved one", () => {
    for (const tick of TICKS) assert.ok(!tickSteps(subject("eurasian-jay"), tick).some((s) => s.kind === "cache"));
    const at = T0 + 2000;
    const steps = flowSteps(subject("eurasian-jay", {caches: [{at, recipe: "cache_food"}]}, "cacher"), at - 400, at + 400);
    const cache = steps.find((s) => s.kind === "cache");
    assert.ok(cache && cache.server);
    assert.equal(stepLine(cache!), "Hiding an acorn for later");
});

test("flows: parameters come from the stored text", () => {
    assert.equal(P["red-fox"].guild, "stalker");
    assert.equal(P["red-fox"].mode, "listen");
    assert.equal(P["red-fox"].cache?.method, "hide");
    assert.equal(P["domestic-cat"].mode, "watch");
    assert.equal(P["grey-heron"].guild, "sitwait");
    assert.equal(P["red-deer"].foods[0].eat, "grass");
    assert.equal(P["red-deer"].repro.contest, "antler_clash");
    assert.equal(P["greater-sage-grouse"].repro.system, "lek");
    assert.equal(P["house-sparrow"].repro.provision, true);
    assert.equal(P["western-honey-bee"].dance, true);
    assert.equal(P["western-honey-bee"].repro.system, "none");
    assert.deepEqual(foodWordsOf("Seeds, crumbs, insects, grain, and opportunistic scraps").map((f) => f.eat), ["seeds", "crumbs", "an insect", "grain", "scraps"]);
});

test("flows: no fake events: with nothing from the server, only neutral steps and its engine background food", () => {
    forgetFlows();
    const outcome = new Set(["stalk", "attempt", "nearMiss", "catch", "found", "cache", "display", "court", "mate", "build"]);
    for (const slug of Object.keys(P)) {
        for (const [k, server] of [{}, {fedOn: () => false}, {repro: {inSeason: true, sex: "male" as const, partner: true}}, {repro: {inSeason: true, sex: "female" as const, partner: true}}].entries()) {
            const steps = flowSteps(subject(slug, {...server, version: `fake-${k}`}, `fake-${slug}-${k}`), T0, T0 + 20 * FLOW_TICK_SECONDS);
            const foods = new Set(P[slug].foods.map((f) => f.eat));
            for (const step of steps) {
                assert.ok(!outcome.has(step.kind), `${slug}: ${step.kind} with no server event`);
                if (step.kind === "eat") assert.ok(step.food && foods.has(step.food.eat), `${slug} ate ${step.food?.eat}, not its engine background food`);
                assert.equal(stepMoment(step, steps, P[slug]), null, `${slug}: a moment with no server event`);
            }
        }
    }
    // A fox's everyday food is its engine background food (insects, fruit), never a rodent of the diet sentence.
    assert.deepEqual(P["red-fox"].foods.map((f) => f.eat), ["an insect", "fruit"]);
    assert.deepEqual(P["domestic-cat"].foods, []);
});

test("flows: the engine's escape is said as its near miss, with the prey that got away, at its time", () => {
    forgetFlows();
    const at = Date.UTC(2026, 10, 23, 16, 45) / 1000;
    const steps = flowSteps(subject("red-fox", {escapes: [{at, prey: "Wood Mouse"}], version: "escape"}, "escaper"), at - 1800, at + 300);
    const miss = steps.find((s) => s.kind === "nearMiss" && s.server);
    assert.ok(miss);
    assert.ok(Math.abs(miss!.from - at) < 1);
    assert.equal(stepLine(miss!), "Missed: the Wood Mouse got away");
});

test("flows: the card never flickers between two lines (a line does not return within CARD_RETURN_SECONDS around one other)", () => {
    forgetFlows();
    const scenarios: Array<[string, Partial<FlowServer>]> = [];
    for (const slug of Object.keys(P)) {
        scenarios.push([slug, {}], [slug, {fedOn: () => false}]);
        scenarios.push([slug, {repro: {inSeason: true, sex: "male", partner: true, displays: [T0 + 4000, T0 + 9000]}}], [slug, {repro: {inSeason: true, sex: "female", partner: true, laid: [T0 + 20 * FLOW_TICK_SECONDS]}}]);
        scenarios.push([slug, {kills: [{at: T0 + 5000, prey: "Bank Vole"}], escapes: [{at: T0 + 2500, prey: "Wood Mouse"}]}]);
    }
    scenarios.push(["domestic-cat", {kept: {feedings: [T0 + 3000, T0 + 30000]}}]);
    const bad: string[] = [];
    scenarios.forEach(([slug, server], k) => {
        const steps = flowSteps(subject(slug, {...server, version: `s${k}`}, `flicker-${k}`), T0, T0 + 30 * FLOW_TICK_SECONDS);
        const runs = cardRuns(steps);
        for (let i = 0; i + 2 < runs.length; i++) {
            if (runs[i].line === runs[i + 2].line && runs[i + 1].to - runs[i + 1].from < CARD_RETURN_SECONDS && bad.length < 12) bad.push(`${slug}: ${runs[i].line} / ${runs[i + 1].line} (${Math.round(runs[i + 1].to - runs[i + 1].from)} s)`);
        }
    });
    assert.deepEqual(bad, []);
});

test("flows: a nest's trips and a bee's flowers are one card line with progress", () => {
    forgetFlows();
    // (Only in the ticks before a clutch the server laid: none without one.)
    assert.ok(!flowSteps(subject("house-sparrow", {repro: {inSeason: true, sex: "female", partner: true}, version: "nolaid"}, "nolaid"), T0, T0 + 3 * 3600).some((s) => s.kind === "build"));
    const nest = flowSteps(subject("house-sparrow", {repro: {inSeason: true, sex: "female", partner: true, laid: [T0 + 4 * 3600]}, version: "nest"}, "nester"), T0, T0 + 3 * 3600).filter((s) => s.bout?.kind === "nest");
    assert.ok(nest.length > 4);
    assert.ok(nest.every((s) => stepCard(s).line === "Building its nest"));
    assert.match(stepLine(nest[nest.length - 1]), /^Building its nest · trip \d+, carrying grass$/);
    const bee = flowSteps(subject("western-honey-bee", {version: "bee"}, "bee"), T0, T0 + 3600).filter((s) => s.bout?.kind === "flowers");
    assert.ok(bee.length > 4 && bee.every((s) => stepCard(s).line === "Visiting flowers"));
});
