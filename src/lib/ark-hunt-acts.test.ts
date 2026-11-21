import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/hunt-acts.json";
import recipesTable from "@/ark-scene/recipes.json";
import full from "../../data/ark/hunt-acts.json";
import tactics from "../../data/ark/hunt-tactics.json";
import {HUNT_ACTS, LIVE_HUNT_ACTS, huntActOf, huntChoice, huntRun, setAllHuntActs, type HuntAct, type HuntCtx, type HuntInput, type HuntRun} from "@/ark-scene/hunt-acts";

// (Every act, as the harness plays them; the live page plays only LIVE_HUNT_ACTS: the last test.)
setAllHuntActs(true);
import {missGap} from "@/ark-scene/live-escapes";
import type {ActBody} from "@/ark-scene/acts";

const SPECIES = (table as {species: Record<string, string>}).species;

const body = (x: number, z: number, length: number, o: Partial<ActBody> = {}): ActBody => ({x, z, base: 0, yaw: 0, length, height: length * 0.5, speed: 1, ...o});
const base = (act: HuntAct, predator: ActBody, prey: ActBody, o: Partial<HuntInput> = {}): HuntInput => ({
    act,
    predator,
    prey,
    seed: `${act}#${predator.length}`,
    flee: "run",
    miss: false,
    gap: missGap(predator.length, prey.length),
    exact: true,
    meal: true,
    ground: () => 0,
    paces: {sprint: Math.min(2 + predator.length * 6, 14), flee: Math.min(1 + prey.length * 6, 9), stalk: Math.max(predator.length * 0.45, 0.2), dive: 14},
    ...o
});

/** A case per act: the hunter, its prey, the flee style, the ground. */
type Case = {act: HuntAct; predator: ActBody; prey: ActBody; flee?: HuntInput["flee"]; water?: boolean; air?: boolean};
const CASES: Case[] = [
    {act: "pounce", predator: body(0, 0, 0.5), prey: body(0, 12, 0.08)},
    {act: "leap", predator: body(0, 0, 0.7), prey: body(3, 9, 0.12)},
    {act: "pounce", predator: body(0, 0, 2.7), prey: body(0, 25, 1.5), flee: "run"},
    {act: "jump", predator: body(0, 0, 0.012), prey: body(0, 0.4, 0.004, {height: 0.002}), flee: "run"},
    {act: "dash", predator: body(0, 0, 0.12), prey: body(0, 2, 0.02)},
    {act: "dash", predator: body(0, 0, 0.02), prey: body(0, 1, 0.01), flee: "bound"},
    {act: "lunge", predator: body(0, 0, 0.1), prey: body(0, 1.2, 0.02)},
    {act: "tongue", predator: body(0, 0, 0.08), prey: body(0, 1.4, 0.015)},
    {act: "web", predator: body(0, 0, 0.02), prey: body(0, 0.3, 0.008), flee: "fly"},
    {act: "wade", predator: body(0, 0, 1.0), prey: body(0, 10, 0.3), flee: "swim", water: true},
    {act: "wade", predator: body(0, 0, 0.9), prey: body(0, 8, 0.1)},
    {act: "peck", predator: body(0, 0, 0.25), prey: body(0, 6, 0.02)},
    {act: "lurk", predator: body(0, 0, 3.5, {base: -0.1}), prey: body(0, 6, 1.2), water: true},
    {act: "drop", predator: body(0, 0, 0.5, {base: 3}), prey: body(0, 12, 0.1)},
    {act: "hover", predator: body(0, 0, 0.35, {base: 8}), prey: body(0, 10, 0.1)},
    {act: "plunge", predator: body(0, 0, 0.6, {base: 10}), prey: body(0, 12, 0.3, {base: -0.2}), flee: "swim", water: true},
    {act: "talon", predator: body(0, 0, 0.7, {base: 6}), prey: body(0, 14, 0.3, {base: -0.2}), flee: "swim", water: true},
    {act: "hawk", predator: body(0, 0, 0.08, {base: 1.5}), prey: body(0, 8, 0.01, {base: 1.5}), flee: "fly", air: true},
    {act: "hawk", predator: body(0, 0, 0.18, {base: 3}), prey: body(2, 10, 0.02, {base: 2}), flee: "fly", air: true}
];

