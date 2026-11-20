/**
 * Defence moves (3.3 batch, lane A; owner 2026-11-16): when a predator comes close, a species defends itself the way
 * its own stored text says, instead of only freezing or running. Five moves, each given only to the species whose
 * catalogue row says it (`defence-moves.json`, built by `scripts/ark-defence-moves.mts` from AnimalDex
 * docs/ark/signature-behaviours.json, never edited by hand):
 *   - curl: a hedgehog, a pangolin, a pill millipede rolls into a ball; a millipede or a ball python coils flat;
 *   - shell: a tortoise, a terrapin, a snail, a hermit crab pulls its head and limbs into its shell;
 *   - puff: a pufferfish, a toad, a cornered monitor swells;
 *   - flash: a moth or a grasshopper shows the colour it kept hidden on its wings;
 *   - tail: a lizard or a salamander drops its tail, runs, and the tail grows back.
 * SIG-DEFENCE (2026-11-20, P5 of AnimalDex docs/ark/behaviours-plan.md, the catalogue's M rows), on the same rails:
 *   - rear: a wolf spider, a jumping spider, a crab, a scorpion, a crayfish rears up, front raised (some only when
 *     cornered, as their rows say); a tamandua stands upright;
 *   - blur: a daddy-long-legs whirls its body, an orb weaver pumps its web, until the outline blurs;
 *   - thump: a rabbit or a wallaby thumps its hind feet (then runs; the European rabbit flags its white tail as it
 *     goes); a white-tailed deer stamps a forefoot, at a disturbance the day's schedule gives now and then;
 *   - flag: a cottontail runs with its white tail raised;
 *   - flat: a slug contracts into a stiff, flat oval;
 *   - tuck: a house spider, a widow, a carpet beetle pulls its legs in and keeps still;
 *   - beard: a bearded dragon puffs out its beard and it darkens;
 *   - spines: an armoured catfish locks its fin spines out.
 * Each move is also an act with a stable name (`DEFENCE_ACTS`, "defence.<move>") and the earned-Power mechanisms it can
 * play for (AnimalDex decision 420's classes, `data/ark/power-mechanisms.json` on the ark-powers-visible lane).
 *
 * Viewer-local and visual only, like the reactive layer that sets it off (`reactive.ts`: the action `withdraw` for
 * the moves made on the spot, `pressed` for the tail): nothing here decides a catch or an escape, and every move
 * eases back to the shared schedule's animal once it calms. A dropped tail is kept for that animal in this viewer's
 * session and grows back over `TAIL_REGROW` seconds of the world's clock: a drawing span (the catalogue gives no
 * rate), long enough that the animal is seen without its tail for a while. Another viewer who was not there sees the
 * tail whole: the drop is a reaction, and reactions are local (rule 2 of the batch's brief).
 *
 * Drawn by the instance shader with no new attribute and no new draw call: the move rides in `arkInstance.w`, where
 * the sleep is packed (`sleep.ts` packSleep, a positive integer); a move is a NEGATIVE integer (`packDefence`), which
 * every existing reader takes for "awake". An animal mid-move is awake (the reactive layer woke it); a sleeping one
 * with a regrowing tail shows its tail whole while it sleeps (its sleep needs the slot), which is the one seam.
 *
 * Pure apart from the state it keeps per animal: the same frames give the same move (the tests rely on it).
 */

import table from "@/ark-scene/defence-moves.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {canEat, intelProfile, type ArkIntelProfile} from "@/ark-scene/intelligence-profile";

export type DefenceMove = "curl" | "coil" | "shell" | "puff" | "tail" | "flash" | "rear" | "blur" | "thump" | "flag" | "flat" | "tuck" | "beard" | "spines";
export type DefenceSpec = {
    move: DefenceMove;
    /** The species' own sentence (the catalogue row's `line`). */
    line: string;
    /** A flash's hidden colour (sRGB hex), as its own text names it; a flagged tail's white, a beard's dark. */
    colour: string | null;
    /** A thump: then, running, it flags its white tail (the European rabbit's row says both). */
    flag?: boolean;
    /** A rear: only when cornered (the predator very close), as its row says; otherwise at a predator close. */
    cornered?: boolean;
    /** A thump: a forefoot's stamp (a deer), not the hind feet's thump. */
    fore?: boolean;
    /** Acted at a disturbance (its row's `when`: "at danger it cannot see"), which the day's schedule gives now and then (`disturbedNow`). */
    disturbance?: boolean;
};

const SPECIES = (table as unknown as {species: Record<string, [DefenceMove, string, string?, number?]>}).species;
const SPECS = new Map<string, DefenceSpec>(
    Object.entries(SPECIES).map(([slug, [move, line, colour, bits = 0]]) => [
        slug,
        {move, line, colour: colour || null, ...(bits & 1 ? {flag: true} : {}), ...(bits & 2 ? {cornered: true} : {}), ...(bits & 4 ? {fore: true} : {}), ...(bits & 8 ? {disturbance: true} : {})}
    ])
);

