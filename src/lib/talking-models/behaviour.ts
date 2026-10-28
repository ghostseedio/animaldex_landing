/**
 * How a talking animal moves on its own between words: its body's continuous
 * motion (a fish swims, a ray's wings rise and fall, a jellyfish pulses, a
 * coral sways), a tail that wags, and small idle behaviours (a koala yawns, a
 * dog shakes, a rabbit sniffs, a pigeon bobs). The numbers come from the
 * model's talking.json `behaviour` section; a model without one keeps the
 * plain breathing and blinking.
 *
 * A line-for-line port of the iOS `AnimalTalkingBehaviour.swift`, down to the
 * generator and the order it is drawn from, so the same animal does the same
 * things at the same moments on every platform (the tests hold it to a
 * timeline recorded from the Swift code).
 */

/** talking.json `behaviour`, as the file spells it. */
export type TalkingBehaviour = {
    plan?: string | null;
    /** From here forward (+z, the head end) the body stays still, so the jaw, eyes and nose never part from the skin around them. */
    still_z?: number | null;
    /** Half the width across x: a ray's wingspan. */
    span?: number | null;
    extent?: {min: number[]; max: number[]} | null;
    motion?: {
        /** swim, flap, pulse or sway. */
        kind: string;
        /** The way a swim bends: x (side to side, a fish) or y (up and down, a whale). */
        axis: string;
        amplitude: number;
        /** Seconds per beat. */
        period: number;
        /** How many waves run along the body (swim) or out to the tips (flap). */
        waves: number;
    } | null;
    /** Where the tail leaves the body, in the model's space, and how long it is. */
    tail?: {base: number[]; length: number} | null;
    /** How often each idle behaviour comes up: 0 never, 1 rarely, 2 sometimes, 3 often. */
    idle?: Record<string, number> | null;
    /** slow, normal or quick. */
    tempo?: string | null;
    /** The behaviour it is best known for. */
    signature?: string | null;
};

/** The small things an animal does between words, in the Swift enum's order (the generator draws in it). */
export const IDLE_BEHAVIOURS = ["yawn", "sniff", "look", "shake", "chew", "doze", "startle", "bob", "call", "tail"] as const;
export type IdleBehaviour = typeof IDLE_BEHAVIOURS[number];

/** Seconds at a normal tempo. */
export const IDLE_DURATION: Record<IdleBehaviour, number> = {
    yawn: 2.6,
    sniff: 1.3,
    look: 3.2,
    shake: 0.9,
    chew: 4.0,
    doze: 5.5,
    startle: 1.4,
    bob: 1.0,
    call: 1.4,
    tail: 2.2
};

/** Moves the jaw, so it stops the moment the animal starts to speak. */
export function usesMouth(kind: IdleBehaviour): boolean {
    return kind === "yawn" || kind === "chew" || kind === "call";
}

/** What the idle behaviours add to the model this frame. */
export type BehaviourPose = {
    /** Jaw openness: 0 closed, 1 as wide as speech goes, a yawn wider still. */
    mouth: number;
    /** Multiplies the blink: 1 open, 0 shut. */
    lid: number;
    /** Radians on the whole animal: pitch + is nose down. */
    pitch: number;
    yaw: number;
    roll: number;
    /** Up, in model units. */
    lift: number;
    /** The nose's scale. */
    nose: number;
    /** The tail's swing, radians. */
    tail: number;
    /** How much of the usual idle sway is kept (a startled animal freezes). */
    sway: number;
    /** Stretched taller by this much (a yawn's breath in). */
    stretch: number;
};

export function restingPose(): BehaviourPose {
    return {mouth: 0, lid: 1, pitch: 0, yaw: 0, roll: 0, lift: 0, nose: 1, tail: 0, sway: 1, stretch: 0};
}

// The generator works in 64-bit unsigned integers, as the Swift one does.
const MASK = BigInt("0xFFFFFFFFFFFFFFFF");
const GOLDEN = BigInt("0x9E3779B97F4A7C15");
const MIX_1 = BigInt("0xBF58476D1CE4E5B9");
const MIX_2 = BigInt("0x94D049BB133111EB");
const FNV_OFFSET = BigInt("0xCBF29CE484222325");
const FNV_PRIME = BigInt("0x100000001B3");
const S11 = BigInt(11);
const S27 = BigInt(27);
const S30 = BigInt(30);
const S31 = BigInt(31);
const TWO_53 = 9007199254740992;

/**
 * A small fast generator (SplitMix64): the same seed plays the same
 * behaviours, so the tests see what every platform does.
 */
export class BehaviourRandom {
    private state: bigint;

