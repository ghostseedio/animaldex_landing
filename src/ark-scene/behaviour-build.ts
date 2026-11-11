/**
 * A build cut into small tasks (visual only), so the behaviour system's places
 * and walk grid can be built a few milliseconds at a time between frames
 * instead of stalling the page for half a second (2.6 s on a phone).
 *
 * The tasks are the same code in the same order as the build all at once, so
 * the result is the same, to the bit, however it is sliced (the tests check
 * the bytes). Each task does a little and says whether it is done; a task that
 * is not done is called again.
 */

/** One task: does a little of the work, returns true once its part is done. */
export type BuildTask = () => boolean;

/** A loop of `count()` steps, `size` at a time (the count is read when the task first runs, after the tasks before it). */
export function chunked(count: () => number, size: number, body: (i: number) => void): BuildTask {
    let next = 0;
    let total = -1;
    return () => {
        if (total < 0) total = count();
        const end = Math.min(next + size, total);
        while (next < end) {
            body(next);
            next++;
        }
        return next >= total;
    };
}

/** A task done in one go. */
export function once(body: () => void): BuildTask {
    return () => {
        body();
        return true;
    };
}

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class SlicedBuild<T> {
    private index = 0;
    private result: T | null = null;
    /** Main-thread time spent on it so far (ms), and in how many slices. */
    spentMs = 0;
    slices = 0;

    constructor(private readonly tasks: BuildTask[], private readonly finish: () => T) {}

    get done(): boolean {
        return this.result !== null;
    }

    /** Works for about `budgetMs` (at least one task), and returns the result once it is built (null until then). */
    step(budgetMs: number): T | null {
        if (this.result !== null) return this.result;
        const started = clock();
        this.slices++;
        do {
            if (this.index >= this.tasks.length) break;
            if (this.tasks[this.index]()) this.index++;
        } while (clock() - started < budgetMs);
        if (this.index >= this.tasks.length) this.result = this.finish();
        this.spentMs += clock() - started;
        return this.result;
    }

    /** Everything left, now (the build all at once). */
    run(): T {
        while (this.result === null) this.step(Infinity);
        return this.result;
    }
}
