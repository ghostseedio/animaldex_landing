import assert from "node:assert/strict";
import {test} from "node:test";
// (First: the held states put back, so their mechanism stays checked; `ark-look-states-held.ts`.)
import "@/lib/ark-look-states-held";
import animalLook from "@/ark-scene/animal-look.json";
import recipes from "@/ark-scene/recipes.json";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {LOOK_ALBEDO, LOOK_FINISH, LOOK_FRAGMENT_DECLARATIONS, LOOK_VERTEX, LOOK_VERTEX_DECLARATIONS} from "@/ark-scene/animal-look-shader";
import {packAntler} from "@/ark-scene/antler-cycle";
import {packYoung} from "@/ark-scene/young-coat";
import {
    type Trigger,
    STATE_STEPS,
    applyLookState,
    lookStateOf,
    lookStateSpecies,
    lookStateUniforms,
    nightSays,
    nightStrength,
    packState,
    regionMask,
    stateSays,
    individualUniform,
    stateSteps,
    stateTarget,
    stepStrength,
    swellPoint,
    toneUniforms,
    type Region,
    type StateContext,
    type Swell
} from "@/ark-scene/look-state";

const ctx = (over: Partial<StateContext> = {}): StateContext => ({month: 7, sex: "male", block: null, alarmed: 0, beat: null, ...over});

test("a look state is only for the species whose own catalogue row tells it, each with its quote and its sentence", () => {
    const all = lookStateSpecies();
    assert.ok(all.length >= 40, `${all.length} species`);
    const models = animalLook.species as Record<string, unknown>;
    for (const [slug, spec] of all) {
        assert.ok(models[slug], `${slug} has a model`);
        assert.ok(spec.night || spec.state, `${slug} has a look`);
        for (const part of [spec.night, spec.state]) {
            if (!part) continue;
            assert.match(part.id, /^[0-9a-f-]{36}$/, `${slug} row id`);
            assert.ok(part.quote.length > 10, `${slug} quote`);
            assert.ok(part.line.length > 10 && /^\{(aAnimal|animals)\}/.test(part.line), `${slug} line: ${part.line}`);
        }
    }
    for (const slug of ["common-house-gecko", "goldfish", "mallard", "green-iguana", "american-bullfrog", "red-deer", "carolina-wolf-spider"]) assert.ok(lookStateOf(slug), slug);
    for (const slug of ["african-lion", "domestic-dog", "plains-zebra", null, undefined]) assert.equal(lookStateOf(slug), null);
});

test("the night: the geckos pale, a crested gecko goes richer, the fishes fade, a wolf spider's eyes glow", () => {
    const pale = lookStateOf("common-house-gecko")!.night!.tone;
    assert.ok((pale.desat ?? 0) > 0 && (pale.gain ?? 1) > 1, "paler: greyer and lighter");
    const crested = lookStateOf("crested-gecko")!.night!.tone;
    assert.ok((crested.desat ?? 0) < 0 && (crested.gain ?? 1) < 1, "its own text says darker and richer at night");
    for (const slug of ["goldfish", "guppy", "siamese-fighting-fish", "black-skirt-tetra", "tiger-barb", "freshwater-angelfish", "neon-tetra"]) assert.ok((lookStateOf(slug)!.night!.tone.desat ?? 0) > 0.2, slug);
    const eyes = lookStateOf("carolina-wolf-spider")!.night!.tone;
    assert.ok((eyes.glow ?? 0) > 0 && eyes.region?.mirror, "a glow on its two eyes");
    const [x, y, z] = (animalLook.species as Record<string, number[]>)["carolina-wolf-spider"].slice(2, 5);
    assert.deepEqual(eyes.region!.c, [x, y, z], "the glow sits on the eyes the look pass marked");
    // The night itself is the island's daylight: none by day, all of it deep in the night (1 → 0.34).
    assert.equal(nightStrength(1), 0);
    assert.equal(nightStrength(0.34), 1);
    assert.ok(nightStrength(0.7) > 0.3 && nightStrength(0.7) < 0.7, "dusk is half");
    assert.equal(nightSays(1), false);
    assert.equal(nightSays(0.34), true);
});