    constructor(seed: bigint) {
        this.state = seed & MASK;
    }

    next(): bigint {
        this.state = (this.state + GOLDEN) & MASK;
        let z = this.state;
        z = ((z ^ (z >> S30)) * MIX_1) & MASK;
        z = ((z ^ (z >> S27)) * MIX_2) & MASK;
        return z ^ (z >> S31);
    }

    /** In [0, 1). */
    unit(): number {
        return Number(this.next() >> S11) / TWO_53;
    }

    /** A stable seed for an animal: the same slug, the same life (FNV-1a over its UTF-8 bytes). */
    static seed(slug: string): bigint {
        let hash = FNV_OFFSET;
        for (const byte of utf8(slug)) {
            hash ^= BigInt(byte);
            hash = (hash * FNV_PRIME) & MASK;
        }
        return hash;
    }
}

function utf8(text: string): number[] {
    if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(text));
    return Array.from(unescape(encodeURIComponent(text))).map((character) => character.charCodeAt(0));
}

/** What this model can do: a behaviour that needs a part it lacks never plays. */
export type BehaviourAbilities = {jaw: boolean; eyes: boolean; nose: boolean; tail: boolean};

export function canDo(kind: IdleBehaviour, abilities: BehaviourAbilities): boolean {
    switch (kind) {
        case "yawn":
        case "chew":
        case "call":
            return abilities.jaw;
        case "doze":
            return abilities.eyes;
        case "tail":
            return abilities.tail;
        default:
            return true;
    }
}

/**
 * Picks the next idle behaviour from the animal's profile and plays it.
 * Behaviours it does often come up more; it never repeats one twice running
 * when it has others; none starts while it is speaking or just after, and
 * one that uses the jaw stops the moment it speaks.
 */
export class BehaviourDirector {
    /** Quiet this long before a new behaviour starts. */
    static readonly quietBeforeStart = 1.5;

    private readonly weights: Array<[IdleBehaviour, number]>;
    /** Seconds between behaviours, on average. */
    private readonly gap: number;
    /** Duration multiplier: a slow animal yawns slowly. */
    private readonly pace: number;
    private readonly random: BehaviourRandom;
    private current: {kind: IdleBehaviour; start: number; direction: number} | null = null;
    private last: IdleBehaviour | null = null;
    private nextAt: number | null = null;
    private lastSpoke = -Infinity;

    constructor(behaviour: TalkingBehaviour | null | undefined, abilities: BehaviourAbilities, seed: bigint) {
        this.random = new BehaviourRandom(seed);
        const idle = behaviour?.idle ?? {};
        this.weights = [];
        for (const kind of IDLE_BEHAVIOURS) {
            const raw = idle[kind];
            const often = Math.max(0, Math.min(3, typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : 0));
            if (often <= 0 || !canDo(kind, abilities)) continue;
            // "Often" should dominate "rarely": 9 to 1, not 3 to 1.
            this.weights.push([kind, often * often]);
        }
        const tempo = behaviour?.tempo ?? "normal";
        const mostOften = this.weights.reduce((most, [, weight]) => Math.max(most, weight), 0);
        // Quieter animals (nothing they do often) pause longer.
        const restless = mostOften >= 9 ? 1.0 : mostOften >= 4 ? 1.2 : 1.45;
        this.gap = (tempo === "slow" ? 9.0 : tempo === "quick" ? 5.0 : 7.0) * restless;
        this.pace = tempo === "slow" ? 1.3 : tempo === "quick" ? 0.8 : 1.0;
    }

    /** The behaviour playing now, if any. */
    get playing(): IdleBehaviour | null {
        return this.current?.kind ?? null;
    }

    pose(time: number, speaking: boolean): BehaviourPose {
        if (speaking) this.lastSpoke = time;
        if (this.nextAt === null) this.nextAt = time + 2 + 3 * this.random.unit();
        const playing = this.current;
        if (playing) {
            const elapsed = time - playing.start;
            if (elapsed >= IDLE_DURATION[playing.kind] * this.pace || (speaking && usesMouth(playing.kind)) || elapsed < 0) {
                this.current = null;
                this.nextAt = time + this.nextGap();
            }
        }
        if (this.current === null && this.weights.length > 0 && this.nextAt !== null && time >= this.nextAt) {
            if (time - this.lastSpoke >= BehaviourDirector.quietBeforeStart) {
                const kind = this.pick();
                this.current = {kind, start: time, direction: this.random.unit() < 0.5 ? -1 : 1};
                this.last = kind;
            } else {
                this.nextAt = this.lastSpoke + BehaviourDirector.quietBeforeStart + this.random.unit() * 2;
            }
        }
        const now = this.current;
        if (!now) return restingPose();
        return BehaviourDirector.poseOf(now.kind, (time - now.start) / this.pace, now.direction);
    }