/**
 * Each move as an act with a stable name, for the earned Powers (lane ark-powers-visible): the survival mechanisms of
 * AnimalDex decision 420 (`data/ark/power-mechanisms.json`: camouflage, hiding, armour, warning, speed, group,
 * vigilance, climb, mimicry) a species' Power can be shown by with this act. Names never change once given.
 */
export const DEFENCE_ACTS: Record<DefenceMove, {name: string; mechanisms: string[]}> = {
    curl: {name: "defence.curl", mechanisms: ["armour"]},
    coil: {name: "defence.coil", mechanisms: ["armour", "hiding"]},
    shell: {name: "defence.shell", mechanisms: ["armour", "hiding"]},
    puff: {name: "defence.puff", mechanisms: ["warning", "armour"]},
    tail: {name: "defence.tail_drop", mechanisms: ["speed"]},
    flash: {name: "defence.flash", mechanisms: ["warning", "mimicry"]},
    rear: {name: "defence.rear_threat", mechanisms: ["warning"]},
    blur: {name: "defence.blur", mechanisms: ["warning", "camouflage"]},
    thump: {name: "defence.thump", mechanisms: ["vigilance", "group", "warning"]},
    flag: {name: "defence.tail_flag", mechanisms: ["speed", "vigilance"]},
    flat: {name: "defence.contract_flat", mechanisms: ["armour"]},
    tuck: {name: "defence.legs_tucked", mechanisms: ["hiding", "camouflage", "mimicry"]},
    beard: {name: "defence.beard_puff", mechanisms: ["warning"]},
    spines: {name: "defence.spines_locked", mechanisms: ["armour", "warning"]}
};

/** The act a species shows, by name, and the mechanisms it plays for (the Powers lane's question), or null. */
export function defenceActOf(slug: string | null | undefined): {name: string; mechanisms: string[]; line: string} | null {
    const spec = defenceMoveOf(slug);
    return spec ? {...DEFENCE_ACTS[spec.move], line: spec.line} : null;
}

/** The species' defence move, or null (most species: they freeze, run or hide as before). */
export function defenceMoveOf(slug: string | null | undefined): DefenceSpec | null {
    return (slug && SPECS.get(slug)) || null;
}

/** Every species with a move (the tests and the harness). */
export function defenceSpecies(): Array<[string, DefenceSpec]> {
    return Array.from(SPECS);
}

/**
 * Its move is made on the spot (a ball, a shell, a swollen body, wings flashed open): with a predator inside its
 * flight distance it stays where it is and does it (`reactive.ts` withdraw), whatever its generated defence list says
 * (a pill millipede's said only "run for cover", a box turtle's "burrow"). A tail-dropper runs.
 */
export function holdsItsGround(slug: string | null | undefined): boolean {
    const spec = defenceMoveOf(slug);
    return Boolean(spec && !RUNS.has(spec.move) && !spec.cornered);
}
/** SIG-DEFENCE: its move is made running (a tail dropped, a tail flagged): the reactive layer's `escapes`. */
export function escapesRunning(slug: string | null | undefined): boolean {
    const move = defenceMoveOf(slug)?.move;
    return move === "tail" || move === "flag";
}
/** Moves made while it runs, or before it runs (the thump): never held through a predator's coming. */
const RUNS = new Set<DefenceMove>(["tail", "flag", "thump"]);

/**
 * SIG-DEFENCE: what the reactive layer is told this frame (`ReactiveInput.holds`): true it stays and makes its move at a
 * predator close; "cornered" only at one very close (it runs before that); false it runs. A thumper holds while its
 * thumps last (`THUMP_BOUT`), then runs.
 */
export function holdsNow(slug: string | null | undefined, state: DefenceState | null | undefined): boolean | "cornered" {
    const spec = defenceMoveOf(slug);
    if (!spec) return false;
    if (spec.move === "thump") return Boolean(state && state.bout >= 0 && state.bout < THUMP_BOUT);
    if (RUNS.has(spec.move)) return false;
    return spec.cornered ? "cornered" : true;
}

/**
 * SIG-DEFENCE: a disturbance now (a deer stamping "at danger it cannot see"): the day's schedule gives one now and then,
 * the same for every viewer (the world's clock and the animal's id): about one 6 s bout in 20 minutes, while it is
 * awake and about its own day. A drawing rate: the catalogue gives none.
 */
export const DISTURB_EVERY = 1200;
export const DISTURB_FOR = 6;
export function disturbedNow(id: string, epochSeconds: number): boolean {
    const slot = Math.floor(epochSeconds / DISTURB_EVERY);
    let h = 2166136261;
    const key = `${id}:${slot}`;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    const start = ((h >>> 0) / 4294967296) * (DISTURB_EVERY - DISTURB_FOR);
    const into = epochSeconds - slot * DISTURB_EVERY - start;
    return into >= 0 && into < DISTURB_FOR;
}

