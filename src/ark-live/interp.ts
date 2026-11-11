/**
 * Remote controlled animals, drawn a little in the past (design §2.4).
 *
 * Each viewer keeps the last few server samples of every remote animal and draws it at `serverNow − delay` (120 ms at
 * 10 Hz, 250 ms at 5 Hz), with Hermite interpolation between the two samples around that time using each sample's
 * speed and heading as the tangents. Past the newest sample it extrapolates for at most 200 ms, then holds.
 *
 * Pure: times are server milliseconds.
 */

import {angleDelta, type Clip, type Mode} from "@/ark-live/protocol";

export const INTERP_DELAY_MS = {high: 120, medium: 120, low: 250, lite: 600} as const;
export const EXTRAPOLATE_MS = 200;
const KEEP = 12;

export type Sample = {t: number; x: number; y: number; z: number; yaw: number; roll: number; speed: number; mode: Mode; clip: Clip; phase: number; flags: number};
export type Drawn = Omit<Sample, "t"> & {extrapolated: boolean; stale: boolean};

export class RemoteTrack {
    private samples: Sample[] = [];

    push(sample: Sample): void {
        const last = this.samples[this.samples.length - 1];
        if (last && sample.t <= last.t) {
            if (sample.t === last.t) this.samples[this.samples.length - 1] = sample;
            return;
        }
        this.samples.push(sample);
        if (this.samples.length > KEEP) this.samples.shift();
    }

    latest(): Sample | null {
        return this.samples[this.samples.length - 1] ?? null;
    }

    size(): number {
        return this.samples.length;
    }

    /** Where to draw it at server time `t` (already minus the delay), or null with no samples. */
    at(t: number): Drawn | null {
        const s = this.samples;
        if (!s.length) return null;
        if (t <= s[0].t) return {...s[0], extrapolated: false, stale: false};
        for (let i = 1; i < s.length; i++) {
            if (t <= s[i].t) return hermite(s[i - 1], s[i], t);
        }
        const last = s[s.length - 1];
        const ahead = Math.min(t - last.t, EXTRAPOLATE_MS) / 1000;
        // Along its heading at its speed, flat (a flyer's climb is not predicted).
        return {
            ...last,
            x: last.x + Math.sin(last.yaw) * last.speed * ahead,
            z: last.z + Math.cos(last.yaw) * last.speed * ahead,
            extrapolated: true,
            stale: t - last.t > EXTRAPOLATE_MS
        };
    }
}

function hermite(a: Sample, b: Sample, t: number): Drawn {
    const span = (b.t - a.t) / 1000;
    const u = span > 0 ? (t - a.t) / (b.t - a.t) : 1;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    // Tangents: each sample's velocity (speed along its heading), scaled to the span; clamped to the chord so a
    // sudden stop never overshoots.
    const chord = Math.hypot(b.x - a.x, b.z - a.z);
    const tan = (s: Sample) => Math.min(s.speed * span, chord * 1.5 + 0.05);
    const ta = tan(a);
    const tb = tan(b);
    const x = h00 * a.x + h10 * Math.sin(a.yaw) * ta + h01 * b.x + h11 * Math.sin(b.yaw) * tb;
    const z = h00 * a.z + h10 * Math.cos(a.yaw) * ta + h01 * b.z + h11 * Math.cos(b.yaw) * tb;
    const near = u < 0.5 ? a : b;
    return {
        x,
        z,
        y: a.y + (b.y - a.y) * u,
        yaw: a.yaw + angleDelta(a.yaw, b.yaw) * u,
        roll: a.roll + (b.roll - a.roll) * u,
        speed: a.speed + (b.speed - a.speed) * u,
        mode: near.mode,
        clip: near.clip,
        phase: near.phase,
        flags: near.flags,
        extrapolated: false,
        stale: false
    };
}