    private nextGap(): number {
        return this.gap * (0.6 + 0.8 * this.random.unit());
    }

    private pick(): IdleBehaviour {
        const choices = this.weights.length > 1 ? this.weights.filter(([kind]) => kind !== this.last) : this.weights;
        const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = this.random.unit() * total;
        for (const [kind, weight] of choices) {
            roll -= weight;
            if (roll < 0) return kind;
        }
        return choices[choices.length - 1][0];
    }

    /** 0 → 1 over `rise`, held, 1 → 0 over `fall` before `end`; smoothed. */
    static envelope(t: number, rise: number, fall: number, end: number): number {
        const smooth = (x: number) => {
            const c = Math.min(Math.max(x, 0), 1);
            return c * c * (3 - 2 * c);
        };
        if (!(t > 0 && t < end)) return 0;
        return Math.min(smooth(t / rise), smooth((end - t) / fall));
    }

    /** The pose of one behaviour `t` seconds in (at a normal tempo). */
    static poseOf(kind: IdleBehaviour, t: number, direction: number): BehaviourPose {
        const p = restingPose();
        const d = IDLE_DURATION[kind];
        const envelope = BehaviourDirector.envelope;
        const tau = 2 * Math.PI;
        switch (kind) {
            case "yawn": {
                const open = envelope(t, 0.9, 0.9, d);
                p.mouth = 1.7 * open;
                p.lid = 1 - 0.85 * envelope(t - 0.5, 0.3, 0.5, d - 0.6);
                p.pitch = -0.12 * open;
                p.stretch = 0.02 * open;
                p.sway = 1 - 0.6 * open;
                break;
            }
            case "sniff": {
                const on = envelope(t, 0.2, 0.3, d);
                p.nose = 1 + 0.18 * on * Math.abs(Math.sin(tau * 4.5 * t));
                p.pitch = 0.025 * on * (0.5 + 0.5 * Math.sin(tau * 4.5 * t));
                break;
            }
            case "look": {
                const turn = envelope(t, 0.8, 0.9, d);
                p.yaw = 0.32 * direction * turn;
                p.pitch = -0.02 * turn;
                break;
            }
            case "shake": {
                const fade = Math.max(0, 1 - t / d);
                p.roll = 0.09 * fade * Math.sin(tau * 7 * t);
                p.yaw = 0.03 * fade * Math.sin(tau * 7 * t + 1.1);
                p.sway = 0.3;
                break;
            }
            case "chew": {
                const on = envelope(t, 0.4, 0.4, d);
                p.mouth = 0.2 * on * (0.5 - 0.5 * Math.cos(tau * 1.6 * t));
                break;
            }
            case "doze": {
                const heavy = envelope(t, 1.2, 1.0, d);
                p.lid = 1 - 0.7 * heavy;
                p.pitch = 0.035 * heavy;
                p.sway = 1 - 0.7 * heavy;
                break;
            }
            case "startle": {
                // A jump that is over almost at once, then a held stillness.
                const jump = t < 0.35 ? Math.sin(Math.PI * t / 0.35) : 0;
                p.lift = 0.012 * jump;
                p.pitch = -0.04 * jump;
                p.sway = t < d ? 0.15 : 1;
                break;
            }
            case "bob": {
                const on = envelope(t, 0.1, 0.15, d);
                p.pitch = 0.06 * on * Math.sin(tau * 2 * t);
                break;
            }
            case "call": {
                const first = envelope(t - 0.15, 0.12, 0.15, 0.45);
                const second = envelope(t - 0.75, 0.12, 0.15, 0.45);
                p.mouth = 0.85 * Math.max(first, second);
                p.pitch = -0.03 * Math.max(first, second);
                break;
            }
            case "tail": {
                const on = envelope(t, 0.3, 0.5, d);
                p.tail = 0.35 * on * Math.sin(tau * 2.2 * t);
                break;
            }
        }
        return p;
    }
}

/** Plans with no head to keep still: the whole animal moves. */
export const WHOLE_BODY_PLANS = new Set(["jellyfish", "sessile", "worm", "cephalopod"]);

/** The body-motion shader's constants (`AnimalTalkingMotion` on iOS). */
export type MotionUniforms = {
    motionKind: number;
    motionAxis: number;
    motionAmp: number;
    motionOmega: number;
    motionWaves: number;
    motionStill: number;
    motionRear: number;
    motionSpan: number;
    motionBottom: number;
    motionTop: number;
    motionMidZ: number;
    tailBaseX: number;
    tailBaseZ: number;
    tailLength: number;
};