/**
 * A small animal at its microhabitat (a pill millipede in the leaf litter, a moth on a wall: `micro.ts`) is outside
 * the reactive layer, which would otherwise tell its move a predator has come. This is that one question for it, asked
 * of the animals the layer has near the camera: 0 nothing that could eat it close by, 1 one inside its flight distance,
 * 2 one very close (inside 0.4 of it, the layer's own "very close"). Who can eat whom is the ecology's food links
 * (`canEat`), as everywhere; a sleeping animal and one in the air are no threat on the ground.
 */
export type NearbyAnimal = {slug: string; size: number | null; intel: ArkIntelProfile; asleep: boolean; shared: {x: number; z: number; aloft: boolean}};
export function predatorBeside(slug: string, x: number, z: number, others: readonly NearbyAnimal[]): 0 | 1 | 2 {
    if (!others.length) return 0;
    const me = intelProfile(slug);
    const size = behaviourProfile(slug).size;
    let level: 0 | 1 | 2 = 0;
    for (const other of others) {
        if (other.asleep || other.shared.aloft) continue;
        const d = Math.hypot(other.shared.x - x, other.shared.z - z);
        if (d > me.flight || !canEat(other.intel, me, other.size, size)) continue;
        if (d < me.flight * 0.4) return 2;
        level = 1;
    }
    return level;
}

// MARK: The state per animal

export type DefenceState = {
    /** 0 as usual … 1 the move made (curled, drawn in, swollen, flashing). */
    amount: number;
    /** 0 whole … 1 the tail gone (a stump), growing back. */
    tail: number;
    /** Seconds since the tail was shed (the shed tail twitches behind it for `TAIL_TWITCH`), or -1. */
    shed: number;
    /** How far it has moved since it shed the tail (in lengths of its tail): the shed tail stays where it fell. */
    left: number;
    /** Counts its moves: the live log says the species' sentence once per move. */
    episode: number;
    /** A move is going on (for the episode count). */
    on: boolean;
    /** Seconds since the predator was last beside it: it stays closed a while (`HOLD`). */
    calm: number;
    /** A thump's bout: seconds into it, or -1 (none since it last calmed). */
    bout: number;
    /** 0 … 1 its white tail flagged as it runs (a flag, or a thumper's flag after the thumps). */
    raised: number;
};

export function newDefenceState(): DefenceState {
    return {amount: 0, tail: 0, shed: -1, left: 0, episode: 0, on: false, calm: 0, bout: -1, raised: 0};
}

/** What the reactive layer says this frame (`ReactiveOut`), as far as a move needs it. */
export type DefenceSignal = {action: string | null; alarmed: number; /** The predator is very close (inside 0.4 of its flight distance). */ pressed: boolean; /** How far it moved this frame, in lengths of its own tail. */ moved?: number; /** SIG-DEFENCE: a disturbance the day's schedule gives now (`disturbedNow`; a species acted at one). */ disturbed?: boolean};

/** How fast each move is made and undone (a share of it a second): a pill millipede closes "within a second", a toad fills with air more slowly, wings flash open at once. */
const RATE_IN: Record<DefenceMove, number> = {curl: 2.4, coil: 1.5, shell: 2.2, puff: 0.9, flash: 7, tail: 6, rear: 3, blur: 4, thump: 6, flag: 5, flat: 1.2, tuck: 2.5, beard: 1.5, spines: 6};
const RATE_OUT: Record<DefenceMove, number> = {curl: 0.35, coil: 0.3, shell: 0.4, puff: 0.3, flash: 1.5, tail: 0, rear: 0.6, blur: 1.5, thump: 4, flag: 0.8, flat: 0.25, tuck: 0.35, beard: 0.3, spines: 0.6};
/** A thump's bout (s): three or four thumps on the ground, then it runs (a drawing span; the rows give none). */
export const THUMP_BOUT = 2.4;
/** The reactive layer's actions that set off a thump (it has seen or heard danger). */
const STARTLED = new Set(["alert", "freeze", "withdraw", "flee", "threat_display", "shield_young"]);
/** Once the predator is no longer beside it, it holds its move this long before it opens up (s): it "stays closed". */
export const HOLD = 3;
/** The shed tail lies twitching where it fell this long (s), then is gone; the stump grows back over this long (s of the world's clock; a drawing span, not a sourced rate). */
export const TAIL_TWITCH = 6;
export const TAIL_REGROW = 900;

/**
 * One frame. On the spot: the move is made while it withdraws, held while it is still alarmed, and undone slowly once
 * it calms (it "stays closed"). The tail: shed once when the predator is very close; not again until it has grown back.
 */
