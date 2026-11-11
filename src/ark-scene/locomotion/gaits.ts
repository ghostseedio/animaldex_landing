/**
 * Gaits: which legs move together (their phase offsets in the cycle), how long each foot is down (duty factor), how
 * the body moves with them, and which gait a body plan uses at a speed.
 *
 * Speed is compared on the Froude number Fr = v² / (g·h), h the hip height (Alexander and Jayes 1983: animals of all
 * sizes change gait at about the same Fr: walk to trot about 0.5, trot to gallop 2 to 3). Stride length follows
 * Alexander (1976), λ / h ≈ 2.3 · Fr^0.3, so a bigger animal takes longer, slower strides at the same speed and the
 * cadence is speed / stride: the feet never slide.
 *
 * Phase offsets: the share of the cycle after the reference foot (the left hind) at which each foot touches down.
 * Footfall orders: walk lateral sequence LH LF RH RF; diagonal-sequence walk (primates, turtles) LH RF RH LF; trot
 * diagonal pairs; pace lateral pairs; transverse gallop (hoofed) LH RH LF RF; rotary gallop (carnivores) LH RH RF
 * LF; bound hind pair then fore pair. Six legs: tripod (L1 R2 L3 | R1 L2 R3); slow insects a back-to-front wave.
 * Eight: a back-to-front wave on each side, the sides half a cycle apart; faster, the alternating tetrapod.
 */

import type {BodyPlan, GaitName, LocoLeg, LocoRig} from "@/ark-scene/locomotion/types";

export const G = 9.81;
/**
 * The fastest stride cycle drawn (cycles a second): 14, four frames a cycle at 60 fps (a cockroach runs at 25: drawn
 * that fast, its legs alias into a shimmer; an animal that small slides its feet a little instead, out of sight).
 */
export const MAX_CADENCE = 14;

/** How a gait moves the body (shares of the hip height, radians). */
export type GaitSpec = {
    name: GaitName;
    /** Touch-down offset per leg key (L1 = left front pair; for a quadruped L1 is the left fore, L2 the left hind). */
    offsets: (leg: LocoLeg, legs: number) => number;
    /** Duty factor at the gait's slowest and fastest. */
    duty: [number, number];
    /** Swing height (share of hip height). */
    swing: number;
    /** Vertical bob (share of hip height): + vaults (highest at mid-stance: walks), − bounces (lowest: runs). */
    bob: number;
    /** Body crouch while in this gait (share of hip height). */
    crouch: number;
    /** Body pitch rock (radians) and spine flex at the waist (radians), once a cycle (gallops and bounds). */
    pitch: number;
    flex: number;
    /** Lateral spine bend (radians, hips and chest in counter-phase, once a cycle: lizards, salamanders). */
    bend: number;
    /** Side sway (share of hip height) and roll (radians) toward the supporting side. */
    sway: number;
    roll: number;
    /** Stride multiplier on Alexander's λ (a sprawling or a short-legged gait takes shorter strides). */
    stride: number;
};

const quadKey = (leg: LocoLeg) => `${leg.end === "fore" ? "F" : "H"}${leg.side > 0 ? "L" : "R"}`;
/** Quadruped footfall tables by gait. */
const QUAD: Record<string, Record<string, number>> = {
    walk: {HL: 0, FL: 0.25, HR: 0.5, FR: 0.75},
    ds_walk: {HL: 0, FR: 0.25, HR: 0.5, FL: 0.75},
    amble: {HL: 0, FL: 0.25, HR: 0.5, FR: 0.75},
    trot: {HL: 0, FR: 0, HR: 0.5, FL: 0.5},
    sprawl: {HL: 0, FR: 0.05, HR: 0.5, FL: 0.55},
    sprawl_run: {HL: 0, FR: 0, HR: 0.5, FL: 0.5},
    pace: {HL: 0, FL: 0.05, HR: 0.5, FR: 0.55},
    canter: {HR: 0, HL: 0.3, FR: 0.32, FL: 0.58},
    gallop: {HL: 0, HR: 0.1, FL: 0.48, FR: 0.6},
    rotary: {HL: 0, HR: 0.1, FR: 0.48, FL: 0.6},
    half_bound: {HL: 0, HR: 0.06, FL: 0.5, FR: 0.6},
    bound: {HL: 0, HR: 0, FL: 0.5, FR: 0.52},
    hop: {HL: 0, HR: 0, FL: 0.08, FR: 0.08},
    stand: {HL: 0, FL: 0, HR: 0, FR: 0}
};