const finite = (run: HuntRun) => {
    for (const list of [run.pred, run.prey]) {
        for (const s of list) {
            assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.y) && Number.isFinite(s.yaw) && Number.isFinite(s.v) && Number.isFinite(s.pitch), JSON.stringify(s));
            assert.ok(typeof s.state === "string" && s.state.length > 0);
        }
    }
};

const run = (c: Case, miss: boolean, seed = "s1") => {
    const input = base(c.act, c.predator, c.prey, {miss, seed, flee: c.flee ?? "run", ...(c.water ? {water: (x: number, z: number) => z < 1000, ground: () => -0.3} : {})});
    return {input, out: huntRun(input)};
};

test("every act builds, in a catch and in a miss: finite, two lists of one length, the catch inside them", () => {
    for (const c of CASES) {
        for (const miss of [false, true]) {
            const {out} = run(c, miss);
            assert.ok(out, `${c.act} ${miss ? "miss" : "catch"} built nothing`);
            finite(out);
            assert.equal(out.pred.length, out.prey.length);
            assert.ok(out.tc > 0.3 && out.tc * 60 <= out.pred.length, `${c.act} tc ${out.tc} of ${out.seconds}`);
            assert.ok(out.seconds < 40, `${c.act} runs ${out.seconds} s`);
        }
    }
});

test("no jumps: no body moves further than its pace allows between two frames", () => {
    for (const c of CASES) {
        for (const miss of [false, true]) {
            const {out} = run(c, miss);
            assert.ok(out);
            for (const [who, list] of [["hunter", out.pred], ["prey", out.prey]] as const) {
                for (let k = 1; k < list.length; k++) {
                    const step = Math.hypot(list[k].x - list[k - 1].x, list[k].z - list[k - 1].z, list[k].y - list[k - 1].y);
                    const length = who === "hunter" ? c.predator.length : c.prey.length;
                    // (60 body lengths a second and 25 m/s at the most: far over any real pace, far under a teleport.)
                    assert.ok(step < Math.max(length * 60, 0.4) / 60 + 25 / 60, `${c.act} ${who} ${miss ? "miss" : "catch"} frame ${k}: a step of ${step.toFixed(3)} m`);
                }
            }
        }
    }
});

test("a catch ends with the hunter's mouth on its prey", () => {
    for (const c of CASES) {
        const {out} = run(c, false);
        assert.ok(out);
        const k = Math.round(out.tc * 60);
        const p = out.pred[k];
        const q = out.prey[k];
        const d = Math.hypot(p.x - q.x, p.z - q.z, c.air || c.act === "drop" || c.act === "hover" || c.act === "plunge" || c.act === "talon" ? p.y - q.y : 0);
        const reach = (c.predator.length + c.prey.length) * 0.5 + 1.2;
        assert.ok(d <= reach, `${c.act}: ${d.toFixed(2)} m apart at the catch, reach ${reach.toFixed(2)}`);
    }
});

test("a miss is never a catch: the hunter is never nearer than the gap", () => {
    for (const c of CASES) {
        for (const seed of ["a", "b", "c"]) {
            const {input, out} = run(c, true, seed);
            assert.ok(out);
            for (let k = 0; k < out.pred.length; k++) {
                const air = ["drop", "hover", "plunge", "talon", "hawk"].includes(c.act);
                const d = Math.hypot(out.pred[k].x - out.prey[k].x, out.pred[k].z - out.prey[k].z, air ? out.pred[k].y - out.prey[k].y : 0);
                assert.ok(d >= input.gap * 0.999, `${c.act} ${seed} frame ${k}: ${d.toFixed(3)} m apart, gap ${input.gap.toFixed(3)}`);
            }
        }
    }
});

test("an act is the same for every viewer: the same seed gives the same run, another seed another", () => {
    for (const c of CASES) {
        const a = run(c, false, "same").out;
        const b = run(c, false, "same").out;
        assert.ok(a && b);
        assert.deepEqual(a.pred, b.pred);
        assert.deepEqual(a.prey, b.prey);
        assert.equal(a.tc, b.tc);
    }
});

