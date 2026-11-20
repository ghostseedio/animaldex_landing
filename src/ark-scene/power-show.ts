/**
 * Powers you can see (AnimalDex decision 420, phase 1, owner 2026-11-20): an animal whose Power is earned shows that
 * Power working. Each kind's real Animal Power is sorted into one visible survival mechanism (`power-table.ts`), and
 * the scene draws it at the strength of the animal's thrive band (`thrive.ts`): prime clearly, good partly, ordinary
 * not at all.
 *
 *   | mechanism  | always (at its band)                          | a predator near it, or a hunter searching near it      |
 *   | camouflage | its coat blends toward the ground it stands on | it holds still (the local layer's flight is held)      |
 *   | warning    | its own pattern brighter and bolder             | it holds its ground; a searching hunter turns away    |
 *   | mimicry    | the mimicked look (bands, eyespots, a tint)     | the same, stronger; a feigner goes over onto its side |
 *   | speed      |                                                 | a quick dart away from it                              |
 *   | armour     |                                                 | it curls, draws into its shell or swells (the defence |
 *   |            |                                                 | moves' own shapes, `defence-moves.ts`)                |
 *   | vigilance  |                                                 | head up in the alarm pose; others of its kind look up |
 *   | group      |                                                 | it closes ranks with its own kind near it             |
 *   | hiding     |                                                 | it ducks down into its cover                          |
 *   | climb      |                                                 | it goes away and up (a flyer lifts off the ground)    |
 *
 * The hunt (decision 389's released states only): a hunter the read says is `searching` or `stalking` (E6's
 * `animal.state`, behind `visible_searching`), drawn near a prime animal it could eat, looks at it, and passes it over:
 * its head turns away and its body after it, while that animal shows its Power. The engine's own rule is the reason
 * (prime is hunted last); nothing here decides anything, and a stalking hunter's own `target` is never passed over.
 * The read is the released one (`seen/hooks.ts`): no state dated after now is used.
 *
 * Visual only, deterministic (the shared clock, the server's band, the read), never a glow, halo, outline, badge or
 * label over the animal (thrive.ts' NEVER list): the coat changes as a coat would. Loaded lazily by the scene
 * (`index.ts`) the first time a read has an animal above ordinary; nothing of it is in /ark's first JavaScript.
 *
 * Drawn through channels the scene already has: positions and turns on the pose (as the reactive layer's), the
 * defence moves' packed shapes in `arkInstance.w`, the head look, and the per-animal colour (`ark-variation.ts`:
 * `arkVary.x` carries the amount in whole turns of its hue, which the hue's rotation ignores, and the species
 * material's `arkPower` uniform the look). The vary channel is used rather than the animal-look pass's coat because
 * the look pass is off on the low tier and on far models; this one is on everywhere.
 */

import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {DEFENCE_KIND, defenceMoveOf, defencePack, newDefenceState, packDefence, predatorBeside, type NearbyAnimal} from "@/ark-scene/defence-moves";
import {clampLook, headLimits} from "@/ark-scene/head-look";
import {canEat, intelProfile} from "@/ark-scene/intelligence-profile";
import {ZONE_PALETTES} from "@/ark-scene/palettes";
import {arkPowerOf, arkPowerStrength, type ArkPower, type ArkPowerMechanism} from "@/ark-scene/power-table";
import {arkSeenStates} from "@/ark-scene/seen/hooks";
import type {ArkAnimal, ArkSnapshot, ArkThrive} from "@/ark-scene/types";

/** The shader's looks (`ark-variation.ts` FRAGMENT): what `arkPower.w` says. */
export const POWER_LOOK = {camouflage: 1, warning: 2, bands: 3, eyes: 4, tint: 5} as const;