export function stepDefence(state: DefenceState, spec: DefenceSpec, signal: DefenceSignal, dt: number): void {
    if (!(dt > 0)) return;
    if (spec.move === "tail") {
        if (signal.pressed && state.tail <= 0.001) {
            state.tail = 1;
            state.shed = 0;
            state.left = 0;
            state.episode++;
        } else if (state.shed >= 0) {
            state.shed += dt;
            state.left += signal.moved ?? 0;
            if (state.shed > TAIL_TWITCH) state.shed = -1;
        } else if (state.tail > 0) {
            state.tail = Math.max(state.tail - dt / TAIL_REGROW, 0);
        }
        return;
    }
    if (spec.move === "thump") {
        // A bout of thumps when it first takes fright (or at a disturbance), once until it has calmed; then, running,
        // a thumper that flags raises its white tail.
        const startled = STARTLED.has(signal.action ?? "") || Boolean(signal.disturbed);
        state.calm = startled ? 0 : state.calm + dt;
        if (state.bout < 0 && startled) {
            state.bout = 0;
            state.episode++;
        } else if (state.bout >= 0) {
            state.bout += dt;
            if (state.bout > THUMP_BOUT && state.calm > HOLD) state.bout = -1;
        }
        const thumping = state.bout >= 0 && state.bout < THUMP_BOUT;
        state.on = thumping;
        state.amount = thumping ? Math.min(state.amount + dt * RATE_IN.thump, 1) : Math.max(state.amount - dt * RATE_OUT.thump, 0);
        const run = Boolean(spec.flag) && !thumping && signal.action === "flee";
        state.raised = run ? Math.min(state.raised + dt * RATE_IN.flag, 1) : Math.max(state.raised - dt * RATE_OUT.flag, 0);
        return;
    }
    if (spec.move === "flag") {
        // Running from it, the tail up and its white showing; down again once it stops.
        const run = signal.action === "flee";
        if (run && !state.on && state.raised < 0.05) state.episode++;
        state.on = run;
        state.raised = run ? Math.min(state.raised + dt * RATE_IN.flag, 1) : Math.max(state.raised - dt * RATE_OUT.flag, 0);
        state.amount = state.raised;
        return;
    }
    const threatened = signal.action === "withdraw";
    state.calm = threatened ? 0 : state.calm + dt;
    const want = threatened || (state.amount > 0 && (state.calm < HOLD || (signal.action === "recover" && signal.alarmed > 0.5)));
    if (want && !state.on && state.amount < 0.05) state.episode++;
    state.on = want;
    state.amount = want ? Math.min(state.amount + dt * RATE_IN[spec.move], 1) : Math.max(state.amount - dt * RATE_OUT[spec.move], 0);
}

/** Whether the move is far enough along to be said in the log (the species' sentence), and its episode's key. */
export function defenceSaid(state: DefenceState, spec: DefenceSpec, id: string): string | null {
    const showing = spec.move === "tail" ? state.shed >= 0 : spec.move === "thump" ? (state.on && state.amount > 0.5) || state.raised > 0.5 : state.on && state.amount > 0.5;
    return showing ? `defence:${id}:${state.episode}` : null;
}

// MARK: The shader's side

/** The shader's kinds. */
export const DEFENCE_KIND = {curl: 1, coil: 2, shell: 3, puff: 5, tail: 7, flash: 8, rear: 20, blur: 21, thump: 22, flag: 23, flat: 24, tuck: 25, beard: 26, spines: 27} as const;

/** The flash colours the table names, in order (the shader's list, numbered from 1). */
export const FLASH_COLOURS: string[] = Array.from(new Set(["#f2efe8", ...Array.from(SPECS.values(), (s) => s.colour).filter((c): c is string => Boolean(c))])).sort();
/** A colour's number in the shader's list (from 1), or 0 (none named: drawn as it is). */
const colourIndex = (hex: string | null | undefined) => FLASH_COLOURS.indexOf(hex ?? "") + 1;

/** A move for the shader in one float: -(kind·65536 + aux·256 + amount), amount and aux 0…255. Never positive (that is a sleep). */
export function packDefence(kind: number, amount: number, aux: number): number {
    const q = (v: number) => Math.min(Math.max(Math.round(v), 0), 255);
    const a = q(amount * 255);
    return a === 0 && kind !== DEFENCE_KIND.tail ? 0 : -(kind * 65536 + q(aux) * 256 + a);
}

/** The shader's `arkDefenceOf`, in numbers: [kind, amount 0…1, aux 0…255]. */
export function unpackDefence(packed: number): [number, number, number] {
    if (packed > -0.5) return [0, 0, 0];
    let p = Math.floor(-packed + 0.5);
    const kind = Math.floor(p / 65536);
    p -= kind * 65536;
    const aux = Math.floor(p / 256);
    return [kind, (p - aux * 256) / 255, aux];
}

/** Model plans (`ark.json`) whose shell sits over the whole body (a turtle); the others carry it behind and above (a snail, a hermit crab). */
const SHELL_OVER = new Set(["turtle"]);
/** Model plans that swell in the water, all round (a pufferfish); the others swell from the ground up (a toad). */
const PUFF_ALL_ROUND = new Set(["fish", "eel"]);

/**
 * This frame's move for the shader (`arkInstance.w`), or 0 when there is none to draw (the caller then writes its
 * sleep as before). `plan` is the MODEL's plan (`ark.json`: "turtle", "fish", "frog", "reptile", "arthropod"…).
 */
