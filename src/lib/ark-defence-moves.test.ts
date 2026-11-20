import assert from "node:assert/strict";
import test from "node:test";
import full from "../../data/ark/defence-moves.json";
import table from "@/ark-scene/defence-moves.json";
import {behaviourProfile, hasBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {DEFENCE_ACTS, DEFENCE_KIND, DISTURB_EVERY, DISTURB_FOR, FLASH_COLOURS, HOLD, TAIL_REGROW, TAIL_TWITCH, THUMP_BOUT, defenceActOf, defenceMoveOf, disturbedNow, holdsNow, defencePack, defenceSaid, defenceSpecies, holdsItsGround, newDefenceState, packDefence, predatorBeside, stepDefence, unpackDefence, type DefenceSpec} from "@/ark-scene/defence-moves";
import {canEat, intelProfile} from "@/ark-scene/intelligence-profile";
import {ReactiveLayer, type ReactiveInput, type ReactiveWorld} from "@/ark-scene/reactive";
import {packSleep} from "@/ark-scene/sleep";

const FULL = full as unknown as {species: Array<{slug: string; name: string; move: string; line: string; quote: string; uses: string; behaviour: string}>; skipped: string[]};

test("the table: every species' move comes from its own catalogue row, with the row's sentence", () => {
    const species = defenceSpecies();
    assert.ok(species.length >= 20, `${species.length} species`);
    assert.equal(species.length, FULL.species.length, "the scene's table and the full one are the same build");
    for (const row of FULL.species) {
        const spec = defenceMoveOf(row.slug);
        assert.ok(spec, row.slug);
        assert.equal(spec.move, row.move);
        assert.equal(spec.line, row.line);
        assert.ok(row.quote.length > 10, `${row.slug}: the species' stored text is kept beside it`);
        assert.ok(/^\{(aAnimal|animals)\} /.test(spec.line), `${row.slug}: a log sentence`);
        // (The sentences the scene cannot show are left out by the build.)
        assert.ok(!/\b(grabbed|seized|caterpillar|larva)\b/i.test(spec.line), `${row.slug}: ${spec.line}`);
        assert.ok(hasBehaviourProfile(row.slug), `${row.slug} is a species of the scene`);
    }
    assert.equal(Object.keys((table as unknown as {species: object}).species).length, species.length);
    // The owner's examples.
    assert.equal(defenceMoveOf("european-hedgehog")?.move, "curl");
    assert.equal(defenceMoveOf("sunda-pangolin")?.move, "curl");
    assert.equal(defenceMoveOf("pill-millipede")?.move, "curl");
    assert.equal(defenceMoveOf("ball-python")?.move, "coil");
    assert.equal(defenceMoveOf("greek-tortoise")?.move, "shell");
    assert.equal(defenceMoveOf("grovesnail")?.move, "shell");
    assert.equal(defenceMoveOf("stars-and-stripes-pufferfish")?.move, "puff");
    assert.equal(defenceMoveOf("southern-toad")?.move, "puff");
    // No row, no move: a courtship display is not a defence (the bullfrog's vocal sac), nor a caterpillar's curl an adult moth's.
    assert.equal(defenceMoveOf("american-bullfrog"), null);
    assert.equal(defenceMoveOf("isabella-tiger-moth"), null);
    assert.equal(defenceMoveOf("plains-zebra"), null);
    assert.equal(defenceMoveOf(null), null);
    assert.equal(holdsItsGround("european-hedgehog"), true);
    assert.equal(holdsItsGround("plains-zebra"), false);
});

test("a move made on the spot: made fast while the predator is beside it, held, then undone slowly", () => {
    const spec = defenceMoveOf("pill-millipede")!;
    const state = newDefenceState();
    const step = (action: string | null, seconds: number, alarmed = 0) => {
        for (let i = 0; i < seconds * 30; i++) stepDefence(state, spec, {action, alarmed, pressed: false}, 1 / 30);
    };
    step("scan", 2);
    assert.equal(state.amount, 0);
    assert.equal(defenceSaid(state, spec, "a"), null);
    step("withdraw", 1);
    assert.equal(state.amount, 1, "a pill millipede is closed within a second");
    assert.equal(state.episode, 1);
    assert.equal(defenceSaid(state, spec, "a"), "defence:a:1");
    step("withdraw", 5);
    assert.equal(state.episode, 1, "one move, one sentence");
    // The predator gone: it stays closed a while, then opens slowly.
    step("scan", HOLD - 0.5);
    assert.equal(state.amount, 1, "it stays closed");
    step("scan", 1.5);
    assert.ok(state.amount < 1 && state.amount > 0.4, `opening slowly (${state.amount.toFixed(2)})`);
    step("scan", 6);
    assert.equal(state.amount, 0);
    assert.equal(defenceSaid(state, spec, "a"), null);
    step("withdraw", 1);
    assert.equal(state.episode, 2, "the next time is another move");
    // Still alarmed after it (the layer's recover): closed as long as it is.
    step("recover", 10, 0.8);
    assert.equal(state.amount, 1);
    // No time, no change (reduced motion, a paused clock).
    stepDefence(state, spec, {action: "scan", alarmed: 0, pressed: false}, 0);
    assert.equal(state.amount, 1);
});

test("the pack: a move is a negative integer a float holds exactly, never mistaken for a sleep", () => {
    for (const kind of Object.values(DEFENCE_KIND)) {
        for (const amount of [1 / 255, 0.25, 0.5, 1]) {
            for (const aux of [0, 1, 7, 255]) {
                const packed = packDefence(kind, amount, aux);
                assert.ok(packed < 0 && Number.isInteger(packed) && -packed < 2 ** 24);
                assert.equal(Math.fround(packed), packed);
                const [k, a, x] = unpackDefence(packed);
                assert.equal(k, kind);
                assert.equal(x, aux);
                assert.ok(Math.abs(a - amount) < 1 / 255);
            }
        }
    }
    // Nothing to draw: 0, and the caller writes its sleep as before.
    assert.equal(packDefence(DEFENCE_KIND.curl, 0, 0), 0);
    assert.deepEqual(unpackDefence(0), [0, 0, 0]);
    // A sleep is positive (or 0 awake with no curl is 31·4096): the shader's two readers never both fire.
    assert.ok(packSleep(0, 0, 0, 0) > 0);
    assert.deepEqual(unpackDefence(packSleep(1, 0.5, 0, 0.3)), [0, 0, 0]);
});

test("the pack per move and body: a turtle's shell over it, a snail's behind; by the MODEL's plan", () => {
    const made = {...newDefenceState(), amount: 1, on: true};
    const kindOf = (slug: string, plan: string) => unpackDefence(defencePack(made, defenceMoveOf(slug)!, plan));
    assert.deepEqual(kindOf("european-hedgehog", "mammal"), [DEFENCE_KIND.curl, 1, 0]);
    assert.deepEqual(kindOf("ball-python", "snake"), [DEFENCE_KIND.coil, 1, 0]);
    assert.deepEqual(kindOf("greek-tortoise", "turtle"), [DEFENCE_KIND.shell, 1, 0]);
    assert.deepEqual(kindOf("grovesnail", "arthropod"), [DEFENCE_KIND.shell, 1, 1]);
    // A pufferfish swells all round in the water, a toad from the ground up.
    assert.deepEqual(kindOf("stars-and-stripes-pufferfish", "fish"), [DEFENCE_KIND.puff, 1, 1]);
    assert.deepEqual(kindOf("southern-toad", "frog"), [DEFENCE_KIND.puff, 1, 0]);
    assert.equal(defencePack(newDefenceState(), defenceMoveOf("greek-tortoise")!, "turtle"), 0, "about its day: nothing");
});

test("a tail-dropper: sheds once when the predator is very close, the shed tail twitches behind it, the stump grows back", () => {
    const spec: DefenceSpec = {move: "tail", line: "{aAnimal} is dropping its tail to get away", colour: null};
    const state = newDefenceState();
    const frame = (pressed: boolean, moved = 0, dt = 1 / 30) => stepDefence(state, spec, {action: pressed ? "flee" : "scan", alarmed: pressed ? 1 : 0, pressed, moved}, dt);
    frame(false);
    assert.equal(defencePack(state, spec, "reptile"), 0);
    frame(true);
    assert.equal(state.tail, 1);
    assert.equal(state.episode, 1);
    assert.equal(defenceSaid(state, spec, "a"), "defence:a:1");
    for (let i = 0; i < 30; i++) frame(true, 0.05);
    assert.equal(state.episode, 1, "it has only one tail to shed");
    let [kind, amount, aux] = unpackDefence(defencePack(state, spec, "reptile"));
    assert.equal(kind, DEFENCE_KIND.tail);
    assert.ok(aux >= 1, "the shed tail is drawn");
    assert.ok(Math.abs(amount - 1.5 / 4) < 0.02, `left behind as it runs (${amount.toFixed(2)})`);
    for (let i = 0; i < (TAIL_TWITCH + 1) * 30; i++) frame(false);
    assert.equal(state.shed, -1);
    assert.equal(defenceSaid(state, spec, "a"), null);
    [kind, amount, aux] = unpackDefence(defencePack(state, spec, "reptile"));
    assert.equal(aux, 0, "only the stump now");
    assert.ok(amount > 0.99);
    // Growing back over the drawing span, and no second drop until it has.
    frame(false, 0, TAIL_REGROW / 2);
    assert.ok(Math.abs(state.tail - 0.5) < 0.01);
    frame(true);
    assert.equal(state.episode, 1);
    frame(false, 0, TAIL_REGROW);
    assert.equal(state.tail, 0);
    assert.equal(defencePack(state, spec, "reptile"), 0, "whole again");
    frame(true);
    assert.equal(state.episode, 2);
});

test("the flash colours the shader lists are the ones the table names", () => {
    // (A thumper's flagged tail is white, though its row names the colour only in the thump's sentence.)
    const named = new Set(["#f2efe8", ...defenceSpecies().map(([, s]) => s.colour).filter(Boolean)]);
    assert.deepEqual(new Set(FLASH_COLOURS), named);
    for (const hex of FLASH_COLOURS) assert.ok(/^#[0-9a-f]{6}$/.test(hex));
});

// MARK: With the reactive layer

function animal(id: string, slug: string, x: number, z: number, extra: Partial<ReactiveInput> = {}): ReactiveInput {
    const b = behaviourProfile(slug);
    return {id, slug, plan: intelProfile(slug).plan, length: 0.25, size: b.size, speed: b.speed, dominance: b.dominance, social: b.social, diet: b.diet, intel: intelProfile(slug), asleep: false, acting: false, ...extra, shared: {x, y: 0, z, yaw: 0, moving: false, aloft: false, doing: "forage"}};
}
const world = (now: number): ReactiveWorld => ({now, dt: 1 / 30, hours: 10, night: 0, weather: {rain: 0, wind: 0.2, windDirection: 0, fog: 0, storm: 0}, camera: {x: 0, y: 2, z: -30}});
/** A predator of it by the food links, not one that lives in a burrow by day. */
const PREDATORS: Record<string, string> = {"european-hedgehog": "amur-leopard", "giant-african-millipede": "cane-toad", "eastern-box-turtle": "bobcat", "european-pond-terrapin": "bobcat", "malayan-box-turtle": "bobcat"};

test("the species reach their move: with a predator beside it each stays and withdraws, whatever its generated defence list says", () => {
    for (const [slug, predator] of Object.entries(PREDATORS)) {
        const me = intelProfile(slug);
        const hunter = intelProfile(predator);
        assert.ok(canEat(hunter, me, behaviourProfile(predator).size, behaviourProfile(slug).size), `${predator} eats ${slug}`);
        const run = (holds: boolean) => {
            const layer = new ReactiveLayer({tier: "high"});
            const inputs = [animal("a", slug, 0, 0, {holds}), animal("p", predator, 0.4, 0, {length: 1})];
            const actions = new Set<string>();
            let moved = 0;
            for (let k = 0; k < 6 * 30; k++) {
                const out = layer.step(inputs, world(1000 + k / 30)).get("a")!;
                actions.add(out.action);
                moved = Math.max(moved, Math.hypot(out.dx, out.dz));
            }
            return {actions, moved};
        };
        const held = run(true);
        assert.ok(held.actions.has("withdraw"), `${slug} withdraws (${Array.from(held.actions).join(", ")})`);
        assert.ok(!held.actions.has("flee") && held.moved < 0.3, `${slug} stays where it is`);
    }
    // The data fix this is for: these lists never led to a withdraw on their own (no armour first).
    assert.ok(!intelProfile("eastern-box-turtle").defence.includes("armour"));
    assert.ok(!intelProfile("pill-millipede").defence.includes("armour"));
    const layer = new ReactiveLayer({tier: "high"});
    const inputs = [animal("a", "eastern-box-turtle", 0, 0), animal("p", "bobcat", 0.4, 0, {length: 1})];
    const without = new Set<string>();
    for (let k = 0; k < 6 * 30; k++) without.add(layer.step(inputs, world(1000 + k / 30)).get("a")!.action);
    assert.ok(!without.has("withdraw"), "without the species' own move a box turtle only ran");
});

test("pressed: the layer says when the predator is very close (a tail-dropper's cue), not at a distance", () => {
    const layer = new ReactiveLayer({tier: "high"});
    const far = [animal("a", "common-wall-lizard", 0, 0), animal("p", "bobcat", 30, 0, {length: 1})];
    for (let k = 0; k < 90; k++) assert.ok(!layer.step(far, world(1000 + k / 30)).get("a")!.pressed);
    const near = [animal("a", "common-wall-lizard", 0, 0), animal("p", "bobcat", 0.3, 0, {length: 1})];
    let pressed = false;
    for (let k = 0; k < 90; k++) pressed ||= Boolean(layer.step(near, world(1010 + k / 30)).get("a")!.pressed);
    assert.ok(pressed);
});

test("a small animal at its microhabitat: a predator beside it by the food links, not a sleeping one, not one in the air", () => {
    const toad = (x: number, extra: Partial<ReactiveInput> = {}) => animal("p", "common-frog", x, 0, extra);
    assert.ok(canEat(intelProfile("common-frog"), intelProfile("pill-millipede"), behaviourProfile("common-frog").size, behaviourProfile("pill-millipede").size));
    const flight = intelProfile("pill-millipede").flight;
    assert.equal(predatorBeside("pill-millipede", 0, 0, []), 0);
    assert.equal(predatorBeside("pill-millipede", 0, 0, [toad(flight * 3)]), 0);
    assert.equal(predatorBeside("pill-millipede", 0, 0, [toad(flight * 0.8)]), 1);
    assert.equal(predatorBeside("pill-millipede", 0, 0, [toad(flight * 0.2)]), 2);
    assert.equal(predatorBeside("pill-millipede", 0, 0, [toad(flight * 0.2, {asleep: true})]), 0);
    const flying = toad(flight * 0.2);
    flying.shared.aloft = true;
    assert.equal(predatorBeside("pill-millipede", 0, 0, [flying]), 0);
    // Not what cannot eat it.
    assert.equal(predatorBeside("pill-millipede", 0, 0, [animal("z", "plains-zebra", 0.1, 0)]), 0);
});

// MARK: SIG-DEFENCE (P5 M rows)

test("SIG-DEFENCE: the new moves come from their rows, with a stable act name and the Power mechanisms they play for", () => {
    assert.equal(defenceMoveOf("carolina-wolf-spider")?.move, "rear");
    assert.equal(defenceMoveOf("carolina-wolf-spider")?.cornered, true, "its row: \"cornered, rearing up\"");
    assert.equal(defenceMoveOf("shore-crab")?.cornered, undefined, "its row: facing an attacker, not cornered");
    assert.equal(defenceMoveOf("daddy-long-legs-spider")?.move, "blur");
    assert.equal(defenceMoveOf("domestic-rabbit")?.move, "thump");
    assert.equal(defenceMoveOf("domestic-rabbit")?.flag, undefined, "its model has no tail, and its row no flag");
    assert.equal(defenceMoveOf("european-rabbit")?.flag, true);
    assert.equal(defenceMoveOf("eastern-cottontail")?.move, "flag");
    assert.equal(defenceMoveOf("white-tailed-deer")?.fore, true);
    assert.equal(defenceMoveOf("white-tailed-deer")?.disturbance, true);
    assert.equal(defenceMoveOf("leaf-eating-slug")?.move, "flat");
    assert.equal(defenceMoveOf("common-house-spider")?.move, "tuck");
    assert.equal(defenceMoveOf("central-bearded-dragon")?.move, "beard");
    assert.equal(defenceMoveOf("amazon-sailfin-catfish")?.move, "spines");
    assert.equal(defenceMoveOf("common-house-gecko")?.move, "tail", "its model carries a tail");
    // A sentence naming a sex the log does not check is left out (the wasp spider's "female").
    assert.equal(defenceMoveOf("wasp-spider"), null);
    const names = new Set<string>();
    for (const [move, act] of Object.entries(DEFENCE_ACTS)) {
        assert.ok(/^defence\.[a-z_]+$/.test(act.name), move);
        assert.ok(!names.has(act.name));
        names.add(act.name);
        assert.ok(act.mechanisms.length > 0);
        for (const m of act.mechanisms) assert.ok(["camouflage", "hiding", "armour", "warning", "speed", "group", "vigilance", "climb", "mimicry"].includes(m), m);
    }
    assert.deepEqual(defenceActOf("european-hedgehog"), {name: "defence.curl", mechanisms: ["armour"], line: defenceMoveOf("european-hedgehog")!.line});
    assert.equal(defenceActOf("plains-zebra"), null);
});

test("SIG-DEFENCE: holding its ground: on the spot at a predator close, a rearer only when cornered, a thumper while it thumps", () => {
    assert.equal(holdsNow("daddy-long-legs-spider", null), true);
    assert.equal(holdsNow("carolina-wolf-spider", null), "cornered");
    assert.equal(holdsNow("eastern-cottontail", null), false);
    assert.equal(holdsNow("common-house-gecko", null), false);
    assert.equal(holdsNow("plains-zebra", null), false);
    const state = newDefenceState();
    assert.equal(holdsNow("european-rabbit", state), false);
    stepDefence(state, defenceMoveOf("european-rabbit")!, {action: "alert", alarmed: 1, pressed: false}, 0.1);
    assert.equal(holdsNow("european-rabbit", state), true, "it stays to thump");
});

test("SIG-DEFENCE: a thump: one bout when it takes fright, then (a European rabbit) the white tail up as it runs; again only once calm", () => {
    const spec = defenceMoveOf("european-rabbit")!;
    const state = newDefenceState();
    const step = (action: string, seconds: number) => {
        for (let i = 0; i < seconds * 30; i++) stepDefence(state, spec, {action, alarmed: action === "scan" ? 0 : 1, pressed: false}, 1 / 30);
    };
    step("scan", 1);
    assert.equal(defencePack(state, spec, "mammal"), 0);
    step("alert", 0.5);
    assert.equal(state.episode, 1);
    assert.deepEqual(unpackDefence(defencePack(state, spec, "mammal")).slice(0, 1), [DEFENCE_KIND.thump]);
    assert.equal(defenceSaid(state, spec, "r"), "defence:r:1");
    step("alert", THUMP_BOUT);
    step("flee", 1);
    const [kind, amount, aux] = unpackDefence(defencePack(state, spec, "mammal"));
    assert.equal(kind, DEFENCE_KIND.flag, "running, its tail flagged");
    assert.ok(amount > 0.99);
    assert.equal(FLASH_COLOURS[aux - 1], "#f2efe8", "white");
    step("flee", 5);
    assert.equal(state.episode, 1, "one fright, one bout");
    step("scan", HOLD + 2);
    assert.equal(defencePack(state, spec, "mammal"), 0);
    step("alert", 0.2);
    assert.equal(state.episode, 2);
    // A domestic rabbit thumps and does not flag (no row, no tail).
    const plain = defenceMoveOf("domestic-rabbit")!;
    const other = newDefenceState();
    for (let i = 0; i < 30 * 6; i++) stepDefence(other, plain, {action: i < 90 ? "alert" : "flee", alarmed: 1, pressed: false}, 1 / 30);
    assert.equal(defencePack(other, plain, "mammal"), 0);
});

test("SIG-DEFENCE: a deer's stamp at a disturbance the day's schedule gives: about one short bout in twenty minutes, the same for every viewer", () => {
    let on = 0;
    let starts = 0;
    let was = false;
    const hours = 24;
    for (let t = 0; t < hours * 3600; t++) {
        const now = disturbedNow("deer-1", DISTURB_EVERY * 1_491_667 + t);
        if (now) on++;
        if (now && !was) starts++;
        was = now;
    }
    assert.equal(starts, (hours * 3600) / DISTURB_EVERY);
    assert.equal(on, starts * DISTURB_FOR);
    assert.equal(disturbedNow("deer-1", 1_790_000_123), disturbedNow("deer-1", 1_790_000_123));
    const spec = defenceMoveOf("white-tailed-deer")!;
    const state = newDefenceState();
    stepDefence(state, spec, {action: "scan", alarmed: 0, pressed: false, disturbed: true}, 0.5);
    const [kind, , aux] = unpackDefence(defencePack(state, spec, "mammal"));
    assert.equal(kind, DEFENCE_KIND.thump);
    assert.equal(aux, 1, "a forefoot");
});

test("SIG-DEFENCE: the new moves pack to their own kinds", () => {
    const made = {...newDefenceState(), amount: 1, on: true, raised: 1};
    const kindOf = (slug: string, plan: string) => unpackDefence(defencePack(made, defenceMoveOf(slug)!, plan));
    assert.deepEqual(kindOf("carolina-wolf-spider", "arthropod"), [DEFENCE_KIND.rear, 1, 0]);
    assert.deepEqual(kindOf("southern-tamandua", "mammal"), [DEFENCE_KIND.rear, 1, 1]);
    assert.deepEqual(kindOf("daddy-long-legs-spider", "arthropod"), [DEFENCE_KIND.blur, 1, 0]);
    assert.deepEqual(kindOf("silver-argiope", "arthropod"), [DEFENCE_KIND.blur, 1, 1]);
    assert.deepEqual(kindOf("leaf-eating-slug", "slow_invertebrate"), [DEFENCE_KIND.flat, 1, 0]);
    assert.deepEqual(kindOf("common-house-spider", "arthropod"), [DEFENCE_KIND.tuck, 1, 0]);
    assert.equal(kindOf("central-bearded-dragon", "reptile")[0], DEFENCE_KIND.beard);
    assert.deepEqual(kindOf("walking-catfish", "fish"), [DEFENCE_KIND.spines, 1, 1]);
    assert.deepEqual(kindOf("amazon-sailfin-catfish", "fish"), [DEFENCE_KIND.spines, 1, 0]);
    // (Every kind is clear of the water shake's 10 and 11.)
    for (const k of Object.values(DEFENCE_KIND) as number[]) assert.ok(k !== 10 && k !== 11);
});

test("SIG-DEFENCE: a wolf spider rears when cornered: it runs from a predator close, and rears at one very close", () => {
    const slug = "carolina-wolf-spider";
    const flight = intelProfile(slug).flight;
    const run = (gap: number) => {
        const layer = new ReactiveLayer({tier: "high"});
        const inputs = [animal("a", slug, 0, 0, {holds: "cornered"}), animal("p", "american-toad", gap, 0, {length: 0.1})];
        const actions = new Set<string>();
        for (let k = 0; k < 4 * 30; k++) actions.add(layer.step(inputs, world(1000 + k / 30)).get("a")!.action);
        return actions;
    };
    assert.ok(run(flight * 0.2).has("withdraw"), "very close: it stands and rears");
    assert.ok(!run(flight * 0.8).has("withdraw"), "close: it runs");
});