/** What the scene draws for one animal this frame. */
export type ArkPowerFrame = {
    mechanism: ArkPowerMechanism | null;
    /** 0 … 1: how far its Power is showing now (its band's strength at most). */
    react: number;
    /** Its coat's amount for the shader, 0 … 15 (whole turns of `arkVary.x`), and the species' look (linear rgb, mode). */
    q: number;
    look: [number, number, number, number] | null;
    /** A defence shape for `arkInstance.w` (`packDefence`), or 0. */
    pack: number;
    /** 0 … 1: how much of the local reactive layer's flight it holds back (camouflage, warning). */
    still: number;
    /** Its head look (yaw, pitch, weight), or null: the scene's own. */
    head: [number, number, number] | null;
    /** (Internal.) A predator beside it at the last check, and when to check again. */
    threat: number;
    check: number;
    /** (Internal.) Who it is threatened by now (a point), for a dart's direction. */
    fromX: number;
    fromZ: number;
};

/** One drawn animal, as the scene's candidate list has it (only what is read here). */
export type ArkPowerCandidate = {
    entry: {
        animal: ArkAnimal;
        length: number;
        thrive: ArkThrive;
        place: {canopy?: unknown; micro?: unknown; burrow?: unknown};
        state: {asleep: boolean};
        sched?: {profile: {size: number | null}} | null;
        act?: unknown;
        visitor?: unknown;
        power?: ArkPowerFrame | null;
        powerKind?: ArkPower | false;
    };
    distance: number;
    pose: {x: number; z: number; base: number; yaw: number; pitch: number; roll: number; afloat: boolean};
    modelHeight: number;
    model?: {behaviour?: {plan?: string} | null} | null;
};

export type ArkPowerWorld = {
    /** The shared clock (s). */
    now: number;
    /** Motion on (off with reduced motion, or the lite tier): the looks only. */
    motion: boolean;
    /** Moves a pose by (dx, dz) within its element, as the reactive layer's offsets are (`offsetShare`). */
    shift: (c: ArkPowerCandidate, dx: number, dz: number) => void;
};

export type ArkPowerShow = {
    snapshot: (snapshot: ArkSnapshot) => void;
    step: (list: readonly ArkPowerCandidate[], dt: number, world: ArkPowerWorld) => void;
    /** The animals showing a Power now (the harness and the tests). */
    report: () => {showing: number; passing: number; hunters: number; pass: [string, string] | null};
    dispose: () => void;
};

/** Within this of a searching hunter (m), a kind it could eat shows its Power; a prime one is passed over. */
export const SEARCH_NEAR = 25;
/** A hunter's pass: every PASS_PERIOD s (its own phase), it looks at the prime one from PASS_LOOK, turns away from PASS_AWAY to PASS_END. */
export const PASS_PERIOD = 18;
const PASS_LOOK = 1.5;
const PASS_AWAY = 4.5;
const PASS_END = 9;
/** A predator check every this long (s) per animal: the reactive layer's flight distance (`predatorBeside`). */
const CHECK_EVERY = 0.25;
/** Rates (a share a second) its Power comes on and eases off. */
const RISE = 2.6;
const FALL = 0.45;
const PLANS_FLYING = new Set(["flying_bird", "bat", "flying_insect"]);

const lin = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v: number) => Math.pow(v / 255, 2.2);
    return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
};
const smooth = (a: number, b: number, t: number) => {
    const k = Math.min(Math.max((t - a) / (b - a), 0), 1);
    return k * k * (3 - 2 * k);
};
const seedOf = (id: string) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
};

/** The ground it blends toward: its zone's ground, or what grows there when it lives up in it. */
function groundColour(animal: ArkAnimal, up: boolean): [number, number, number] {
    const palette = (ZONE_PALETTES as Record<string, {ground: readonly [string, string]; growth: readonly [string, string]}>)[animal.zone] ?? ZONE_PALETTES.grassland;
    return lin(up ? palette.growth[0] : palette.ground[0]);
}