export function defencePack(state: DefenceState, spec: DefenceSpec, plan: string | null | undefined): number {
    switch (spec.move) {
        case "curl":
        case "coil":
            return packDefence(DEFENCE_KIND[spec.move], state.amount, 0);
        case "shell":
            return packDefence(DEFENCE_KIND.shell, state.amount, SHELL_OVER.has(plan ?? "") ? 0 : 1);
        case "puff":
            return packDefence(DEFENCE_KIND.puff, state.amount, PUFF_ALL_ROUND.has(plan ?? "") ? 1 : 0);
        case "flash":
            return packDefence(DEFENCE_KIND.flash, state.amount, colourIndex(spec.colour));
        case "rear":
            // (aux 1: a mammal stands upright on its hind feet; 0: an arthropod raises its front.)
            return packDefence(DEFENCE_KIND.rear, state.amount, plan === "mammal" ? 1 : 0);
        case "blur":
            // (aux 0: the body whirled round and round, "whirling"; 1: pumped back and forth on its web.)
            return packDefence(DEFENCE_KIND.blur, state.amount, /whirl/i.test(spec.line) ? 0 : 1);
        case "thump":
            if (state.amount <= 0.001 && state.raised > 0.001) return packDefence(DEFENCE_KIND.flag, state.raised, colourIndex("#f2efe8"));
            return packDefence(DEFENCE_KIND.thump, state.amount, spec.fore ? 1 : 0);
        case "flag":
            return packDefence(DEFENCE_KIND.flag, state.raised, colourIndex(spec.colour));
        case "flat":
            return packDefence(DEFENCE_KIND.flat, state.amount, 0);
        case "tuck":
            return packDefence(DEFENCE_KIND.tuck, state.amount, 0);
        case "beard":
            return packDefence(DEFENCE_KIND.beard, state.amount, colourIndex(spec.colour));
        case "spines":
            // (aux 1: the pectoral spines only, as its row says; 0: its fin spines, the dorsal's too.)
            return packDefence(DEFENCE_KIND.spines, state.amount, /pectoral/i.test(spec.line) ? 1 : 0);
        case "tail": {
            if (state.tail <= 0.001) return 0;
            // (aux: the shed tail's time, 1…255 over TAIL_TWITCH while it lies there; 0 once it is gone. Amount: the stump.)
            // While the shed tail is drawn, the amount carries how far behind it lies (0…1 of four tail lengths).
            if (state.shed >= 0) return packDefence(DEFENCE_KIND.tail, Math.max(Math.min(state.left / 4, 1), 1 / 255), 1 + Math.round((state.shed / TAIL_TWITCH) * 254));
            return packDefence(DEFENCE_KIND.tail, Math.max(state.tail, 1 / 255), 0);
        }
    }
}

const hexVec = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    // (sRGB to the shader's linear working space.)
    const lin = (v: number) => Math.pow(v / 255, 2.2).toFixed(4);
    return `vec3(${lin((n >> 16) & 255)}, ${lin((n >> 8) & 255)}, ${lin(n & 255)})`;
};

/** With the vertex shader's declarations (`animal-material.ts`). `arkDefBox`: the model's z from and to, y from and to; `arkDefSpan`: half its width. */
export const DEFENCE_VERTEX_DECLARATIONS = `
uniform vec4 arkDefBox;
uniform float arkDefSpan;
// (x: a flash's share here, on the wings; y: its colour's number, or the shed tail's side of the cut.)
varying vec2 vArkDefence;
// A defence move packed negative in arkInstance.w (defence-moves.ts packDefence): (kind, amount 0-1, aux 0-255).
vec3 arkDefenceOf(float packed) {
    if (packed > -0.5) return vec3(0.0);
    float p = floor(-packed + 0.5);
    float kind = floor(p / 65536.0);
    p -= kind * 65536.0;
    float aux = floor(p / 256.0);
    return vec3(kind, (p - aux * 256.0) / 255.0, aux);
}
`;

/**
 * The moves on the body, in the model's space (z forward to the head, y up), after the skin and the idle motion:
 * near the camera only (the shader's `animated` levels), like the sleep's curl.
 */