test("the table: every act is a known one, each species has one, and every row cites the species' own text, its ambient recipe or its E5 style", () => {
    const acts = (full as {acts: Array<{slug: string; act: string; basis: string; because: string; quote: string | null}>}).acts;
    assert.equal(acts.length, Object.keys(SPECIES).length);
    for (const row of acts) {
        assert.ok((HUNT_ACTS as readonly string[]).includes(row.act), row.slug);
        assert.equal(SPECIES[row.slug], row.act, row.slug);
        assert.ok(["catalogue", "recipe", "style"].includes(row.basis), row.slug);
        assert.ok(row.because.length > 3, row.slug);
        // (A catalogue or a style row names its sentence, as it is stored.)
        if (row.basis !== "recipe") assert.ok(row.quote && row.quote.length > 3, `${row.slug} has no quote`);
    }
    // The quotes are the stored sentences: each is in the extract of the species' own text.
    const byslug = new Map((tactics as {species: Array<{slug: string; rows: Array<{quote: string}>; style: {phrase: string | null} | null}>}).species.map((s) => [s.slug, s]));
    for (const row of acts) {
        if (row.basis === "recipe") continue;
        const sp = byslug.get(row.slug);
        assert.ok(sp, row.slug);
        const quotes = [...sp.rows.map((r) => r.quote), sp.style?.phrase ?? ""];
        assert.ok(quotes.includes(row.quote ?? ""), `${row.slug}: ${row.quote} is not a stored sentence`);
    }
});

test("one way of hunting a species: a species with an ambient hunting recipe has an act of the same family", () => {
    const FAMILY: Record<string, string[]> = {
        pounce: ["pounce", "leap", "dash", "lunge", "drop", "jump"],
        hawk_insects: ["hawk", "peck"],
        aerial_hawk: ["hawk"],
        bat_hawk: ["hawk"],
        hover_drop: ["hover"],
        talon_grab: ["talon", "stoop", "plunge"],
        air_plunge: ["plunge", "talon"],
        perch_plunge: ["plunge", "drop"],
        pouch_scoop: ["talon", "wade", "plunge"],
        wade_spear: ["wade"],
        bill_sweep: ["wade"],
        surface_dive: ["dive"]
    };
    const recipes = (recipesTable as {species: Record<string, string>}).species;
    let checked = 0;
    for (const [slug, act] of Object.entries(SPECIES)) {
        const row = recipes[slug];
        if (!row) continue;
        const ids = row.split("|")[0].split(",").filter(Boolean).map((r) => r.slice(0, r.lastIndexOf(".")));
        const hunts = ids.filter((id) => FAMILY[id]);
        if (!hunts.length) continue;
        const fullRow = (full as {acts: Array<{slug: string; basis: string}>}).acts.find((a) => a.slug === slug);
        // (A catalogue row, read by hand, may name a more particular way than the recipe's.)
        if (fullRow?.basis === "catalogue") continue;
        checked++;
        assert.ok(hunts.some((id) => FAMILY[id].includes(act)), `${slug}: act ${act} does not fit its recipes ${hunts.join(",")}`);
    }
    assert.ok(checked > 40, `checked ${checked}`);
});

test("the choice: an act is played only where it fits the pair, else the generic chase", () => {
    const ctx = (o: Partial<HuntCtx>): HuntCtx => ({slug: "x", plan: "mammal", predatorLength: 0.5, preyLength: 0.1, predatorWater: false, preyWater: false, predatorAerial: false, preyAerial: false, flee: "run", ...o});
    assert.equal(huntChoice(ctx({slug: "domestic-cat"}))?.act, "pounce");
    // A cat on a fish in the water: nothing to pounce on.
    assert.equal(huntChoice(ctx({slug: "domestic-cat", preyWater: true})), null);
    // A heron on a fish: it wades, drawn as a ground hunter (not a stoop).
    assert.deepEqual(huntChoice(ctx({slug: "grey-heron", plan: "bird", predatorLength: 1, preyLength: 0.3, preyWater: true, flee: "swim"})), {act: "wade", kind: "glide"});
    // An osprey on a fish plunges; on a rabbit it stoops.
    assert.equal(huntChoice(ctx({slug: "osprey", plan: "bird", predatorLength: 0.6, preyLength: 0.3, preyWater: true, predatorAerial: true}))?.act, "plunge");
    // (Its generic stoop: no act of its own.)
    assert.equal(huntChoice(ctx({slug: "osprey", plan: "bird", predatorLength: 0.6, preyLength: 0.3, predatorAerial: true})), null);
    // A swallow on a gnat hawks it; on a beetle on the ground it does not.
    assert.equal(huntChoice(ctx({slug: "barn-swallow", plan: "bird", predatorLength: 0.18, preyLength: 0.01, preyAerial: true, predatorAerial: true}))?.act, "hawk");
    assert.notEqual(huntChoice(ctx({slug: "barn-swallow", plan: "bird", predatorLength: 0.18, preyLength: 0.01, predatorAerial: true}))?.act, "hawk");
    // A small bird with no species act picks small prey off the ground; a big one does not.
    assert.equal(huntChoice(ctx({slug: "some-small-bird", plan: "bird", predatorLength: 0.2, preyLength: 0.02}))?.act, "peck");
    assert.equal(huntChoice(ctx({slug: "some-big-bird", plan: "bird", predatorLength: 1.2, preyLength: 0.1})), null);
    // A snake and a fish keep the generic chase.
    assert.equal(huntChoice(ctx({slug: "ball-python", plan: "snake"})), null);
    assert.equal(huntActOf("not-a-species"), null);
});

