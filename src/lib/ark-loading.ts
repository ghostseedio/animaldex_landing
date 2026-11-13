/**
 * The Ark's loading screen (loading lane, 2026-11-13; the owner: "an improved loading screen rather than just a
 * spinner"): on /ark, in the apps' panel (`/ark/embed.html`) and behind the home page's hero.
 *
 * What shows is real from the first paint: a frame of the Ark (the poster), then the Ark's own numbers and its newest
 * arrival as soon as they are read, and a thin bar that moves only when a real step of the load is done. The steps,
 * in the order they happen on /ark (the embed reads its code first):
 *
 *   data      who is aboard is read (`/api/ark/voyage`, or the app's `ark:snapshot`)
 *   code      the scene's code is in (the page's chunk, or the embed's `ark-scene.js`)
 *   prepared  the island's heavy seeded work is done in its worker and the scene is made (`mounted()`)
 *   frame     the world's first good frame is drawn (the second after `onReady`: `arkWhenSettled`): the poster gives
 *             way to it
 *   animals   the opening view's models are in (the runtime's `viewComplete`), as a share while they come
 *
 * The reader sees three stages, named in a few calm words: reading who is aboard (until the data is in), building the
 * island (until the first frame), bringing the animals into view (until they are in). Nothing here is a timer: a
 * stage that takes long keeps its bar where it is, and the page only shows that work is going on in it.
 *
 * Pure: the page (`ark-view.tsx`), the embed (through the bundle, `embed-entry.ts`) and the home page's hero (from
 * the embed's `ark:progress` messages) share it.
 */

export type ArkLoadStep = "data" | "code" | "prepared" | "frame";

/** What the reader is told: "data" until who is aboard is read, "world" until the first frame, then "animals". */
export type ArkLoadStage = "data" | "world" | "animals" | "done";

export type ArkLoadState = Record<ArkLoadStep, boolean> & {
    /** The share of the opening view's models in (0…1) once the first frame is drawn. */
    animals: number;
    /** The opening view's models are all in (the runtime's `viewComplete`). */
    animalsDone: boolean;
};

export const ARK_LOAD_START: ArkLoadState = {data: false, code: false, prepared: false, frame: false, animals: 0, animalsDone: false};

/**
 * Each step's share of the bar, so it moves at a fairly even pace on the phone profile (4× CPU, slow 4G; measured
 * 2026-11-13 by the loading lane). The step that comes first takes long on both surfaces (on /ark the page loads before
 * who is aboard is read, about 20 s there; in the embed the scene's code, about 10 s), the other first-two step is
 * short (2 s and 1 s), the island's seeded work is the longest (13-21 s), the first frame 3-4 s. The animals are the
 * last fifth, as a share of the models the opening view asked for.
 */
export const ARK_LOAD_WEIGHTS: Record<ArkLoadStep | "animals", number> = {data: 0.2, code: 0.2, prepared: 0.3, frame: 0.1, animals: 0.2};

const STEPS: ArkLoadStep[] = ["data", "code", "prepared", "frame"];

function clamp01(value: number): number {
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}

/** A step done (nothing else changes; a step already done stays done). */
export function arkLoadStep(state: ArkLoadState, step: ArkLoadStep): ArkLoadState {
    return state[step] ? state : {...state, [step]: true};
}

/** The opening view's models: their share in now, and whether all are in. Only ever forward. */
export function arkLoadAnimals(state: ArkLoadState, share: number, done: boolean): ArkLoadState {
    const next = done ? 1 : Math.max(state.animals, clamp01(share));
    if (next === state.animals && done === state.animalsDone) return state;
    return {...state, animals: next, animalsDone: state.animalsDone || done};
}

export function arkLoadStage(state: ArkLoadState): ArkLoadStage {
    if (state.frame && state.animalsDone) return "done";
    if (state.frame) return "animals";
    if (state.data) return "world";
    return "data";
}

/** The bar: the done steps' shares, and the animals' share of theirs. Rounded to 0.001. */
export function arkLoadProgress(state: ArkLoadState): number {
    let progress = 0;
    for (const step of STEPS) if (state[step]) progress += ARK_LOAD_WEIGHTS[step];
    progress += ARK_LOAD_WEIGHTS.animals * (state.animalsDone ? 1 : state.frame ? clamp01(state.animals) : 0);
    return Math.round(clamp01(progress) * 1000) / 1000;
}

/**
 * The part of the bar the work going on now will fill: from the bar's end to the end of the step under way (the
 * first not done). Shown as a still tint, never as progress.
 */
export function arkLoadWorking(state: ArkLoadState): number {
    if (state.frame) return state.animalsDone ? 0 : Math.round(ARK_LOAD_WEIGHTS.animals * (1 - clamp01(state.animals)) * 1000) / 1000;
    const next = STEPS.find((step) => !state[step]);
    return next ? ARK_LOAD_WEIGHTS[next] : 0;
}

/**
 * The opening view's models as a share: what was asked for since the first frame (the most pending seen) less what is
 * still pending. Nothing asked yet: 0.
 */