/** The coat's look for a mechanism, or null (one that shows only in its moves). */
export function powerLook(power: ArkPower, animal: ArkAnimal, up: boolean): [number, number, number, number] | null {
    switch (power.mechanism) {
        case "camouflage":
            return [...groundColour(animal, up), POWER_LOOK.camouflage];
        case "warning":
            return [0, 0, 0, POWER_LOOK.warning];
        case "mimicry": {
            const mimic = power.mimic;
            if (!mimic || mimic.kind === "feign") return null;
            const colour = lin(mimic.colour ?? "#e2b02a");
            return [...colour, mimic.kind === "bands" ? POWER_LOOK.bands : mimic.kind === "eyes" ? POWER_LOOK.eyes : POWER_LOOK.tint];
        }
        default:
            return null;
    }
}

/** How much of the coat shows at rest and when it is showing (a share of its band's strength). */
export function coatShare(mechanism: ArkPowerMechanism, react: number, strength: number): number {
    if (strength <= 0) return 0;
    const shown = Math.min(react / strength, 1);
    if (mechanism === "camouflage") return strength * (0.75 + 0.25 * shown);
    if (mechanism === "warning" || mechanism === "mimicry") return strength * (0.6 + 0.4 * shown);
    return 0;
}

/** An armoured kind's shape: its own defence move when it has one, else by its body plan (a shell, a swell, a ball). */
export function armourPack(slug: string, plan: string | null | undefined, amount: number): number {
    if (amount <= 0.004) return 0;
    const own = defenceMoveOf(slug);
    if (own && own.move !== "tail" && own.move !== "flash") {
        const state = newDefenceState();
        state.amount = amount;
        return defencePack(state, own, plan);
    }
    if (plan === "turtle") return packDefence(DEFENCE_KIND.shell, amount, 0);
    if (plan === "fish" || plan === "eel") return packDefence(DEFENCE_KIND.puff, amount, 1);
    if (plan === "amphibian" || plan === "frog") return packDefence(DEFENCE_KIND.puff, amount, 0);
    if (plan === "legless") return packDefence(DEFENCE_KIND.coil, amount, 0);
    return packDefence(DEFENCE_KIND.curl, amount, 0);
}

/** A hunter's pass over a prime animal at time `t` into its period: [looking at it 0…1, turned away 0…1]. */
export function passPhase(t: number): [number, number] {
    const look = smooth(PASS_LOOK - 0.5, PASS_LOOK + 0.6, t) * (1 - smooth(PASS_AWAY - 0.3, PASS_AWAY + 0.5, t));
    const away = smooth(PASS_AWAY - 0.3, PASS_AWAY + 1.2, t) * (1 - smooth(PASS_END - 1.2, PASS_END, t));
    return [look, away];
}

/**
 * Development's contact sheets only (`scripts/ark-power-sheets.mjs`): every animal showing a Power counts as
 * threatened, and a predator drawn near a prime one it could eat is taken for a searching hunter, so each mechanism
 * and the pass can be filmed while the live read has no prime animals and no hunts. Never set by the site.
 */
const demo = () => Boolean((globalThis as {__arkPowerDemo?: boolean}).__arkPowerDemo);

const frameOf = (): ArkPowerFrame => ({mechanism: null, react: 0, q: 0, look: null, pack: 0, still: 0, head: null, threat: 0, check: 0, fromX: 0, fromZ: 0});

type Hunter = {id: string; target: string | null; since: number | null};