test("the triggers: a season by its months and sex, a display by the block it is in, a cheek by foraging", () => {
    const summer: Trigger = {kind: "season", months: [6, 7, 8], sex: "male"};
    assert.equal(stateTarget(summer, ctx()), 1);
    assert.equal(stateTarget(summer, ctx({month: 11})), 0);
    assert.equal(stateTarget(summer, ctx({sex: "female"})), 0, "only the drakes");
    assert.equal(stateTarget({kind: "season", months: [6]}, ctx({sex: null, month: 6})), 1, "no sex asked: any");
    const call: Trigger = {kind: "blocks", blocks: ["call"], sex: "male"};
    assert.equal(stateTarget(call, ctx({block: "call"})), 1);
    assert.equal(stateTarget(call, ctx({block: "scan"})), 0);
    assert.equal(stateTarget(call, ctx()), 0);
    assert.equal(stateTarget(call, ctx({block: "call", sex: "female"})), 0);
    assert.equal(stateTarget({kind: "alarm"}, ctx({alarmed: 0.8})), 1);
    assert.equal(stateTarget({kind: "alarm"}, ctx({alarmed: 0.2})), 0);
    assert.equal(stateTarget({kind: "forage"}, ctx({beat: "chew"})), 1);
    assert.equal(stateTarget({kind: "forage"}, ctx({block: "pick_up"})), 1);
    assert.equal(stateTarget({kind: "forage"}, ctx({beat: "rest"})), 0);
});

test("a display opens in about a second and closes slower; a season turns over seconds; cheeks stay full a while", () => {
    let k = 0;
    for (let i = 0; i < 60; i++) k = stepStrength("blocks", k, 1, 1 / 60);
    assert.ok(k > 0.95, `open after a second: ${k}`);
    let closing = 1;
    for (let i = 0; i < 60; i++) closing = stepStrength("blocks", closing, 0, 1 / 60);
    assert.ok(closing > 0.2 && closing < 0.5, `still part open: ${closing}`);
    let season = 0;
    for (let i = 0; i < 60; i++) season = stepStrength("season", season, 1, 1 / 60);
    assert.ok(season < 0.15, `a moult is not a blink: ${season}`);
    let cheeks = 1;
    for (let i = 0; i < 60 * 10; i++) cheeks = stepStrength("forage", cheeks, 0, 1 / 60);
    assert.ok(cheeks > 0.7, `ten seconds after the last mouthful the cheeks are still full: ${cheeks}`);
    assert.equal(stepStrength("blocks", 0.4, 1, 0), 0.4);
    assert.equal(stepStrength("blocks", 0.99, 1, 1), 1);
    assert.equal(stateSteps(1), STATE_STEPS);
    assert.equal(stateSteps(0), 0);
    assert.equal(stateSteps(-1), 0);
    assert.equal(stateSays(0.7), true);
    assert.equal(stateSays(0.3), false);
});