/** Touch-down offset of a leg in a gait, for any number of legs. */
export function legOffset(gait: GaitName, leg: LocoLeg, legs: readonly LocoLeg[]): number {
    const count = legs.length;
    const pairs = Math.max(...legs.map((l) => l.pair)) + 1;
    const left = leg.side > 0;
    if (count === 2 || pairs === 1) {
        if (gait === "hop" || gait === "stand") return 0;
        return left ? 0 : 0.5;
    }
    if (count === 4) {
        const table = QUAD[gait] ?? QUAD.walk;
        return table[quadKey(leg)] ?? 0;
    }
    // Six legs: the tripod (L1 R2 L3 together, R1 L2 R3 the other half); slow, a wave from the back forward.
    if (pairs === 3) {
        if (gait === "wave") return (((pairs - 1 - leg.pair) / pairs) * 0.5 + (left ? 0 : 0.5)) % 1;
        return ((leg.pair % 2 === 0) === left ? 0 : 0.5);
    }
    // Eight or more: the wave (back to front on each side, the sides half a cycle apart) or the alternating tetrapod.
    if (gait === "wave") return (((pairs - 1 - leg.pair) / pairs) + (left ? 0 : 0.5)) % 1;
    return ((leg.pair % 2 === 0) === left ? 0 : 0.5);
}

const SPEC = (name: GaitName, s: Partial<GaitSpec>): GaitSpec => ({
    name,
    offsets: (leg) => 0,
    duty: [0.7, 0.6],
    swing: 0.1,
    bob: 0.015,
    crouch: 0.03,
    pitch: 0,
    flex: 0,
    bend: 0,
    sway: 0.01,
    roll: 0.01,
    stride: 1,
    ...s
});

/** The gaits' body motion (offsets come from `legOffset`). */
export const GAITS: Record<string, GaitSpec> = {
    stand: SPEC("stand", {duty: [1, 1], bob: 0, crouch: 0.02, sway: 0, roll: 0}),
    walk: SPEC("walk", {duty: [0.72, 0.58], swing: 0.1, bob: 0.018, crouch: 0.035, sway: 0.012, roll: 0.02, bend: 0.03}),
    ds_walk: SPEC("ds_walk", {duty: [0.74, 0.6], swing: 0.1, bob: 0.02, crouch: 0.05, sway: 0.015, roll: 0.025, bend: 0.03}),
    amble: SPEC("amble", {duty: [0.6, 0.5], swing: 0.09, bob: 0.012, crouch: 0.04, sway: 0.01, roll: 0.02}),
    trot: SPEC("trot", {duty: [0.5, 0.38], swing: 0.15, bob: -0.03, crouch: 0.055, sway: 0.006, roll: 0.012, stride: 1}),
    pace: SPEC("pace", {duty: [0.55, 0.4], swing: 0.13, bob: -0.025, crouch: 0.05, sway: 0.03, roll: 0.06}),
    canter: SPEC("canter", {duty: [0.42, 0.35], swing: 0.17, bob: -0.04, crouch: 0.06, pitch: 0.07, flex: 0.05, sway: 0.004, roll: 0.01, stride: 1.05}),
    gallop: SPEC("gallop", {duty: [0.34, 0.24], swing: 0.2, bob: -0.045, crouch: 0.07, pitch: 0.06, flex: 0.08, sway: 0.003, roll: 0.008, stride: 1.1}),
    rotary: SPEC("rotary", {duty: [0.32, 0.22], swing: 0.22, bob: -0.05, crouch: 0.08, pitch: 0.05, flex: 0.2, sway: 0.003, roll: 0.008, stride: 1.15}),
    half_bound: SPEC("half_bound", {duty: [0.36, 0.26], swing: 0.22, bob: -0.06, crouch: 0.08, pitch: 0.1, flex: 0.22, sway: 0.002, roll: 0.006, stride: 1.05}),
    bound: SPEC("bound", {duty: [0.34, 0.24], swing: 0.25, bob: -0.07, crouch: 0.09, pitch: 0.12, flex: 0.25, sway: 0, roll: 0, stride: 1.05}),
    hop: SPEC("hop", {duty: [0.4, 0.3], swing: 0.35, bob: -0.18, crouch: 0.12, pitch: 0.08, flex: 0, sway: 0, roll: 0, stride: 0.7}),
    biped_walk: SPEC("biped_walk", {duty: [0.66, 0.58], swing: 0.12, bob: 0.03, crouch: 0.05, sway: 0.03, roll: 0.03, bend: 0.03}),
    biped_run: SPEC("biped_run", {duty: [0.42, 0.3], swing: 0.22, bob: -0.05, crouch: 0.1, pitch: 0.03, sway: 0.02, roll: 0.02, stride: 1.1}),
    waddle: SPEC("waddle", {duty: [0.75, 0.66], swing: 0.07, bob: 0.02, crouch: 0.05, sway: 0.045, roll: 0.1, stride: 0.6}),
    sprawl: SPEC("sprawl", {duty: [0.72, 0.6], swing: 0.12, bob: 0.008, crouch: 0.03, bend: 0.2, sway: 0.004, roll: 0.03, stride: 0.75}),
    sprawl_run: SPEC("sprawl_run", {duty: [0.5, 0.4], swing: 0.16, bob: -0.01, crouch: 0.0, bend: 0.28, sway: 0.004, roll: 0.03, stride: 0.85}),
    tripod: SPEC("tripod", {duty: [0.6, 0.5], swing: 0.22, bob: 0.008, crouch: 0.03, sway: 0.006, roll: 0.02, bend: 0.03, stride: 0.75}),
    wave: SPEC("wave", {duty: [0.8, 0.7], swing: 0.2, bob: 0.004, crouch: 0.02, sway: 0.004, roll: 0.01, stride: 0.6}),
    tetrapod: SPEC("tetrapod", {duty: [0.6, 0.5], swing: 0.22, bob: 0.006, crouch: 0.03, sway: 0.004, roll: 0.01, stride: 0.75})
};