export const DEFENCE_VERTEX = `
{
    vec3 arkDef = arkDefenceOf(arkInstance.w);
    float defA = arkDef.y;
    float defK = arkDef.x;
    float dz0 = arkDefBox.x;
    float dz1 = arkDefBox.y;
    float dy0 = arkDefBox.z;
    float dy1 = arkDefBox.w;
    float dLen = max(dz1 - dz0, 0.001);
    float dHigh = max(dy1 - dy0, 0.001);
    float dMid = (dz0 + dz1) * 0.5;
    vArkDefence = vec2(0.0);
    if (defK > 0.5 && defK < 1.5) {
        // A ball: the spine bends round under it (head and tail come together at the belly), the legs fold into the
        // middle, and the whole draws in a little; lifted so the ball rests on the ground.
        float ease = defA * defA * (3.0 - 2.0 * defA);
        float phi = 3.0 * ease;
        if (phi > 0.001) {
            // (The line the body bends about: a third of the way up, the belly's. Above it the back draws in to half
            // its depth; below it the belly and the legs close on the ball's middle once it is most of the way round.)
            float y0 = dy0 + dHigh * 0.34;
            float bendR = dLen * 0.5 / phi;
            float th = (transformed.z - dMid) / bendR;
            float back = (dy1 - y0) * mix(1.0, 0.5, ease);
            float up = transformed.y - y0;
            float r = up > 0.0
                ? bendR + up * mix(1.0, 0.5, ease)
                : mix(bendR + up, bendR * clamp((transformed.y - dy0) / (y0 - dy0), 0.0, 1.0), smoothstep(0.45, 1.0, ease));
            // Lifted as the ends come round under it, so the ball rests on the ground.
            float under = bendR * (1.0 - cos(min(phi, 3.14159))) + 0.2 * back * max(-cos(phi), 0.0);
            transformed.y = y0 - bendR + max(r, 0.0) * cos(th) + max(under - (y0 - dy0), 0.0);
            transformed.z = dMid + max(r, 0.0) * sin(th);
            transformed.x *= 1.0 + 0.12 * ease;
        }
    } else if (defK > 1.5 && defK < 2.5) {
        // A flat coil: the body winds into a spiral on the ground, the head at the middle (an Archimedean spiral by
        // the distance along the body; each turn one body's width out from the last).
        float ease = defA * defA * (3.0 - 2.0 * defA);
        float wide = clamp(arkDefSpan * 1.6, dLen * 0.03, dLen * 0.16);
        float b = wide / 6.28318;
        float s = clamp(dz1 - transformed.z, 0.0, dLen);
        float th0 = 1.6;
        float th = sqrt(th0 * th0 + 2.0 * s / b);
        float rho = max(b * th - transformed.x, 0.0);
        vec2 coil = vec2(rho * cos(th), dMid + rho * sin(th));
        transformed.xz = mix(transformed.xz, coil, ease);
    } else if (defK > 2.5 && defK < 3.5) {
        // Into its shell: everything outside the shell's own round (an ellipsoid over the body for a turtle; over the
        // back and behind for a snail or a hermit crab) is drawn in to it, and the shell settles on the ground.
        float over = arkDef.z < 0.5 ? 1.0 : 0.0;
        vec3 mid = vec3(0.0, dy0 + dHigh * mix(0.6, 0.56, over), dMid - dLen * mix(0.1, 0.02, over));
        vec3 rad = vec3(arkDefSpan * mix(0.72, 0.8, over), dHigh * mix(0.42, 0.4, over), dLen * mix(0.33, 0.34, over));
        vec3 q = (transformed - mid) / rad;
        float out1 = length(q);
        if (out1 > 1.0) transformed = mix(transformed, mid + (transformed - mid) / out1, defA);
        transformed.y -= defA * max(mid.y - rad.y - dy0, 0.0) * 0.85;
    } else if (defK > 4.5 && defK < 5.5) {
        // Swollen: the middle of the body out all round (in the water), or out and up from the ground (on land).
        float along = (transformed.z - dMid) / (dLen * 0.5);
        float water = arkDef.z > 0.5 ? 1.0 : 0.0;
        float swell = defA * mix(0.42, 0.95, water) * exp(-along * along * mix(1.6, 1.1, water));
        float fromY = mix(dy0, (dy0 + dy1) * 0.5, water);
        transformed.x *= 1.0 + swell;
        transformed.y = fromY + (transformed.y - fromY) * (1.0 + swell * mix(0.7, 1.0, water));
        // (On land, one with a tail lashes it: the two lizards that puff up are the two whose text says so.)
        if (water < 0.5 && tailLength > 0.0 && transformed.z < tailBaseZ) {
            float into = clamp((tailBaseZ - transformed.z) / tailLength, 0.0, 1.0);
            transformed.x += defA * tailLength * 0.3 * into * into * sin(arkClock * 9.0 + arkInstance.x * 40.0);
        }
    } else if (defK > 6.5 && defK < 7.5 && tailLength > 0.0 && transformed.z < tailBaseZ) {
        // The tail shed. While it lies where it fell (aux 1-255: its time), it stays behind as the animal goes
        // (amount: how far, of four tail lengths), twitching, and shrinks away at the end; then (aux 0) only a stump
        // is left (amount: how much of the tail is missing), tapering to the ground, growing back.
        float into = clamp((tailBaseZ - transformed.z) / tailLength, 0.0, 1.0);
        if (arkDef.z > 0.5) {
            float t = (arkDef.z - 1.0) / 254.0;
            float cut = step(0.12, into);
            float fade = 1.0 - smoothstep(0.75, 1.0, t);
            vec3 base = vec3(tailBaseX, dy0, tailBaseZ - tailLength * 0.12);
            vec3 shed = base + (transformed - base) * fade;
            shed.z -= defA * 4.0 * tailLength;
            shed.x += tailLength * 0.16 * fade * sin(arkClock * 31.0 + into * 7.0) * into;
            vec3 stump = vec3(tailBaseX + (transformed.x - tailBaseX) * (1.0 - into / 0.12), dy0 + (transformed.y - dy0) * (1.0 - into / 0.12), transformed.z);
            transformed = mix(stump, shed, cut);
            vArkDefence.y = cut;
        } else {
            float gone = defA;
            float keep = 1.0 - 0.88 * gone;
            float taper = 1.0 - gone * smoothstep(0.0, 0.12, into);
            transformed.z = tailBaseZ - tailLength * into * keep;
            transformed.x = tailBaseX + (transformed.x - tailBaseX) * taper;
            transformed.y = dy0 + (transformed.y - dy0) * taper;
        }
    } else if (defK > 7.5 && defK < 8.5) {
        // (p3 (shake): kinds 10 and 11 are the water shake's, water-shake.ts.)
        // A flash of hidden colour, on the hind wings as they lie at rest, by the rest pose (so it stays on the wings
        // as the body moves). A flat body (a moth with its wings spread or folded low: far wider than it is tall) has
        // them out at the sides behind its middle; a tall one (a grasshopper) along the top of its back, and what
        // is out at its sides is legs.
        float side = abs(position.x) / max(arkDefSpan, 0.001);
        float rear = 1.0 - smoothstep(0.02, 0.12, (position.z - dMid) / dLen);
        float onBack = smoothstep(0.45, 0.62, (position.y - dy0) / dHigh) * (1.0 - smoothstep(0.7, 0.9, side));
        float flatBody = 1.0 - smoothstep(0.45, 0.7, dHigh / max(2.0 * arkDefSpan, 0.001));
        vArkDefence = vec2(defA * rear * mix(onBack, smoothstep(0.16, 0.3, side), flatBody), arkDef.z);
    } else if (defK > 19.5 && defK < 20.5) {
        // SIG-DEFENCE: rearing up. The front of the body turns up about a point on the ground a third of the way along
        // from the rear; the front legs (low, ahead of the middle) go up further and open. A mammal (aux 1: a
        // tamandua) stands upright on its hind feet, about its hips.
        float ease = defA * defA * (3.0 - 2.0 * defA);
        float upright = arkDef.z > 0.5 ? 1.0 : 0.0;
        float pz = mix(dz0 + dLen * 0.32, dz0 + dLen * 0.22, upright);
        float w = smoothstep(pz - dLen * 0.05, pz + dLen * 0.12, transformed.z);
        float legs = (1.0 - smoothstep(dy0, dy0 + dHigh * 0.45, transformed.y)) * smoothstep(dMid, dz1, transformed.z) * (1.0 - upright);
        float ang = ease * mix(0.5, 1.2, upright) * w * (1.0 + 0.7 * legs);
        float ry = transformed.y - dy0;
        float rz = transformed.z - pz;
        float rc = cos(ang);
        float rs = sin(ang);
        transformed.y = dy0 + ry * rc + rz * rs;
        transformed.z = pz - ry * rs + rz * rc;
        transformed.x *= 1.0 + 0.3 * ease * legs;
    } else if (defK > 20.5 && defK < 21.5) {
        // SIG-DEFENCE: shaken to a blur: the whole body whirled round in small fast circles (aux 0, a daddy-long-legs),
        // or pumped back and forth across its web (aux 1, an orb weaver), faster than the eye can follow.
        float bt = arkClock * 6.2831853 * 7.0 + arkInstance.x * 40.0;
        float br = defA * dLen * 0.16;
        if (arkDef.z < 0.5) {
            transformed.x += br * cos(bt);
            transformed.z += br * sin(bt);
        } else {
            transformed.y += br * 1.3 * sin(bt);
        }
    } else if (defK > 21.5 && defK < 22.5) {
        // SIG-DEFENCE: a thump of the hind feet (a rabbit, a wallaby), or a forefoot's stamp (aux 1, a deer): the foot
        // comes up and slams down, about twice a second; the haunch rises a little with it.
        float tf = fract(arkClock * 2.2 + arkInstance.x * 7.0);
        float lift = smoothstep(0.0, 0.55, tf) * (1.0 - smoothstep(0.62, 0.7, tf));
        float fore = arkDef.z > 0.5 ? 1.0 : 0.0;
        float alongF = mix(1.0 - smoothstep(dz0 + dLen * 0.22, dz0 + dLen * 0.45, transformed.z), smoothstep(dz1 - dLen * 0.45, dz1 - dLen * 0.3, transformed.z), fore);
        float low = 1.0 - smoothstep(dy0 + dHigh * 0.1, dy0 + dHigh * 0.4, transformed.y);
        float sideF = mix(1.0, smoothstep(-0.05, 0.25, transformed.x / max(arkDefSpan, 0.001)), fore);
        transformed.y += defA * lift * alongF * sideF * (low * dHigh * mix(0.16, 0.24, fore) + (1.0 - fore) * (1.0 - low) * dHigh * 0.06);
    } else if (defK > 22.5 && defK < 23.5) {
        // SIG-DEFENCE: the tail flagged as it runs: the tail (a round about the model's own tail, its base to its tip)
        // lifted up and back, its white showing (aux: the colour). Every vertex carries the colour's number, so the
        // varying is the same over a triangle and never reads as another colour or the shed tail's seam.
        vArkDefence = vec2(0.0, arkDef.z);
        if (tailLength > 0.0) {
            vec3 tailMid = vec3(tailBaseX, arkTailBaseY, tailBaseZ - tailLength * 0.5);
            float fm = 1.0 - smoothstep(tailLength * 0.55, tailLength * 1.0, distance(transformed, tailMid));
            transformed.y += defA * fm * tailLength * 0.9;
            transformed.z -= defA * fm * tailLength * 0.25;
            vArkDefence.x = defA * fm;
        }
    } else if (defK > 23.5 && defK < 24.5) {
        // SIG-DEFENCE: contracted flat: shorter, lower and wider (a slug's stiff oval), its tentacles drawn in with the rest.
        float ease = defA * defA * (3.0 - 2.0 * defA);
        transformed.z = dMid + (transformed.z - dMid) * (1.0 - 0.38 * ease);
        transformed.y = dy0 + (transformed.y - dy0) * (1.0 - 0.45 * ease);
        transformed.x *= 1.0 + 0.32 * ease;
    } else if (defK > 24.5 && defK < 25.5) {
        // SIG-DEFENCE: legs pulled in: what reaches out at the sides (the legs) is drawn in toward the body and up under
        // it, and what reaches forward or back beside it (the long front and hind legs, the antennae) toward the middle.
        float ease = defA * defA * (3.0 - 2.0 * defA);
        float cx = arkDefSpan * 0.28;
        float ax = abs(transformed.x);
        float legness = smoothstep(cx, cx * 2.2, ax);
        if (ax > cx) transformed.x = sign(transformed.x) * (cx + (ax - cx) * (1.0 - 0.72 * ease));
        transformed.z = mix(transformed.z, dMid + (transformed.z - dMid) * 0.55, ease * legness);
        float low = 1.0 - smoothstep(dy0, dy0 + dHigh * 0.45, transformed.y);
        transformed.y += ease * low * legness * dHigh * 0.2;
    } else if (defK > 25.5 && defK < 26.5) {
        // SIG-DEFENCE: the beard puffed out and darkened: the throat under the head swells down and out, and goes dark (aux: the colour).
        // (The head and neck only, the last sixth of the body; under the jaw, and narrow: not the forelegs beside it.)
        float along = smoothstep(dz1 - dLen * 0.19, dz1 - dLen * 0.13, transformed.z) * (1.0 - smoothstep(dz1 - dLen * 0.05, dz1 - dLen * 0.01, transformed.z));
        float under = 1.0 - smoothstep(dy0 + dHigh * 0.35, dy0 + dHigh * 0.65, transformed.y);
        float narrow = 1.0 - smoothstep(arkDefSpan * 0.3, arkDefSpan * 0.5, abs(transformed.x));
        float bm = along * under * narrow;
        transformed.y -= defA * bm * dHigh * 0.2;
        transformed.x *= 1.0 + defA * bm * 0.5;
        vArkDefence = vec2(min(defA * along * narrow * (under + 0.25) * 1.3, 1.0), arkDef.z);
    } else if (defK > 26.5 && defK < 27.5) {
        // SIG-DEFENCE: fin spines locked out: the pectoral fins (low at the sides, behind the head) stand out stiff,
        // and (aux 0) the dorsal fin stands up tall.
        float sideS = smoothstep(0.4, 0.8, abs(transformed.x) / max(arkDefSpan, 0.001));
        float frontS = smoothstep(dz1 - dLen * 0.6, dz1 - dLen * 0.45, transformed.z) * (1.0 - smoothstep(dz1 - dLen * 0.25, dz1 - dLen * 0.12, transformed.z));
        float lowS = 1.0 - smoothstep(dy0 + dHigh * 0.3, dy0 + dHigh * 0.6, transformed.y);
        transformed.x *= 1.0 + defA * sideS * frontS * lowS * 0.7;
        if (arkDef.z < 0.5) {
            float topS = smoothstep(dy0 + dHigh * 0.7, dy1, transformed.y) * smoothstep(dz0 + dLen * 0.2, dz0 + dLen * 0.35, transformed.z) * (1.0 - smoothstep(dz1 - dLen * 0.3, dz1 - dLen * 0.15, transformed.z));
            transformed.y += defA * topS * dHigh * 0.22;
        }
    }
}
`;

export const DEFENCE_FRAGMENT_DECLARATIONS = `
varying vec2 vArkDefence;
`;

/**
 * The flash on the skin (after the map): the wings take the hidden colour the species' text names. And the shed
 * tail's seam: the skin between the stump and the tail left behind is not drawn.
 */
export const DEFENCE_FRAGMENT = `
if (vArkDefence.x > 0.003) {
    vec3 hid = vec3(0.6, 0.05, 0.05);
${FLASH_COLOURS.map((hex, i) => `    if (abs(vArkDefence.y - ${(i + 1).toFixed(1)}) < 0.5) hid = ${hexVec(hex)};`).join("\n")}
    diffuseColor.rgb = mix(diffuseColor.rgb, hid, min(vArkDefence.x, 1.0) * 0.92);
} else if (vArkDefence.y > 0.02 && vArkDefence.y < 0.98) discard;
`;