test("a search is walked in its species' way and still reaches both waypoints", async () => {
    const {searchLeg, searchStyleOf} = await import("@/ark-scene/hunt-search");
    assert.equal(searchStyleOf("domestic-cat"), "creep");
    assert.equal(searchStyleOf("grey-heron"), "wade");
    assert.equal(searchStyleOf("barn-swallow"), "weave");
    assert.equal(searchStyleOf("ball-python"), null);
    for (const style of ["creep", "watch", "wade", "glean", "soar", "weave"] as const) {
        for (const key of ["a:1", "b:2", "c:3"]) {
            const first = searchLeg(style, 0, key, 0.5, true);
            const last = searchLeg(style, 1, key, 0.5, true);
            assert.ok(Math.abs(first.u) < 1e-9 && Math.abs(first.side) < 1e-6, `${style} start`);
            assert.ok(Math.abs(last.u - 1) < 1e-9 && Math.abs(last.side) < 1e-6, `${style} end`);
            let before = 0;
            let widest = 0;
            for (let k = 0; k <= 200; k++) {
                const at = searchLeg(style, k / 200, key, 0.5, true);
                // On: never back; the side never wider than the server's agreement with the scene allows.
                assert.ok(at.u >= before - 1e-9, `${style} goes back at ${k}`);
                before = at.u;
                widest = Math.max(widest, Math.abs(at.side));
            }
            assert.ok(widest <= 4.3 * 2, `${style} reaches ${widest} m aside`);
        }
    }
    // A walker waits for part of the way: it is not moving for a good share of the leg.
    let still = 0;
    for (let k = 0; k < 200; k++) if (!searchLeg("watch", k / 200, "x", 0.2, false).moving) still++;
    assert.ok(still > 100, `a watcher stood ${still} of 200`);
});

test("through the meal's stage: every act gives a stage the scene can frame, with its catch, ending where the meal's script takes over", async () => {
    const {mealStage} = await import("@/ark-scene/acts");
    const kinds: Record<string, "glide" | "swoop" | "dart"> = {pounce: "glide", leap: "glide", jump: "glide", dash: "glide", lunge: "glide", tongue: "glide", web: "glide", wade: "glide", peck: "glide", lurk: "dart", drop: "swoop", hover: "swoop", plunge: "swoop", talon: "swoop", hawk: "swoop"};
    for (const c of CASES) {
        const stage = mealStage(kinds[c.act], c.predator, c.prey, {seed: `stage-${c.act}`, flee: c.flee ?? "run", exact: true, meal: true, hunt: c.act, ...(c.water ? {water: () => true} : {})});
        assert.ok(stage.catchAt && stage.catchAt > 0.3, `${c.act} has no catch`);
        assert.ok(stage.seconds >= stage.catchAt, c.act);
        for (const n of [stage.focus.x, stage.focus.y, stage.focus.z, stage.distance, stage.polar]) assert.ok(Number.isFinite(n), `${c.act} frame`);
        const at = stage.predator(stage.catchAt);
        const prey = stage.prey(stage.catchAt);
        assert.ok(at && Number.isFinite(at.x) && Number.isFinite(prey.x), c.act);
        assert.ok(stage.puffs(0, stage.seconds + 1).length >= 1, `${c.act} has no puff at the catch`);
        // The generic chase is what an unknown act (or none) gives.
        const generic = mealStage(kinds[c.act], c.predator, c.prey, {seed: "g", flee: c.flee ?? "run", exact: true, meal: true});
        assert.ok(generic.catchAt);
    }
});

