/**
 * Powers you can see (decision 420): the stable hook other lanes plug their acts into (SIG-DEFENCE, POWERCLIP-*).
 * Dependency-free on purpose, so a lane can register from its own module without pulling the Power layer in.
 *
 * An act is named. `power-show.ts` picks one name per species, in this order:
 *   1. a name bound to the species here (`bindArkPowerAct`), when that name is registered;
 *   2. `defence:<move>`: its sourced defence move (`defence-moves.json`, decision 367's catalogue);
 *   3. `recipe:<template>`: a catalogue recipe it has that matches its mechanism (`bury_sand`, `dig_burrow`, `cluster`,
 *      `swarm`), played on demand from the moment its Power shows, not on the shared schedule;
 *   4. `generic:<mechanism>`: the layer's own pose for the mechanism.
 * A registered act's output replaces the generic pose for that frame; returning null falls through to the generic one.
 *
 *   registerArkPowerAct("clip:pangolin_roll", (input) => ({state: "roll_ball", still: input.amount, drop: 0.3 * input.amount * input.height}));
 *   bindArkPowerAct("sunda-pangolin", "clip:pangolin_roll");
 */

export type ArkPowerActInput = {
    slug: string;
    mechanism: string;
    /** 0 … 1: how far its Power is showing now (its band's strength at most). */
    amount: number;
    /** Seconds since its Power began showing this time. */
    t: number;
    /** Its body plan (`behaviour.plan`), or null. */
    plan: string | null;
    /** Body length and drawn height (m). */
    length: number;
    height: number;
};

export type ArkPowerActOut = {
    /** A defence shape for `arkInstance.w` (`packDefence`). */
    pack?: number;
    /** Added to the body's pitch and roll (rad). */
    pitch?: number;
    roll?: number;
    /** Down (m; negative: up), after grounding. */
    drop?: number;
    /** 0 … 1: how much of the reactive layer's flight it holds back. */
    still?: number;
    /** Turn its back to the threat (`away`) or face it (`face`), by `amount`. */
    turn?: "away" | "face" | null;
    /** A rig state to play (an `ARK_RECIPE_STATES` name or a lane's own clip state). */
    state?: string | null;
    /** An ambient flock drawn round it (the recipes' crawling cluster or swarm). */
    flock?: "cluster" | "swarm" | null;
};

export type ArkPowerAct = (input: ArkPowerActInput) => ArkPowerActOut | null;

type Registry = {acts: Map<string, ArkPowerAct>; bound: Map<string, string>; version: number};

// (On globalThis: one registry however the chunks split.)
const registry = (): Registry => {
    const g = globalThis as {__arkPowerActs?: Registry};
    return (g.__arkPowerActs ??= {acts: new Map(), bound: new Map(), version: 0});
};

export function registerArkPowerAct(name: string, act: ArkPowerAct): void {
    const r = registry();
    r.acts.set(name, act);
    r.version++;
}

export function bindArkPowerAct(slug: string, name: string): void {
    const r = registry();
    r.bound.set(slug, name);
    r.version++;
}

export function arkPowerAct(name: string): ArkPowerAct | null {
    return registry().acts.get(name) ?? null;
}

/** The name bound to a species, when its act is registered. */
export function boundArkPowerAct(slug: string): string | null {
    const r = registry();
    const name = r.bound.get(slug);
    return name && r.acts.has(name) ? name : null;
}

/** Changes when anything is registered or bound (so a per-species choice can be cached until then). */
export function arkPowerActsVersion(): number {
    return registry().version;
}