export function arkAnimalsShare(pending: number, mostPending: number): number {
    if (!(mostPending > 0)) return 0;
    return clamp01((mostPending - Math.max(pending, 0)) / mostPending);
}

/** The newest arrival the loading screen names: came aboard (not born), a real species with art (not the placeholder). */
export function arkNewestArrival<T extends {arrived_at: string; origin?: "arrived" | "born"; model_slug: string | null; placeholder?: boolean}>(animals: readonly T[]): T | null {
    let newest: T | null = null;
    let newestAt = -Infinity;
    for (const animal of animals) {
        if (animal.origin === "born" || animal.placeholder || !animal.model_slug || animal.model_slug.startsWith("placeholder--")) continue;
        const at = Date.parse(animal.arrived_at);
        if (!Number.isFinite(at) || at <= newestAt) continue;
        newest = animal;
        newestAt = at;
    }
    return newest;
}

/**
 * "3 hours ago", "yesterday", "2 days ago", in the reader's language (`Intl.RelativeTimeFormat`, so no words of our
 * own to translate). Under a minute: "now" in that language. A time in the future (a clock off) reads as now.
 */
export function arkAgoText(at: string | number | Date, now: Date, locale: string): string {
    const then = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
    let format: Intl.RelativeTimeFormat;
    try {
        format = new Intl.RelativeTimeFormat(locale, {numeric: "auto"});
    } catch {
        format = new Intl.RelativeTimeFormat("en", {numeric: "auto"});
    }
    if (!Number.isFinite(then)) return "";
    const seconds = Math.max(0, (now.getTime() - then) / 1000);
    if (seconds < 60) return format.format(0, "second");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return format.format(-minutes, "minute");
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return format.format(-hours, "hour");
    const days = Math.floor(hours / 24);
    return days < 7 ? format.format(-days, "day") : format.format(-Math.floor(days / 7), "week");
}

/**
 * The scene's first frame (`onReady`) is drawn before its fog and haze have their values: a beige wash with the island
 * faint in it, measured on every run (the next frame is right, about 230 ms later on a desktop and 670 ms on the phone
 * profile). So the poster gives way at the second drawn frame (the runtime's `drawn`), never at the wash; at the
 * latest after `capMs`. That frame is the `frame` step. Returns a cancel.
 */
export const ARK_SETTLED_FRAMES = 2;

export function arkWhenSettled(
    scene: {runtime?: () => {drawn: number}} | null | undefined,
    done: () => void,
    capMs = 2000,
    schedule: (callback: () => void) => () => void = (callback) => {
        const id = requestAnimationFrame(callback);
        return () => cancelAnimationFrame(id);
    },
    now: () => number = () => performance.now()
): () => void {
    const since = now();
    let cancel: (() => void) | null = null;
    let finished = false;
    const check = () => {
        if (finished) return;
        const drawn = scene?.runtime?.().drawn ?? 0;
        if (drawn >= ARK_SETTLED_FRAMES || now() - since >= capMs || !scene?.runtime) {
            finished = true;
            done();
            return;
        }
        cancel = schedule(check);
    };
    check();
    return () => {
        finished = true;
        cancel?.();
    };
}

/** A User Timing mark per step (`ark:load:data` …, `ark:load:animals`): the load's stages in a production build's trace. */
export function markArkLoad(step: ArkLoadStep | "animals"): void {
    try {
        performance.mark(`ark:load:${step}`);
    } catch {
        // (No User Timing here: nothing to mark.)
    }
}

/** The words the loading screen says (`ark.loader` in the Ark's words). */
export type ArkLoaderWords = {
    /** Until who is aboard is read. */
    data: string;
    /** Until the first frame of the world. */
    world: string;
    /** Until the opening view's animals are in. */
    animals: string;
    /** The label over the newest arrival's name. */
    newest: string;
};

export function arkLoaderStageText(stage: ArkLoadStage, words: ArkLoaderWords): string {
    return stage === "data" ? words.data : stage === "world" ? words.world : words.animals;
}

/** The message the embed sends its host as the load goes (the home page's hero shows it; the apps may). */
export type ArkProgressMessage = {type: "ark:progress"; stage: ArkLoadStage; progress: number};

export function arkProgressMessage(state: ArkLoadState): ArkProgressMessage {
    return {type: "ark:progress", stage: arkLoadStage(state), progress: arkLoadProgress(state)};
}

/** A host reading `ark:progress`: the stage and the bar, or null for anything else. */
export function readArkProgressMessage(data: unknown): {stage: ArkLoadStage; progress: number} | null {
    if (!data || typeof data !== "object") return null;
    const message = data as {type?: unknown; stage?: unknown; progress?: unknown};
    if (message.type !== "ark:progress") return null;
    const stage = message.stage === "data" || message.stage === "world" || message.stage === "animals" || message.stage === "done" ? message.stage : null;
    if (!stage || typeof message.progress !== "number") return null;
    return {stage, progress: clamp01(message.progress)};
}
