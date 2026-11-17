/**
 * "See it in the Ark" (owner, 2026-11-17): the one entry the web page and both apps use to open the Ark on a person's
 * own animal and follow it. A selection by animal id already existed (`ark:select {id, closeUp}`, `?focus=<id>`); this
 * adds what the capture's button needs on top, without a second way to find an animal:
 *
 * - `follow`: the camera keeps the animal in the middle as it goes about (the scene's own `follow`, the web's Follow
 *   button), instead of looking at where it stood;
 * - `arrival`: the first time a person's animal comes aboard, the Ark acts the arrival out: the animal is held out of
 *   sight, the camera flies to the close look the scene picks for it (a clear view, never behind a tree), and when the
 *   camera has landed the animal comes aboard in front of it with the entrance's grow and ripple (`hold` and `arrive`,
 *   the clip recorder's new arrival), the camera following it as it goes off into its habitat. A scene without those
 *   falls back to the replay's own arrival act (`play`).
 *
 * Loaded with the scene (the embed's bundle, the page's scene chunk), never with the page's own code.
 */

import type {ArkAnimal, ArkReplayRun} from "@/ark-scene/types";
import type {ArkAct, ArkEventAnimal} from "@/lib/ark-life";

/** What a host (the embed's `ark:select`, or the page's `?focus=`) can ask for. */
export type ArkSeeItAsk = {
    id?: string | null;
    closeUp?: boolean;
    /** The camera follows it after the flight there. */
    follow?: boolean;
    /** Act the arrival out first (the first time a person's animal comes aboard). */
    arrival?: boolean;
};

/** The parts of the scene (or the archipelago's handle) this needs. */
export type ArkSeeItScene = {
    select: (id: string | null, closeUp?: boolean) => void;
    follow: (id: string | null) => void;
    play?: (acts: ArkAct[]) => ArkReplayRun | undefined;
    /** Keep an animal out of sight until `arrive` (the clip recorder's new arrival); an animal not in the scene is ignored. */
    hold?: (id: string) => void;
    /** A held animal comes aboard now, with the entrance's grow and ripple. */
    arrive?: (id: string) => void;
    /** A selection's flight being held until the animal can be seen; null when none is. */
    flightHeld?: () => {steps: number; done: number} | null;
    /** The animal selected and the one followed now (null: none): a follow asked of an animal the scene does not hold yet is dropped, so it is asked again. */
    selection?: () => {selected: string | null; followed: string | null};
    /** The archipelago's handle: resolves once the scene is built (before it, `play` is not there to run). */
    mounted?: () => Promise<void>;
};

/** An animal as the scene's acts name it (what the clips recorder's arrival shot builds too). */
export function arkActAnimalOf(animal: ArkAnimal): ArkEventAnimal {
    return {
        id: animal.id,
        species_profile_id: animal.species_profile_id,
        name: animal.name,
        model_slug: animal.model_slug,
        zone: animal.zone,
        arrived_at: animal.arrived_at,
        origin: animal.origin ?? null,
        generation: animal.generation ?? null,
        slot: animal.slot ?? null,
        slot_rank: animal.slot_rank ?? null,
        activity: animal.activity ?? null,
        sociality: animal.sociality ?? null,
        status: "present",
        thrive: animal.thrive ?? null,
        area: animal.area ?? null
    };
}

/** The arrival act for an animal already in the snapshot. */
export function arkArrivalActOf(animal: ArkAnimal): ArkAct {
    return {kind: "arrival", at: animal.arrived_at, animal: arkActAnimalOf(animal)};
}

/** How long the flight to the close look takes in the scene (`select`: 1.6 s), and a little over for the clear-view search. */
export const ARK_SEE_IT_LANDING_MS = 1900;
/** A follow the scene dropped (a town animal before the town has joined) is asked again this often, for this long. */
export const ARK_SEE_IT_FOLLOW_RETRY_MS = 500;
export const ARK_SEE_IT_FOLLOW_GIVE_UP_MS = 60_000;