test("the strength rides above the young coat and the antlers in arkCoat.y, and leaves them whole", () => {
    const y = packAntler(packYoung(0.4, 9), 15);
    const packed = packState(y, 11);
    assert.equal(Math.floor(packed / 512), 11);
    assert.equal(Math.floor(packed / 32) % 16, 15, "the antlers' code stays");
    assert.equal(Math.floor(packed * 0.5) % 16, 9, "the young coat's steps stay");
    assert.ok(Math.abs(packed - 2 * Math.floor(packed * 0.5) - 0.4) < 1e-6, "the dust stays");
    assert.equal(packState(packed, 3), packed - 512 * 8, "a new strength replaces the old");
    assert.equal(packState(y, 99), y + 512 * STATE_STEPS, "capped");
    // The shader reads the three codes the same way.
    assert.match(LOOK_VERTEX, /mod\(floor\(arkCoat\.y \/ 32\.0 \+ 0\.00001\), 16\.0\)/);
    assert.match(LOOK_VERTEX, /mod\(floor\(arkCoat\.y \/ 512\.0 \+ 0\.00001\), 16\.0\)/);
    assert.match(LOOK_ALBEDO, /mod\(floor\(vArkLookV\.y \/ 32\.0 \+ 0\.00001\), 16\.0\)/);
    assert.match(LOOK_ALBEDO, /mod\(floor\(vArkLookV\.y \/ 512\.0 \+ 0\.00001\), 16\.0\)/);
    assert.match(LOOK_ALBEDO, /mod\(arkYoungAll, 16\.0\)/);
    // Writing it into an instance's arkCoat leaves the other instances alone.
    const values = new Float32Array([0, 0.5, 0, 0.5, 0, 0.5]);
    let flagged = false;
    const attribute = {count: 3, getY: (i: number) => values[i * 2 + 1], setY: (i: number, v: number) => (values[i * 2 + 1] = v), set needsUpdate(v: boolean) { flagged = v; }};
    applyLookState({getAttribute: () => attribute}, 1, 0);
    assert.equal(values[3], 0.5, "no strength: untouched");
    applyLookState({getAttribute: () => attribute}, 1, 6);
    assert.equal(values[3], 0.5 + 512 * 6);
    assert.equal(values[1], 0.5);
    assert.equal(values[5], 0.5);
    assert.ok(flagged);
    applyLookState({getAttribute: () => attribute}, 9, 6);
    assert.equal(values[5], 0.5, "an index past the attribute is ignored");
});