export function createArkPowerShow(): ArkPowerShow {
    let hunters = new Map<string, Hunter>();
    const frames = new Map<string, ArkPowerFrame>();
    // (A hunter's or an alerted neighbour's look, for one with no Power of its own showing: kept, not made each frame.)
    const aux = new Map<string, ArkPowerFrame>();
    const auxOf = (c: ArkPowerCandidate): ArkPowerFrame => {
        if (c.entry.power) return c.entry.power;
        let f = aux.get(c.entry.animal.id);
        if (!f) aux.set(c.entry.animal.id, (f = frameOf()));
        f.head = null;
        c.entry.power = f;
        return f;
    };
    let showing = 0;
    let passing = 0;
    let lastPass: [string, string] | null = null;
    let nearby: NearbyAnimal[] | null = null;
    let nearbyAt = -1;

    const nearbyOf = (list: readonly ArkPowerCandidate[], now: number): NearbyAnimal[] => {
        if (nearby && now - nearbyAt < CHECK_EVERY && now >= nearbyAt) return nearby;
        const out: NearbyAnimal[] = [];
        for (const c of list) {
            const e = c.entry;
            if (e.visitor || e.place.micro || e.place.burrow) continue;
            out.push({slug: e.animal.model_slug, size: e.sched?.profile.size ?? null, intel: intelProfile(e.animal.model_slug), asleep: e.state.asleep, shared: {x: c.pose.x, z: c.pose.z, aloft: false}});
        }
        nearby = out;
        nearbyAt = now;
        return out;
    };

    return {
        snapshot: (snapshot) => {
            const next = new Map<string, Hunter>();
            for (const state of arkSeenStates(snapshot)) {
                if (state.kind !== "searching" && state.kind !== "stalking") continue;
                next.set(state.id, {id: state.id, target: state.target, since: state.since});
            }
            hunters = next;
        },
        step: (list, dt, world) => {
            const now = world.now;
            showing = 0;
            passing = 0;
            const ids = new Map<string, ArkPowerCandidate>();
            for (const c of list) ids.set(c.entry.animal.id, c);
            // 1. Each animal with a Power above ordinary: is anything that could eat it beside it?
            const seen = new Set<string>();
            for (const c of list) {
                const e = c.entry;
                const kind = (e.powerKind ??= arkPowerOf(e.animal) ?? false);
                const strength = kind ? arkPowerStrength(e.thrive) : 0;
                if (!kind || strength <= 0 || e.visitor) {
                    e.power = null;
                    continue;
                }
                let f = frames.get(e.animal.id);
                if (!f) frames.set(e.animal.id, (f = frameOf()));
                f.mechanism = kind.mechanism;
                seen.add(e.animal.id);
                e.power = f;
                f.check -= dt;
                if (f.check <= 0 && !e.act && !e.state.asleep) {
                    f.check = CHECK_EVERY;
                    const others = nearbyOf(list, now);
                    f.threat = predatorBeside(e.animal.model_slug, c.pose.x, c.pose.z, others) ? strength : 0;
                    if (f.threat) {
                        // (The nearest that could eat it: the dart's direction.)
                        const me = intelProfile(e.animal.model_slug);
                        let best = Infinity;
                        for (const o of others) {
                            const d = Math.hypot(o.shared.x - c.pose.x, o.shared.z - c.pose.z);
                            if (d < best && d > 0.01 && !o.asleep && canEat(o.intel, me, o.size, e.sched?.profile.size ?? null)) {
                                best = d;
                                f.fromX = o.shared.x;
                                f.fromZ = o.shared.z;
                            }
                        }
                    }
                } else if (e.act || e.state.asleep) f.threat = 0;
                if (demo() && !f.threat) {
                    f.threat = strength;
                    f.fromX = c.pose.x + 6;
                    f.fromZ = c.pose.z;
                }
            }
            // 2. The released hunt: a searching or stalking hunter drawn here, and the kinds it could eat near it.
            const passes = new Map<string, {prey: ArkPowerCandidate; look: number; away: number}>();
            let searching = Array.from(hunters.values());
            if (demo()) {
                const extra: Hunter[] = [];
                for (const c of list) {
                    if (hunters.has(c.entry.animal.id) || c.entry.state.asleep) continue;
                    const ci = intelProfile(c.entry.animal.model_slug);
                    const near = list.some((o) => o.entry.thrive === "prime" && o.entry.power && Math.hypot(o.pose.x - c.pose.x, o.pose.z - c.pose.z) < SEARCH_NEAR && canEat(ci, intelProfile(o.entry.animal.model_slug), c.entry.sched?.profile.size ?? null, o.entry.sched?.profile.size ?? null));
                    if (near) extra.push({id: c.entry.animal.id, target: null, since: null});
                }
                searching = searching.concat(extra);
            }
            if (searching.length) {
                for (const hunter of searching) {
                    // (No look-ahead: a state dated after the shared clock's now is not acted.)
                    if (hunter.since !== null && hunter.since > now + 5) continue;
                    const h = ids.get(hunter.id);
                    if (!h || h.entry.state.asleep) continue;
                    const hi = intelProfile(h.entry.animal.model_slug);
                    let prime: ArkPowerCandidate | null = null;
                    let primeD = Infinity;
                    for (const c of list) {
                        const f = c.entry.power;
                        if (!f || c === h || c.entry.animal.id === hunter.target) continue;
                        const d = Math.hypot(c.pose.x - h.pose.x, c.pose.z - h.pose.z);
                        if (d > SEARCH_NEAR) continue;
                        if (!canEat(hi, intelProfile(c.entry.animal.model_slug), h.entry.sched?.profile.size ?? null, c.entry.sched?.profile.size ?? null)) continue;
                        const strength = arkPowerStrength(c.entry.thrive);
                        f.threat = Math.max(f.threat, strength);
                        f.fromX = h.pose.x;
                        f.fromZ = h.pose.z;
                        if (c.entry.thrive === "prime" && d < primeD) {
                            prime = c;
                            primeD = d;
                        }
                    }
                    if (!prime) continue;
                    const t = (((now + seedOf(hunter.id) * PASS_PERIOD) % PASS_PERIOD) + PASS_PERIOD) % PASS_PERIOD;
                    const [look, away] = passPhase(t);
                    if (look > 0.001 || away > 0.001) passes.set(hunter.id, {prey: prime, look, away});
                }
            }
            // 3. Ease each one's Power and draw it.
            const alerts: Array<[ArkPowerCandidate, number]> = [];
            for (const c of list) {
                const f = c.entry.power;
                if (!f || !f.mechanism) continue;
                const e = c.entry;
                const kind = e.powerKind as ArkPower;
                const strength = arkPowerStrength(e.thrive);
                f.react = f.threat > f.react ? Math.min(f.react + dt * RISE, f.threat) : Math.max(f.react - dt * FALL, f.threat);
                f.react = Math.min(f.react, strength);
                const r = world.motion ? f.react : 0;
                const coat = coatShare(f.mechanism, f.react, strength);
                f.q = Math.round(Math.min(coat, 1) * 15);
                f.look = f.q > 0 ? powerLook(kind, e.animal, Boolean(e.place.canopy)) : null;
                f.pack = 0;
                f.still = 0;
                f.head = null;
                if (f.react > 0.02 || f.q > 0) showing++;
                if (r <= 0.004) continue;
                const p = c.pose;
                const len = Math.max(e.length, 0.05);
                const awayX = p.x - f.fromX;
                const awayZ = p.z - f.fromZ;
                const awayD = Math.hypot(awayX, awayZ) || 1;
                switch (f.mechanism) {
                    case "camouflage":
                    case "warning":
                        f.still = r;
                        break;
                    case "speed": {
                        const reach = Math.min(Math.max(len * 3.2, 0.6), 6) * r;
                        world.shift(c, (awayX / awayD) * reach, (awayZ / awayD) * reach);
                        break;
                    }
                    case "climb": {
                        const reach = Math.min(Math.max(len * 2.2, 0.5), 4) * r;
                        world.shift(c, (awayX / awayD) * reach, (awayZ / awayD) * reach);
                        // (Nose up, as the take-off block's; a flyer lifts off the ground.)
                        p.pitch += (BLOCKS.take_off?.pitch ?? -0.35) * r;
                        const plan = c.model?.behaviour?.plan ?? intelProfile(e.animal.model_slug).plan;
                        if (PLANS_FLYING.has(plan) && !p.afloat) p.base += Math.min(len * 1.4, 2.5) * r;
                        break;
                    }
                    case "armour":
                        f.pack = armourPack(e.animal.model_slug, c.model?.behaviour?.plan ?? null, r);
                        f.still = r;
                        break;
                    case "hiding": {
                        // Down into its cover, as the bury block's heave (body lengths), never deeper than most of its height.
                        const heave = Math.abs(BLOCKS.bury?.heave ?? 0.45);
                        p.base -= Math.min(heave * len, c.modelHeight * 0.7) * r;
                        f.still = r;
                        break;
                    }
                    case "vigilance": {
                        // Head up, the alarm pose (the call block's attitude); others of its kind near it look up too.
                        const limits = headLimits(intelProfile(e.animal.model_slug).plan, e.animal.model_slug);
                        f.head = [0, clampLook({yaw: 0, pitch: 0.55}, limits).pitch, r];
                        p.pitch += (BLOCKS.call?.pitch ?? -0.3) * 0.6 * r;
                        alerts.push([c, r]);
                        break;
                    }
                    case "group": {
                        let sx = 0;
                        let sz = 0;
                        let n = 0;
                        for (const o of list) {
                            if (o.entry.animal.model_slug !== e.animal.model_slug) continue;
                            if (Math.hypot(o.pose.x - p.x, o.pose.z - p.z) > Math.max(12, len * 10)) continue;
                            sx += o.pose.x;
                            sz += o.pose.z;
                            n++;
                        }
                        if (n > 1) world.shift(c, (sx / n - p.x) * 0.45 * r, (sz / n - p.z) * 0.45 * r);
                        // (Facing out, toward what threatens it.)
                        break;
                    }
                    case "mimicry":
                        if (kind.mimic?.kind === "feign") {
                            // Over onto its side, still, as the roll block's (feigning death; a plover's broken wing reads the same from afar).
                            p.roll += Math.min(BLOCKS.roll?.roll ?? 1.6, 1.45) * r;
                            p.base -= c.modelHeight * 0.25 * r;
                        }
                        f.still = r;
                        break;
                }
            }
            // Its alarm: others of its kind near it look up too (less than it does).
            for (const [c, r] of alerts) {
                const slug = c.entry.animal.model_slug;
                const limits = headLimits(intelProfile(slug).plan, slug);
                for (const o of list) {
                    if (o === c || o.entry.animal.model_slug !== slug || o.entry.state.asleep) continue;
                    if (Math.hypot(o.pose.x - c.pose.x, o.pose.z - c.pose.z) > 15) continue;
                    const of = auxOf(o);
                    if ((of.head?.[2] ?? 0) >= r * 0.6) continue;
                    of.head = [0, clampLook({yaw: 0, pitch: 0.4}, limits).pitch, r * 0.6];
                }
            }
            // 4. The hunters passing a prime one over: a look at it, then the head and the body turned away.
            for (const [id, pass] of Array.from(passes)) {
                const h = ids.get(id);
                if (!h) continue;
                passing++;
                lastPass = [id, pass.prey.entry.animal.id];
                const hf = auxOf(h);
                const toYaw = Math.atan2(pass.prey.pose.x - h.pose.x, pass.prey.pose.z - h.pose.z);
                let rel = toYaw - h.pose.yaw;
                rel = Math.atan2(Math.sin(rel), Math.cos(rel));
                const limits = headLimits(intelProfile(h.entry.animal.model_slug).plan, h.entry.animal.model_slug);
                const side = rel >= 0 ? 1 : -1;
                const yaw = clampLook({yaw: rel * pass.look - side * limits.yaw * 0.8 * pass.away, pitch: 0}, limits).yaw;
                hf.head = [yaw, 0, Math.max(pass.look, pass.away)];
                if (world.motion) h.pose.yaw -= side * 0.55 * pass.away;
            }
            // (Frames of animals no longer drawn here are let go.)
            if (frames.size > seen.size + 64) for (const id of Array.from(frames.keys())) if (!seen.has(id)) frames.delete(id);
            if (aux.size > 256) aux.clear();
        },
        report: () => ({showing, passing, hunters: hunters.size, pass: lastPass}),
        dispose: () => {
            frames.clear();
            aux.clear();
            hunters.clear();
            nearby = null;
        }
    };
}