/** A plan's (or a family's) gaits by speed: [gait, the Froude number it starts at going up]. Hysteresis is 20%. */
export type GaitLadder = Array<[GaitName, number]>;

/** Families with gaits of their own (slug patterns: the catalogue's names). */
const PACERS = /(giraffe|okapi|camel|dromedary|llama|alpaca|vicu|guanaco)/;
const AMBLERS = /(elephant|mammoth)/;
const BEARS = /(bear|panda(?!.*red)|wolverine|badger)/;
const BOUNDERS = /(mouse|rat\b|-rat|vole|lemming|hamster|gerbil|squirrel|chipmunk|marmot|weasel|stoat|ermine|ferret|mink|polecat|marten|sable|otter|shrew|hedgehog|dormouse|chinchilla|degu|pika|mongoose|meerkat|rabbit|hare|jerboa|kangaroo-rat|cavy|guinea)/;
const CATS = /(cat\b|cat$|-cat|lion|tiger|leopard|cheetah|jaguar|puma|cougar|lynx|caracal|serval|ocelot|margay|bobcat|panther)/;
const DOGS = /(dog|wolf|fox|jackal|coyote|dingo|dhole|hyena|aardwolf|raccoon)/;
const HOOFED = /(deer|elk|moose|caribou|reindeer|horse|zebra|donkey|ass\b|pony|antelope|gazelle|impala|springbok|kudu|eland|oryx|addax|gnu|wildebeest|buffalo|bison|cattle|cow|ox\b|yak|goat|ibex|sheep|mouflon|chamois|takin|muskox|pig|boar|hog|warthog|peccary|tapir|rhino|hippo|bongo|nyala|duiker|dik-dik|klipspringer|pronghorn|saiga|chevrotain)/;
const HOP_FROGS = /(frog|bullfrog)/;
const HEAD_BOB = /(pigeon|dove|chicken|hen\b|rooster|junglefowl|pheasant|quail|partridge|grouse|turkey|peafowl|peacock|guineafowl|moorhen|coot|rail|gallinule|crake|heron|egret|bittern|ibis|stork|crane|hoopoe|starling|myna|crow|raven|rook|jackdaw|magpie|jay|wagtail|plover|lapwing)/;
const WADDLERS = /(penguin|duck|goose|swan|mallard|teal|wigeon|eider|scoter|merganser|shelduck|pochard|puffin|auk|guillemot|murre)/;
const HOPPERS = /(sparrow|finch|robin|tit\b|tit$|-tit|chickadee|wren|thrush|blackbird|warbler|bunting|canary|budgerigar|lovebird|weaver|munia|waxbill|siskin|goldfinch|chaffinch|bullfinch|redstart|chat\b|flycatcher|nuthatch|kinglet|goldcrest|dunnock|accentor|sunbird|white-eye|bulbul|tanager|cardinal|grosbeak|junco|towhee)/;

export function headBobs(slug: string, plan: BodyPlan): boolean {
    return (plan === "walking_bird" || plan === "flying_bird" || plan === "flightless_bird") && HEAD_BOB.test(slug);
}