test("the shader carries the swell, the tone and the glow", () => {
    assert.match(LOOK_VERTEX_DECLARATIONS, /uniform vec4 arkSwellA;/);
    assert.match(LOOK_VERTEX_DECLARATIONS, /uniform vec4 arkSwellB;/);
    assert.match(LOOK_VERTEX, /transformed \+= normalize\(normal\) \* arkSwellA\.w/);
    for (const name of ["arkNightA", "arkNightB", "arkNightC", "arkNightD", "arkStateA", "arkStateB", "arkStateC", "arkStateD"]) assert.match(LOOK_FRAGMENT_DECLARATIONS, new RegExp(`uniform vec4 ${name};`));
    assert.match(LOOK_ALBEDO, /arkStateTone\(diffuseColor\.rgb, arkNightA, arkNightB/);
    assert.match(LOOK_ALBEDO, /arkStateTone\(diffuseColor\.rgb, arkStateA, arkStateB/);
    assert.match(LOOK_FINISH, /outgoingLight \+= arkGlowColour \* arkGlowAmount;/);
    // A tone is never drawn on the eyes unless it glows (the eyeshine is on the eyes).
    assert.match(LOOK_ALBEDO, /arkNightB\.w > 0\.0 \? 1\.0 : arkLsEye/);
});

test("the uniforms: all zero for a species without a look state, the tone and the swell for one with", () => {
    const none = lookStateUniforms("african-lion");
    assert.equal(none.arkNightB.value[2], 0);
    assert.equal(none.arkStateB.value[2], 0);
    assert.equal(none.arkSwellA.value[3], 0);
    const gecko = lookStateUniforms("common-house-gecko");
    assert.equal(gecko.arkNightB.value[2], 1);
    assert.equal(gecko.arkStateB.value[2], 0, "it has no state");
    assert.equal(gecko.arkNightD.value[3], 0, "the whole body");
    const anole = lookStateUniforms("green-anole");
    assert.equal(anole.arkStateB.value[2], 1);
    assert.equal(anole.arkStateD.value[3], 1, "a region");
    assert.ok(anole.arkSwellA.value[3] > 0);
    assert.equal(anole.arkStateA.value.length, 4);
    // A tone glows only if it says so (B.w): the geckos and the dewlaps do not, the wolf spider's eyes do.
    assert.equal(gecko.arkNightB.value[3], 0);
    assert.equal(anole.arkStateB.value[3], 0);
    assert.ok(lookStateUniforms("carolina-wolf-spider").arkNightB.value[3] > 1);
    assert.equal(lookStateUniforms("african-lion").arkNightB.value[3], 0);
    // Colours reach the shader linear: sRGB mid-grey 0.5 is about 0.214.
    assert.ok(Math.abs(toneUniforms({colour: [0.5, 0.5, 0.5], mix: 1}).A[0] - 0.214) < 0.001);
});

test("a swell pushes the vertices of its region out along their normals and nothing else", () => {
    const swell: Swell = {region: {c: [0, 0.1, 0.4], r: [0.1, 0.05, 0.1]}, push: 0.06};
    const down: [number, number, number] = [0, -1, 0];
    assert.deepEqual(swellPoint([0, 0.1, 0.4], down, swell, 0), [0, 0.1, 0.4], "none at strength 0");
    const full = swellPoint([0, 0.1, 0.4], down, swell, 1);
    assert.ok(Math.abs(full[1] - (0.1 - 0.06)) < 1e-9, "the whole push at the centre");
    const half = swellPoint([0, 0.1, 0.4], down, swell, 0.5);
    assert.ok(Math.abs(half[1] - (0.1 - 0.03)) < 1e-9);
    assert.deepEqual(swellPoint([0, 0.1, 0.1], down, swell, 1), [0, 0.1, 0.1], "a vertex outside is not moved");
    const edge = swellPoint([0, 0.1, 0.4 + 0.08], down, swell, 1);
    assert.ok(edge[1] < 0.1 && edge[1] > 0.1 - 0.06, "smooth toward the edge");
    const sides: Region = {c: [0.1, 0.08, 0.4], r: [0.05, 0.05, 0.07], mirror: true};
    const cheek: Swell = {region: sides, push: 0.05};
    const right = swellPoint([0.1, 0.08, 0.4], [1, 0, 0], cheek, 1);
    const left = swellPoint([-0.1, 0.08, 0.4], [-1, 0, 0], cheek, 1);
    assert.ok(Math.abs(right[0] - 0.15) < 1e-9 && Math.abs(left[0] + 0.15) < 1e-9, "both cheeks, each out to its own side");
    assert.equal(regionMask([0, 0, 0], null), 1, "no region: the whole body");
    assert.equal(regionMask([0.1, 0.08, 0.4], sides), 1);
    assert.equal(regionMask([0, 0, -0.4], sides), 0);
});

test("the seasons are read from the row's own season or the species' stored mating months, never made up", () => {
    const months = (slug: string) => (lookStateOf(slug)!.state!.trigger as {months: number[]}).months;
    assert.deepEqual(months("mallard"), [6, 7, 8], "the row says summer");
    assert.deepEqual(months("red-deer"), [9, 10, 11], "the row says autumn; its stored rut agrees");
    assert.deepEqual(months("white-tailed-deer"), [9, 10, 11]);
    assert.deepEqual(months("two-spotted-spider-mite"), [12, 1, 2]);
    const stored = (slug: string) => (((recipes.species as Record<string, string>)[slug] ?? "").split("|")[2] ?? "").split("").map((c) => "abcdefghijkl".indexOf(c) + 1);
    assert.deepEqual(months("black-headed-gull"), stored("black-headed-gull"));
    assert.deepEqual(months("great-crested-grebe"), stored("great-crested-grebe"));
    assert.deepEqual(months("southeastern-five-lined-skink"), stored("southeastern-five-lined-skink"));
    assert.deepEqual(months("mandarin-duck"), [6, 7, 8], "the three months after its stored display season (March to May)");
    // A species whose row says "the breeding season" but has no stored months is not drawn.
    for (const slug of ["tiger-barb", "nile-tilapia", "black-spiny-tailed-iguana", "common-sun-skink", "oriental-garden-lizard-breeding"]) assert.ok(!lookStateOf(slug)?.state || Array.isArray((lookStateOf(slug)!.state!.trigger as {blocks?: string[]}).blocks), slug);
});

test("a display is drawn only for a species that has an act with the block it is tied to", () => {
    for (const [slug, spec] of lookStateSpecies()) {
        const trigger = spec.state?.trigger;
        if (trigger?.kind !== "blocks") continue;
        const row = (recipes.species as Record<string, string>)[slug];
        assert.ok(row, `${slug} has recipes`);
        const own = row.split("|")[0].split(",").filter(Boolean).map((r) => r.slice(0, r.lastIndexOf(".")));
        const blocks = own.flatMap((id) => [...(TEMPLATES[id]?.steps ?? []), ...(TEMPLATES[id]?.tail ?? [])].map((step) => step.b));
        assert.ok(trigger.blocks.some((b) => blocks.includes(b)), `${slug} has no recipe that uses ${trigger.blocks.join("/")} (its recipes: ${own.join(", ")})`);
    }
});

test("a firefly's light organ flashes after dusk, a male on his own beat; never by day", () => {
    const flash = lookStateOf("common-eastern-firefly")!.state!;
    assert.equal(flash.trigger.kind, "flash");
    assert.ok((flash.tone?.glow ?? 0) > 1 && flash.tone?.region, "a glow on the abdomen's tip");
    const trigger = flash.trigger as Extract<typeof flash.trigger, {kind: "flash"}>;
    assert.equal(trigger.sex, "male");
    const at = (clock: number, over: Partial<StateContext> = {}) => stateTarget(trigger, ctx({sex: "male", daylight: 0.4, clock, seed: 0.3, ...over}));
    let on = 0;
    let total = 0;
    for (let t = 0; t < trigger.period * 20; t += 0.05) {
        total++;
        on += at(t);
    }
    assert.ok(on / total > 0.05 && on / total < 0.15, `lit a small share of the time: ${on / total}`);
    assert.equal(at(1, {daylight: 1}), 0, "not by day");
    assert.equal(at(1, {sex: "female"}), 0, "only the males");
    // Each on his own beat.
    const beats = new Set(Array.from({length: 10}, (_, i) => Array.from({length: 80}, (_, k) => stateTarget(trigger, ctx({sex: "male", daylight: 0.4, clock: k * 0.05, seed: i / 10}))).join("")));
    assert.ok(beats.size >= 5, "not in step");
    // A flash is quick: up in a tenth of a second, down in a quarter.
    let k = 0;
    for (let i = 0; i < 6; i++) k = stepStrength("flash", k, 1, 1 / 60);
    assert.ok(k > 0.8, `up fast: ${k}`);
    for (let i = 0; i < 15; i++) k = stepStrength("flash", k, 0, 1 / 60);
    assert.ok(k < 0.2, `down quick: ${k}`);
});

test("each koi and each male guppy its own pattern: the uniform, the shader and the seed it reads", () => {
    const koi = lookStateOf("koi")!.state!;
    assert.equal(koi.individual?.kind, "patches");
    assert.equal(stateTarget(koi.trigger, ctx({month: 3, sex: null})), 1, "all year, either sex");
    const guppy = lookStateOf("guppy")!.state!;
    assert.equal(guppy.individual?.kind, "spots");
    assert.equal(stateTarget(guppy.trigger, ctx({month: 3, sex: "male"})), 1);
    assert.equal(stateTarget(guppy.trigger, ctx({month: 3, sex: "female"})), 0, "the row says every male");
    assert.deepEqual(individualUniform(null), [0, 1, 0, 0]);
    assert.deepEqual(individualUniform(koi.individual), [1, koi.individual!.scale, koi.individual!.dark, koi.individual!.light]);
    assert.equal(lookStateUniforms("koi").arkIndA.value[0], 1);
    assert.equal(lookStateUniforms("african-lion").arkIndA.value[0], 0);
    assert.match(LOOK_FRAGMENT_DECLARATIONS, /uniform vec4 arkIndA;/);
    assert.match(LOOK_ALBEDO, /vArkVary\.w/, "seeded by the animal's own pattern seed (ark-variation.ts)");
});
