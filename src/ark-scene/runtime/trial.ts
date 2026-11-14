/**
 * A tier on trial (graphics and performance pass, 2026-11).
 *
 * An iPhone tells a page nothing true of itself: WebKit answers 4 cores for every one of them and says nothing of its
 * memory. Counted as weak, every iPhone drew the low tier (one buffer pixel a CSS pixel on a 3× screen). Counted as
 * what it is (six cores, `streaming/tiers.ts` HIDDEN_CORES), it starts on the medium tier, and whether it holds it is
 * found out, not assumed:
 *
 * - **the frames**: the pacing (`pace.ts`) gives up resolution, then the rate, then the tier, once, and never raises
 *   it again in that session;
 * - **the memory**, which a page in WebKit cannot read: a page that went away during its first `TRIAL_PROVEN_S` on
 *   screen with the medium tier up (the system ended its process while the world was coming in, or it crashed)
 *   starts on the low tier the next time, so a phone short of memory is not sent into the same wall on every reload.
 *   A page put away properly (hidden, navigated from, its app sent to the background) leaves no mark, and neither
 *   does one that goes after those first seconds. A device that has held the tier through them before is given one
 *   more go (its app swiped away mid-load looks the same from here): two in a row count.
 *
 * Either failure is remembered on the device (`localStorage`): the low tier from the start for a week, twice as long
 * each time it fails again (to eight weeks), then one more try. Without storage nothing is remembered and every
 * visit is a first.
 *
 * Pure but for the store it is handed; the clock is passed in.
 */

export type TrialStore = {getItem: (key: string) => string | null; setItem: (key: string, value: string) => void};

export const TIER_TRIAL_KEY = "ark-tier-trial";
const DAY_MS = 86_400_000;
/** How long a failed trial keeps the low tier (days): twice as long each time it fails again, to `TRIAL_HOLD_MOST_DAYS`. */
export const TRIAL_HOLD_DAYS = 7;
export const TRIAL_HOLD_MOST_DAYS = 56;
/** On screen this long (s) with the tier up, the memory has held: the world is in and its first models with it. */
export const TRIAL_PROVEN_S = 90;

export type TrialWhy = "lost" | "pace" | "memory";
type Memo = {
    /** open: on screen and not yet proven this session; closed: put away, or proven; failed: the low tier until the hold is over. */
    state: "open" | "closed" | "failed";
    at: number;
    /** Failures so far (the hold's length). */
    times: number;
    /** It has held the tier through a session's first seconds before. */
    proven: boolean;
    /** Sessions lost in a row. */
    strikes: number;
    why?: TrialWhy;
};

function readMemo(store: TrialStore | null): Memo | null {
    try {
        const memo = JSON.parse(store?.getItem(TIER_TRIAL_KEY) ?? "null") as Partial<Memo> | null;
        if (!memo || (memo.state !== "open" && memo.state !== "closed" && memo.state !== "failed")) return null;
        const count = (value: unknown) => (typeof value === "number" && value > 0 ? Math.min(Math.floor(value), 16) : 0);
        const at = typeof memo.at === "number" && Number.isFinite(memo.at) ? memo.at : 0;
        return {state: memo.state, at, times: count(memo.times), proven: memo.proven === true, strikes: count(memo.strikes), why: memo.why};
    } catch {
        return null;
    }
}

export function trialHoldMs(times: number): number {
    return Math.min(TRIAL_HOLD_DAYS * 2 ** Math.max(times - 1, 0), TRIAL_HOLD_MOST_DAYS) * DAY_MS;
}

export class TierTrial {
    /** The tier this page starts on. */
    readonly tier: "medium" | "low";
    /** Why it starts on the low tier (null: the medium tier is on trial). */
    readonly held: TrialWhy | null;
    private running = false;
    private why: TrialWhy | null = null;
    private times: number;
    private proven: boolean;
    private strikes: number;
    /** This session's first seconds are over: nothing more is written but a failure. */
    private through = false;
    private seenSince: number | null = null;
    private seenFor = 0;

    /** `now` in ms (the wall clock: the memo outlives the page); `visible`: the page is on screen now. */
    constructor(private readonly store: TrialStore | null, now: number, visible: boolean) {
        const memo = readMemo(store);
        this.times = memo?.times ?? 0;
        this.proven = memo?.proven ?? false;
        this.strikes = memo?.strikes ?? 0;
        if (memo?.state === "open") {
            // The page before this one went away in its first seconds on screen with the tier up.
            this.strikes++;
            if (!this.proven || this.strikes >= 2) {
                this.tier = "low";
                this.held = "lost";
                this.fail("lost", now);
                return;
            }
        } else if (memo?.state === "failed") {
            // (A clock set back: a memo from the future holds no longer than its own hold from now.)
            if (Math.abs(now - memo.at) < trialHoldMs(memo.times)) {
                this.tier = "low";
                this.held = memo.why ?? "pace";
                return;
            }
        } else this.strikes = 0;
        this.tier = "medium";
        this.held = null;
        this.running = true;
        this.seen(visible, now);
    }

    /** The medium tier is up and being proven. */
    get on(): boolean {
        return this.running;
    }

    /** For the overlay: on trial, held (this session's first seconds over), or why the low tier. */
    get state(): "trial" | "held" | TrialWhy {
        return this.running ? (this.through ? "held" : "trial") : (this.why ?? this.held ?? "pace");
    }

    /**
     * The page came on screen (true) or left it, or is going away (false). Returns the ms on screen still to go before
     * the memory counts as held (`tick` then), or null when there is nothing to wait for.
     */
    seen(visible: boolean, now: number): number | null {
        if (!this.running || this.through) return null;
        if (visible) {
            if (this.seenSince === null) this.seenSince = now;
            this.write("open", now);
            return Math.max(TRIAL_PROVEN_S * 1000 - this.seenFor - (now - this.seenSince), 0);
        }
        if (this.seenSince !== null) this.seenFor += Math.max(now - this.seenSince, 0);
        this.seenSince = null;
        // (Put away properly: not lost.)
        this.strikes = 0;
        this.write("closed", now);
        return null;
    }

    /** Time passed on screen: past the first seconds, the memory has held (returns true once it has). */
    tick(now: number): boolean {
        if (!this.running || this.through) return this.through;
        const seen = this.seenFor + (this.seenSince === null ? 0 : Math.max(now - this.seenSince, 0));
        if (seen < TRIAL_PROVEN_S * 1000) return false;
        this.through = true;
        this.proven = true;
        this.strikes = 0;
        this.times = 0;
        this.write("closed", now);
        return true;
    }

    /** The device did not hold the tier (the pacing dropped it, or the memory check did): the low tier from the start for a while. */
    failed(why: TrialWhy, now: number) {
        if (!this.running) return;
        this.fail(why, now);
    }

    private fail(why: TrialWhy, now: number) {
        this.running = false;
        this.why = why;
        this.times++;
        this.proven = false;
        this.strikes = 0;
        this.write("failed", now, why);
    }

    private write(state: Memo["state"], now: number, why?: TrialWhy) {
        try {
            const memo: Memo = {state, at: now, times: this.times, proven: this.proven, strikes: this.strikes, why};
            this.store?.setItem(TIER_TRIAL_KEY, JSON.stringify(memo));
        } catch {
            // (No storage, or it is full: nothing is remembered.)
        }
    }
}