/** The longest the animal is kept out of sight waiting for the camera (a slow phone building its models): then it comes aboard anyway. */
export const ARK_SEE_IT_HOLD_MAX_MS = 45_000;

/** What the ask comes to: the arrival is acted only when asked, with an animal to act, and never under reduced motion. */
export function arkSeeItPlan(ask: ArkSeeItAsk, animal: ArkAnimal | null, reducedMotion: boolean): {act: ArkAct | null; follow: boolean; closeUp: boolean} {
    const arrival = Boolean(ask.arrival && ask.id && animal && animal.id === ask.id && !reducedMotion);
    return {
        act: arrival && animal ? arkArrivalActOf(animal) : null,
        // The arrival's end is always a close look at the animal, followed.
        follow: Boolean(ask.follow || arrival),
        closeUp: Boolean(ask.closeUp || arrival)
    };
}

/**
 * Opens the scene on the animal as asked. `animal` is the animal from the snapshot the host shows (null when it is not
 * in it: then a plain selection, which the scene holds until the animal is there). Returns when the first move is made;
 * the arrival's later moves follow on their own. `clock` is for the tests.
 */
export function arkSeeIt(
    scene: ArkSeeItScene,
    ask: ArkSeeItAsk,
    animal: ArkAnimal | null,
    reducedMotion = false,
    clock: {now: () => number; later: (run: () => void, ms: number) => void} = {now: () => Date.now(), later: (run, ms) => void setTimeout(run, ms)}
): void {
    const id = ask.id || null;
    if (!id) {
        scene.select(null, false);
        return;
    }
    const plan = arkSeeItPlan(ask, animal, reducedMotion);
    // Followed: asked now, and asked again while the scene has not taken it (an animal on the town island is not held by
    // the scene until the town has joined: the selection waits for it, and so does the follow). Once taken it is left
    // alone, so a drag that ends the follow is never undone; someone else chosen meanwhile ends the asking.
    const followWhenHeld = () => {
        const asked = clock.now();
        const ask = () => {
            const now = scene.selection?.();
            if (now && (now.selected !== id || now.followed === id)) return;
            // (The archipelago's handle answers nothing until its scene is up, and queues what it is told: ask once it does.)
            if (!scene.selection || now) scene.follow(id);
            if (scene.selection && clock.now() - asked < ARK_SEE_IT_FOLLOW_GIVE_UP_MS) clock.later(ask, ARK_SEE_IT_FOLLOW_RETRY_MS);
        };
        ask();
    };
    const settle = () => {
        scene.select(id, plan.closeUp);
        if (plan.follow) followWhenHeld();
    };
    if (!plan.act) {
        settle();
        return;
    }
    const act = plan.act;
    // The scene's own hold and arrive: the camera lands first, then the animal comes aboard in front of it.
    const staged = () => {
        scene.hold?.(id);
        settle();
        const asked = clock.now();
        let landed: number | null = null;
        let arrived = false;
        const arrive = () => {
            if (arrived) return;
            arrived = true;
            scene.arrive?.(id);
        };
        const look = () => {
            if (arrived) return;
            const now = clock.now();
            if (now - asked > ARK_SEE_IT_HOLD_MAX_MS) {
                arrive();
                return;
            }
            // The flight is held while the animal cannot be drawn yet (the behaviour world, its models): once it is not,
            // the camera is on its way, and lands a moment later.
            if (landed === null && now - asked >= 400 && !scene.flightHeld?.()) landed = now;
            if (landed !== null && now - landed >= ARK_SEE_IT_LANDING_MS) {
                arrive();
                return;
            }
            clock.later(look, 120);
        };
        clock.later(look, 120);
    };
    // Otherwise the replay's own arrival act, then the close look.
    const replayed = () => {
        let run: ArkReplayRun | undefined;
        try {
            run = scene.play?.([act]);
        } catch {
            run = undefined;
        }
        if (!run) {
            settle();
            return;
        }
        void run.done.then(settle, settle);
    };
    const begin = scene.hold && scene.arrive ? staged : scene.play ? replayed : settle;
    if (scene.mounted) void scene.mounted().then(begin, settle);
    else begin();
}