test("an escape of a hunter with its own way is the same act ending in a miss, and never a catch", async () => {
    const {escapeScript, escapePose} = await import("@/ark-scene/live-escapes");
    const kinds: Record<string, "glide" | "swoop" | "dart"> = {pounce: "glide", leap: "glide", jump: "glide", dash: "glide", lunge: "glide", tongue: "glide", web: "glide", wade: "glide", peck: "glide", lurk: "dart", drop: "swoop", hover: "swoop", plunge: "swoop", talon: "swoop", hawk: "swoop"};
    for (const c of CASES) {
        const script = escapeScript({kind: kinds[c.act], flee: c.flee ?? "run", predator: c.predator, prey: c.prey, seed: `esc-${c.act}`, exact: true, hunt: c.act, ground: () => (c.water ? -0.3 : 0), ...(c.water ? {water: () => true} : {})});
        assert.ok(script.missAt > 0.3 && script.seconds > script.missAt, c.act);
        assert.ok(script.closest >= script.gap * 0.99, `${c.act}: closest ${script.closest.toFixed(3)} under the gap ${script.gap.toFixed(3)}`);
        for (let s = 0; s <= script.seconds; s += 0.25) {
            const p = escapePose(script, "predator", s);
            const q = escapePose(script, "prey", s);
            assert.ok(Number.isFinite(p.x) && Number.isFinite(q.x) && Number.isFinite(p.roll) && Number.isFinite(q.roll), c.act);
        }
    }
});

test("round what is in the way: a wall between the hunter and its prey is gone round, and the act still ends at the prey", () => {
    // A wall across the way, 4 m wide, a few metres short of the prey.
    const blocked = (x: number, z: number) => !(Math.abs(x) < 2 && z > 3.5 && z < 4.5);
    for (const [act, predator, prey, flee] of [["pounce", body(0, 0, 0.5), body(0, 9, 0.08), "run"], ["leap", body(0, 0, 0.7), body(0, 10, 0.12), "run"], ["peck", body(0, 0, 0.25), body(0, 8, 0.02), "run"], ["wade", body(0, 0, 1.0), body(0, 9, 0.3), "swim"]] as const) {
        for (const miss of [false, true]) {
            const input = base(act, predator, prey, {miss, flee, clear: blocked, water: act === "wade" ? () => false : undefined});
            const out = huntRun(input);
            assert.ok(out, `${act} ${miss ? "miss" : "catch"} found no way round`);
            for (const s of out.pred) assert.ok(blocked(s.x, s.z), `${act} ${miss ? "miss" : "catch"} walks through the wall at ${s.x.toFixed(2)}, ${s.z.toFixed(2)}`);
            finite(out);
        }
    }
});

test("the live page plays only the acts whose frames read (decision 456): the others are the generic chase", () => {
    const ctx = (slug: string, plan: string, pl: number, ql: number): HuntCtx => ({slug, plan, predatorLength: pl, preyLength: ql, predatorWater: false, preyWater: false, predatorAerial: false, preyAerial: false, flee: "run" as HuntCtx["flee"]});
    try {
        setAllHuntActs(false);
        assert.deepEqual(Array.from(LIVE_HUNT_ACTS).sort(), ["jump", "pounce"]);
        assert.equal(huntChoice(ctx("domestic-cat", "mammal", 0.5, 0.08))?.act, "pounce");
        assert.equal(huntChoice(ctx("jumping-spider", "arthropod", 0.01, 0.007))?.act, "jump");
        assert.equal(huntChoice(ctx("orb-weaver-spider", "arthropod", 0.02, 0.007)), null);
        assert.equal(huntChoice(ctx("common-kestrel", "bird", 0.35, 0.1)), null);
    } finally {
        setAllHuntActs(true);
    }
});
