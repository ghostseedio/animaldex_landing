/**
 * What the Ark's WebAudio player (`src/ark-scene/ark-audio.ts`) should play
 * next, decided without any audio: which animals may be heard (the tier's
 * voice cap, alarms first, nearest first), which of their calls fall in the
 * coming moment (the shared `scheduledCalls`, so every viewer's animals call
 * at the same instants), and how loud and how far left or right each is for
 * this listener. Pure, so it is tested without a browser.
 *
 * Which calls are heard depends on where the camera is (the listener); when
 * each animal calls does not.
 */

import {unit} from "@/lib/ark-clock";
import {ARK_SOUND_TIERS, audibleCalls, distanceGain, scheduledCalls, type ArkCallMood, type ArkScheduledCall, type ArkSoundTier} from "@/lib/ark-sound";

export type ArkListener = {
    x: number;
    y: number;
    z: number;
    /** The camera's right, flat on the ground (unit length). */
    rightX: number;
    rightZ: number;
};

export type ArkCallSource = {
    id: string;
    x: number;
    y: number;
    z: number;
    mood: ArkCallMood;
    /** Calls a minute times its species' own pace (`speciesCallPace`). */
    pace: number;
    /** How many calls its bank holds (0: it has no voice). */
    callCount: number;
};

export type ArkPlannedCall = ArkScheduledCall & {gain: number; pan: number; distance: number};

/** How loud (0–1) and where (pan −1 left … 1 right) a sound at (x, y, z) is for this listener. Close by it is centred. */
export function listenerMix(listener: ArkListener, x: number, y: number, z: number, refDistance = 4, maxDistance = 60): {gain: number; pan: number; distance: number} {
    const dx = x - listener.x;
    const dy = y - listener.y;
    const dz = z - listener.z;
    const distance = Math.hypot(dx, dy, dz);
    const flat = Math.hypot(dx, dz);
    const side = flat > 1e-6 ? (dx * listener.rightX + dz * listener.rightZ) / flat : 0;
    // Within a couple of metres a sound is all round you, not hard to one side.
    const spread = Math.min(flat / (refDistance * 0.75), 1);
    return {gain: distanceGain(distance, refDistance, maxDistance), pan: Math.max(-1, Math.min(1, side * spread * 0.85)), distance};
}

/**
 * The calls to schedule between `fromMs` and `toMs` (shared ms): from the
 * animals that may be heard now (at most the tier's cap, `audibleCalls`), each
 * one's calls in that window, with its loudness and pan. Sorted by time.
 */
export function planCalls(sources: ArkCallSource[], listener: ArkListener, fromMs: number, toMs: number, tier: ArkSoundTier): ArkPlannedCall[] {
    const caps = ARK_SOUND_TIERS[tier];
    const candidates = sources
        .filter((s) => s.callCount > 0 && s.pace > 0)
        .map((s) => ({source: s, animalId: s.id, mood: s.mood, ...listenerMix(listener, s.x, s.y, s.z, 4, caps.callDistance)}))
        .filter((c) => c.gain > 0.01);
    const heard = audibleCalls(candidates, caps.calls, caps.callDistance);
    const out: ArkPlannedCall[] = [];
    for (const c of heard) {
        if (c.mood === "alarm") continue;
        for (const call of scheduledCalls(c.source.id, c.mood, c.source.pace, c.source.callCount, fromMs, toMs)) {
            out.push({...call, gain: c.gain, pan: c.pan, distance: c.distance});
        }
    }
    return out.sort((a, b) => a.at - b.at || (a.animalId < b.animalId ? -1 : 1));
}

/**
 * An alarm call heard now (`reactive.ts` said this animal called): which of
 * its calls (seeded by the moment), a touch higher and faster than its calm
 * calls, at full priority.
 */
export function alarmCall(source: ArkCallSource, listener: ArkListener, atMs: number, tier: ArkSoundTier): ArkPlannedCall | null {
    if (source.callCount <= 0) return null;
    const caps = ARK_SOUND_TIERS[tier];
    const mix = listenerMix(listener, source.x, source.y, source.z, 4, caps.callDistance);
    if (mix.gain <= 0.01) return null;
    const second = Math.floor(atMs / 1000);
    return {
        animalId: source.id,
        at: atMs,
        call: Math.floor(unit(source.id, "alarm-call", second) * source.callCount),
        rate: 1.04 + unit(source.id, "alarm-rate", second) * 0.04,
        mood: "alarm",
        gain: Math.min(1, mix.gain * 1.25),
        pan: mix.pan,
        distance: mix.distance
    };
}

export type ArkBedWanted = {id: string; url: string; gain: number; pan?: number};

/** The beds to keep sounding: the loudest `cap` (ties by id), the rest faded out. */
export function bedsToPlay<T extends ArkBedWanted>(beds: T[], cap: number): T[] {
    return beds
        .filter((b) => b.gain > 0.01 && typeof b.url === "string" && b.url.length > 0)
        .sort((a, b) => b.gain - a.gain || (a.id < b.id ? -1 : 1))
        .slice(0, Math.max(0, cap));
}