const MOTION_KINDS: Record<string, number> = {swim: 1, flap: 2, pulse: 3, sway: 4};

/** Null when the animal has nothing that moves this way. */
export function motionUniforms(behaviour: TalkingBehaviour | null | undefined): MotionUniforms | null {
    if (!behaviour || (!behaviour.motion && !behaviour.tail)) return null;
    const motion = behaviour.motion ?? null;
    const lowest = vector3(behaviour.extent?.min, -0.5);
    const highest = vector3(behaviour.extent?.max, 0.5);
    const still = behaviour.still_z ?? highest[2] - 0.2;
    const tailBase = behaviour.tail ? vector3(behaviour.tail.base, 0) : [0, 0, 0];
    return {
        motionKind: MOTION_KINDS[motion?.kind ?? ""] ?? 0,
        motionAxis: motion?.axis === "y" ? 1 : 0,
        motionAmp: motion?.amplitude ?? 0,
        motionOmega: 2 * Math.PI / Math.max(motion?.period ?? 1, 0.2),
        motionWaves: motion?.waves ?? 0,
        motionStill: still,
        motionRear: lowest[2],
        motionSpan: behaviour.span ?? Math.max(Math.abs(lowest[0]), Math.abs(highest[0])),
        motionBottom: lowest[1],
        motionTop: highest[1],
        motionMidZ: (lowest[2] + highest[2]) / 2,
        tailBaseX: tailBase[0],
        tailBaseZ: tailBase[2],
        tailLength: behaviour.tail?.length ?? 0
    };
}

function vector3(raw: number[] | null | undefined, fallback: number): [number, number, number] {
    const at = (index: number) => (Array.isArray(raw) && Number.isFinite(raw[index]) ? Number(raw[index]) : fallback);
    return [at(0), at(1), at(2)];
}

/**
 * The motion in the model's space, as the GLSL in the renderer runs it, for
 * the tests and for anything drawn beside the body (iOS `motionBody`).
 */
export function movedPoint(
    point: [number, number, number],
    u: MotionUniforms,
    clock: number,
    gain: number,
    tailAngle: number
): [number, number, number] {
    let [x, y, z] = point;
    const bodyRun = Math.max(u.motionStill - u.motionRear, 0.001);
    const along = Math.min(Math.max((u.motionStill - z) / bodyRun, 0), 1);
    const beat = clock * u.motionOmega;
    const height = Math.min(Math.max((y - u.motionBottom) / Math.max(u.motionTop - u.motionBottom, 0.001), 0), 1);
    if (u.motionKind > 0.5 && u.motionKind < 1.5) {
        const bend = u.motionAmp * gain * along * along * Math.sin(beat - along * u.motionWaves * 6.28318);
        if (u.motionAxis < 0.5) x += bend;
        else y += bend;
    } else if (u.motionKind > 1.5 && u.motionKind < 2.5) {
        const reach = Math.min(Math.max((Math.abs(x) - u.motionSpan * 0.2) / Math.max(u.motionSpan * 0.8, 0.001), 0), 1);
        y += u.motionAmp * gain * u.motionSpan * reach * reach * Math.sin(beat - reach * u.motionWaves * 6.28318);
    } else if (u.motionKind > 2.5 && u.motionKind < 3.5) {
        const squeeze = 1 + u.motionAmp * gain * Math.sin(beat) * (0.3 + 0.7 * height);
        x *= squeeze;
        z = u.motionMidZ + (z - u.motionMidZ) * squeeze;
        y += u.motionAmp * gain * 0.25 * (1 - height) * Math.sin(beat - 1.2) * (u.motionTop - u.motionBottom);
    } else if (u.motionKind > 3.5) {
        // As the shader does: the sideways sway first, then the fore-and-aft from where it now is.
        x += u.motionAmp * gain * height * height * Math.sin(beat + z * 4);
        z += u.motionAmp * gain * 0.5 * height * height * Math.cos(beat * 0.7 + x * 3);
    }
    if (u.tailLength > 0 && z < u.tailBaseZ) {
        const into = Math.min(Math.max((u.tailBaseZ - z) / u.tailLength, 0), 1);
        const swing = tailAngle * into;
        const dx = x - u.tailBaseX;
        const dz = z - u.tailBaseZ;
        const c = Math.cos(swing);
        const s = Math.sin(swing);
        x = u.tailBaseX + dx * c - dz * s;
        z = u.tailBaseZ + dx * s + dz * c;
    }
    return [x, y, z];
}
