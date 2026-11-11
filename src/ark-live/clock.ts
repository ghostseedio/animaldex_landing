/**
 * Clock sync between a viewer and `ark-live` (design §2.4).
 *
 * NTP-style: each ping/pong gives `offset = s − (c0 + c1) / 2` and `rtt = c1 − c0` (all milliseconds; `s` on the
 * server's clock, `c0`, `c1` on the client's). The estimate is the sample with the smallest RTT among the last 8: its
 * error is at most half the path's asymmetry. Applied changes are slewed at ≤ 50 ms per second so the shared clock
 * (and every schedule pose read from it) never jumps; the first one is applied at once, before the first frame.
 *
 * Pure: the caller passes its own clock readings.
 */

export const CLOCK_SAMPLES = 8;
/** How fast an applied offset may move toward the estimate (ms per second). */
export const CLOCK_SLEW_MS_PER_S = 50;
/** Above this RTT for `SLOW_FOR_MS`, control pauses ("The connection is too slow to explore right now"). */
export const SLOW_RTT_MS = 600;
export const SLOW_FOR_MS = 10_000;

export type ClockSample = {offset: number; rtt: number; at: number};

export class ClockSync {
    private samples: ClockSample[] = [];
    /** The offset applied now (ms): server ms ≈ client ms + applied. */
    private applied: number | null = null;
    private lastSlewAt: number | null = null;
    private slowSince: number | null = null;

    /** A pong: the ping's send time `c0`, the server's time `s`, and when the pong arrived `c1` (client ms). */
    add(c0: number, s: number, c1: number): ClockSample | null {
        const rtt = c1 - c0;
        if (!(rtt >= 0) || rtt > 30_000) return null;
        const sample = {offset: s - (c0 + c1) / 2, rtt, at: c1};
        this.samples.push(sample);
        if (this.samples.length > CLOCK_SAMPLES) this.samples.shift();
        if (rtt > SLOW_RTT_MS) this.slowSince ??= c1;
        else this.slowSince = null;
        return sample;
    }

    /** The best estimate (smallest RTT of the last 8), or null before the first pong. */
    best(): ClockSample | null {
        let best: ClockSample | null = null;
        for (const s of this.samples) if (!best || s.rtt < best.rtt) best = s;
        return best;
    }

    /** The RTT of the latest sample (ms), or null. */
    rtt(): number | null {
        return this.samples.length ? this.samples[this.samples.length - 1].rtt : null;
    }

    /** True once RTT has stayed above 600 ms for 10 s. */
    tooSlow(nowClient: number): boolean {
        return this.slowSince !== null && nowClient - this.slowSince >= SLOW_FOR_MS;
    }

    /** The offset to use now (ms), slewed toward the estimate; null before the first pong. */
    offset(nowClient: number): number | null {
        const best = this.best();
        if (!best) return this.applied;
        if (this.applied === null) {
            this.applied = best.offset;
            this.lastSlewAt = nowClient;
            return this.applied;
        }
        const dt = Math.max(0, (nowClient - (this.lastSlewAt ?? nowClient)) / 1000);
        this.lastSlewAt = nowClient;
        const step = CLOCK_SLEW_MS_PER_S * dt;
        const gap = best.offset - this.applied;
        this.applied += Math.max(-step, Math.min(step, gap));
        return this.applied;
    }

    /** Server ms now, from the client's ms; null before the first pong. */
    serverNow(nowClient: number): number | null {
        const o = this.offset(nowClient);
        return o === null ? null : nowClient + o;
    }
}