/** The gaits a species uses, slowest first. */
export function gaitLadder(rig: Pick<LocoRig, "plan" | "slug" | "legs">): GaitLadder {
    const slug = rig.slug;
    const legs = rig.legs.length;
    const plan = rig.plan;
    if (legs === 0) return [["stand", 0]];
    if (legs === 2) {
        if (WADDLERS.test(slug) && /(penguin)/.test(slug)) return [["waddle", 0]];
        if (HOPPERS.test(slug) && plan === "flying_bird") return [["hop", 0]];
        if (WADDLERS.test(slug)) return [["waddle", 0], ["biped_run", 0.5]];
        return [["biped_walk", 0], ["biped_run", 0.55]];
    }
    if (legs === 6) return [["wave", 0], ["tripod", 0.03]];
    if (legs >= 8) return [["wave", 0], ["tetrapod", 0.05]];
    // Four legs.
    if (plan === "lizard") return [["sprawl", 0], ["sprawl_run", 0.35]];
    if (plan === "turtle") return [["ds_walk", 0]];
    if (plan === "amphibian") return HOP_FROGS.test(slug) && !/toad/.test(slug) ? [["hop", 0]] : [["sprawl", 0], ["hop", 0.6]];
    if (plan === "primate") return [["ds_walk", 0], ["half_bound", 0.8], ["bound", 2.2]];
    if (AMBLERS.test(slug)) return [["walk", 0], ["amble", 0.25]];
    if (PACERS.test(slug)) return [["walk", 0], ["pace", 0.4], ["rotary", 2.0]];
    if (BEARS.test(slug)) return [["walk", 0], ["pace", 0.45], ["rotary", 1.5]];
    if (BOUNDERS.test(slug)) return [["walk", 0], ["trot", 0.35], ["half_bound", 0.9], ["bound", 2.4]];
    if (CATS.test(slug)) return [["walk", 0], ["trot", 0.55], ["rotary", 1.6]];
    if (DOGS.test(slug)) return [["walk", 0], ["trot", 0.45], ["rotary", 2.2]];
    if (HOOFED.test(slug)) return [["walk", 0], ["trot", 0.5], ["canter", 1.4], ["gallop", 2.6]];
    return [["walk", 0], ["trot", 0.5], ["gallop", 2.4]];
}

/** The gait for a Froude number on its ladder, keeping the one it is in within 20% of its edges (no flicker). */
export function gaitFor(ladder: GaitLadder, froude: number, current: GaitName | null): GaitName {
    let pick = ladder[0][0];
    for (const [name, from] of ladder) {
        const edge = name === current ? from * 0.8 : from;
        if (froude >= edge) pick = name;
    }
    if (current && current !== pick) {
        const at = ladder.findIndex(([name]) => name === current);
        const next = ladder[at + 1];
        // Holding the current gait a little past the next one's start, going up.
        if (at >= 0 && next && next[0] === pick && froude < next[1] * 1.2) return current;
    }
    return pick;
}

/**
 * Stride (m a cycle) and cadence (cycles a second) for a speed (m/s) on a hip height (m): Alexander's
 * λ = 2.3·h·Fr^0.3, times the gait's own share, within what the legs reach.
 */
export function strideFor(speed: number, hip: number, gait: GaitSpec, maxCadence = MAX_CADENCE, maxSweep = Infinity): {stride: number; cadence: number; duty: number; froude: number} {
    const h = Math.max(hip, 0.005);
    const froude = (speed * speed) / (G * h);
    const t = Math.min(Math.max(froude / 3, 0), 1);
    const duty = gait.duty[0] + (gait.duty[1] - gait.duty[0]) * t;
    let stride = 2.3 * h * Math.pow(Math.max(froude, 1e-4), 0.3) * gait.stride;
    // A planted foot sweeps stride × duty: at most 0.8 hip heights (a horse's walk sweeps about 0.75, its trot about
    // 0.8): further, a nearly straight leg can't reach either end of it without the body sinking.
    // (And no more than the legs reach with the body barely lowered: short legs take quick little steps.)
    const most = Math.min(0.8 * h, maxSweep) / Math.max(duty, 0.05);
    stride = Math.min(Math.max(stride, 0.2 * h), most);
    // No faster than the frame rate can show (an ant's legs at 30 Hz would alias into a shimmer), and every swing at
    // least two frames long: past that, the stride grows.
    const fastest = Math.min(maxCadence, (1 - duty) * 30);
    if (speed / stride > fastest) stride = speed / fastest;
    const cadence = speed > 1e-6 ? speed / stride : 0;
    return {stride, cadence, duty, froude};
}
