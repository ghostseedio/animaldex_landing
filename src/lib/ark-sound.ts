/**
 * The Ark's sound, decided (liveliness pass, section 2): which animals may
 * call, when, how loud, how many at once; which ambient beds play and how
 * loud; whose recordings they are. Pure: the player (WebAudio) only plays
 * what this says, so every viewer hears the same calls at the same moments.
 *
 * The recordings are the chat's (`animal-chat-sounds` bucket, see the sound
 * audit): `v1/<species_profile_id>/manifest.json` with `kind: "species"`
 * (real recordings of that species) or `kind: "habitat"` (real recordings
 * of where it lives, shared). Rules:
 *
 * - Calls come only from a species' own recordings, or (A1) its kind's: a
 *   breed calls with its parent species' voice. Never from a habitat bank,
 *   never from another species, never synthesised.
 * - The banks held back by the chat's final listen never call here either.
 * - Habitat sprites feed the ambient engine instead.
 * - Visual-and-audio only: nothing here decides anything in the Ark.
 * - Sound is off until the viewer taps (browsers and the apps' web views
 *   require it), and never on by itself inside the apps' panel.
 */

import {dawnChorus, unit} from "@/lib/ark-clock";

export const ARK_SOUND_BUCKET_PATH = "storage/v1/object/public/animal-chat-sounds/v1";

/** Banks the chat's final listen held back (`AnimalDex/scripts/animal-sounds/data/published-species.csv`, status "held"). */
export const ARK_HELD_SOUND_BANKS: ReadonlySet<string> = new Set([
    "b2c3d4e5-f6a7-4890-b123-456789abcdef", // Red Ant
    "66b6eb21-b4b3-4054-bb39-506d9cf0b8e2", // Rock Cavy
    "9a33d433-8cfb-42e8-aed8-ba8ad62ac2c6", // Ruddy Shelduck
    "94edbb32-d80e-455f-8d71-06d79f1c7c8f", // Ruff
    "e5d7d97f-f3dc-4b26-8260-1766b0a19aac", // Parasitic Wasp
    "2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", // Human
    "0b84428a-4cce-44c8-af78-b44be673a7d8", // Coypu
    "bc30ba0c-9be5-4823-b101-15c119cb2d5c", // Common Field Grasshopper
    "9ff4678a-df29-48d4-b4d1-95122614b7a2", // Giant Redeye
    "9b02dbbd-dfdc-4dd2-89cd-9c8706dcb91f", // Common Kestrel
    "f6018aef-a61c-4b9f-9d91-39dd54e79e18", // Eurasian Spoonbill
    "7c20fff8-09bd-42ad-bbc2-6f70958f0840", // Quenda
    "eac6f24d-d6ee-44e2-ae4d-e7a14e1ddc8d", // Nacunda Nighthawk
    "9d9329cb-529e-4d7c-81e3-4ec120d89c38", // Surinam Horned Frog
    "5b50ee3a-fc81-480c-bef7-f42a844209a9", // Bateleur
    "fc7c175f-74fc-4236-bc3a-00c56fd00404", // Bee Hummingbird
    "4641397e-9e18-486e-a087-d36c4e2b6555", // Red-crowned Crane
    "ed180bf5-0ea4-485d-8fa6-e6c508bb7add" // Beluga Sturgeon
]);

// ---------------------------------------------------------------------------
// Manifests

export type ArkSoundCredit = {recordist: string; license: string; source: string; page?: string | null};

export type ArkSoundManifest = {
    kind: "species" | "habitat";
    /** The sprite, relative to the species folder (own) or to `v1/` (`shared_audio`, habitat). */
    audio: string;
    /** [start, duration] seconds in the sprite. */
    calls: Array<[number, number]>;
    grains: Array<[number, number]>;
    style: string | null;
    rhythm: {ioi: number; event: number} | null;
    habitat: string | null;
    credits: ArkSoundCredit[];
};

function finite(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
}

function spans(value: unknown): Array<[number, number]> {
    if (!Array.isArray(value)) return [];
    return value.filter((s): s is [number, number] => Array.isArray(s) && s.length >= 2 && finite(s[0]) && finite(s[1]) && s[0] >= 0 && s[1] > 0).map((s) => [s[0], s[1]]);
}

/** A manifest as fetched, checked; null when it cannot be played. */
export function parseSoundManifest(raw: unknown): ArkSoundManifest | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const kind = r.kind === "habitat" ? "habitat" : r.kind === "species" || r.kind == null ? "species" : null;
    if (!kind) return null;
    const audio = kind === "habitat" ? r.shared_audio : r.audio;
    if (typeof audio !== "string") return null;
    if (kind === "habitat" ? !/^habitat\/[a-z0-9-]+\/sprite-[0-9a-f]{8}\.m4a$/.test(audio) : !/^sprite-[0-9a-f]{8}\.m4a$/.test(audio)) return null;
    const rhythm = r.rhythm && typeof r.rhythm === "object" ? (r.rhythm as Record<string, unknown>) : null;
    const credits = Array.isArray(r.credits)
        ? (r.credits as unknown[]).flatMap((c) => {
            if (!c || typeof c !== "object") return [];
            const x = c as Record<string, unknown>;
            if (typeof x.recordist !== "string" || typeof x.license !== "string" || typeof x.source !== "string") return [];
            return [{recordist: x.recordist, license: x.license, source: x.source, page: typeof x.page === "string" && /^https:\/\//.test(x.page) ? x.page : null}];
        })
        : [];
    return {
        kind,
        audio,
        calls: spans(r.calls),
        grains: spans(r.grains),
        style: typeof r.style === "string" ? r.style : null,
        rhythm: rhythm && finite(rhythm.ioi) && finite(rhythm.event) ? {ioi: rhythm.ioi, event: rhythm.event} : null,
        habitat: typeof r.habitat === "string" ? r.habitat : null,
        credits
    };
}

/** Where a species' manifest lives. */
export function soundManifestUrl(supabaseUrl: string, speciesProfileId: string): string {
    return `${supabaseUrl.replace(/\/$/, "")}/${ARK_SOUND_BUCKET_PATH}/${speciesProfileId}/manifest.json`;
}

/** Where a manifest's sprite lives. */
export function soundAudioUrl(supabaseUrl: string, speciesProfileId: string, manifest: ArkSoundManifest): string {
    const base = `${supabaseUrl.replace(/\/$/, "")}/${ARK_SOUND_BUCKET_PATH}`;
    return manifest.kind === "habitat" ? `${base}/${manifest.audio}` : `${base}/${speciesProfileId}/${manifest.audio}`;
}

export type ArkCallVoice = {speciesProfileId: string; via: "own" | "kind"};

/**
 * The voice an animal calls with: its species' own recordings, else (A1) its
 * kind's; never a habitat bank and never a held one. Null: it stays quiet
 * (the ambient beds still play around it).
 */
export function callVoice(
    animal: {species_profile_id: string; kind_species_profile_id?: string | null},
    manifestOf: (speciesProfileId: string) => ArkSoundManifest | null | undefined
): ArkCallVoice | null {
    const usable = (id: string | null | undefined) => {
        if (!id || ARK_HELD_SOUND_BANKS.has(id)) return false;
        const m = manifestOf(id);
        return Boolean(m && m.kind === "species" && m.calls.length > 0);
    };
    if (usable(animal.species_profile_id)) return {speciesProfileId: animal.species_profile_id, via: "own"};
    const kind = animal.kind_species_profile_id;
    if (kind && kind !== animal.species_profile_id && usable(kind)) return {speciesProfileId: kind, via: "kind"};
    return null;
}

// ---------------------------------------------------------------------------
// When animals call

/** What the behaviour system says an animal is doing, as far as calling goes. */
export type ArkCallMood = "asleep" | "resting" | "awake" | "dawn" | "courting" | "alarm";

export type ArkCallMoodInput = {
    asleep: boolean;
    /** Alarmed now (a predator near, a meal acted out). */
    alarm?: boolean;
    /** Courting (a pair before a birth or laying, acted from the log). */
    courting?: boolean;
    /** Resting or sheltering (rain, heat): fewer calls. */
    resting?: boolean;
    /** A diurnal singer (birds, frogs, primates…) joins the dawn chorus. */
    dawnSinger?: boolean;
    /** The island's hour (`islandHours`). */
    hours: number;
};

export function callMood(input: ArkCallMoodInput): ArkCallMood {
    if (input.alarm) return "alarm";
    if (input.asleep) return "asleep";
    if (input.courting) return "courting";
    if (input.dawnSinger && dawnChorus(input.hours) > 0.15) return "dawn";
    return input.resting ? "resting" : "awake";
}

/** Calls a minute by mood, times the species' own pace. Asleep: silent. */
const MOOD_RATE: Record<ArkCallMood, number> = {asleep: 0, resting: 0.25, awake: 0.8, dawn: 3, courting: 2.2, alarm: 0};

/** How often this species calls, from its bank's rhythm: long-call species (howls, whale song) call sparingly. */
export function speciesCallPace(manifest: Pick<ArkSoundManifest, "style" | "rhythm">): number {
    if (manifest.style === "long") return 0.4;
    const event = manifest.rhythm?.event ?? 1;
    return Math.min(Math.max(1.6 / Math.max(event, 0.4), 0.4), 1.6);
}

export type ArkScheduledCall = {
    animalId: string;
    /** When it starts (ms since the epoch, shared). */
    at: number;
    /** Which of the bank's calls. */
    call: number;
    /** Playback rate (speed and pitch together, ±3.5%, as in the chat). */
    rate: number;
    mood: ArkCallMood;
};

/**
 * The calls an animal makes between `fromMs` and `toMs` (ms since the epoch),
 * the same for every viewer: time is cut into slots by its call rate, and a
 * slot holds at most one call, at a seeded offset, kept with a seeded chance
 * so the rhythm is never mechanical. Alarm calls are not scheduled here: one
 * plays when the alarm reaches the animal (`alarmWave`).
 */
export function scheduledCalls(animalId: string, mood: ArkCallMood, pace: number, callCount: number, fromMs: number, toMs: number): ArkScheduledCall[] {
    const perMinute = MOOD_RATE[mood] * pace;
    if (perMinute <= 0 || callCount <= 0 || toMs <= fromMs) return [];
    // Slots on a fixed grid per mood, so the answer for a window never depends on where the window starts.
    const slotMs = 60000 / (perMinute / 0.7);
    const out: ArkScheduledCall[] = [];
    const first = Math.floor(fromMs / slotMs);
    const last = Math.floor(toMs / slotMs);
    for (let slot = first; slot <= last; slot++) {
        if (unit(animalId, mood, "keep", slot) > 0.7) continue;
        const at = slot * slotMs + unit(animalId, mood, "at", slot) * slotMs * 0.9;
        if (at < fromMs || at >= toMs) continue;
        out.push({
            animalId,
            at: Math.round(at),
            call: Math.floor(unit(animalId, "call", slot) * callCount),
            rate: 1 + (unit(animalId, "rate", slot) * 2 - 1) * 0.035,
            mood
        });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Alarm waves (section 5): a reaction spreading through a group

export type ArkAlarmMember = {id: string; x: number; z: number};

export type ArkAlarmReaction = {
    id: string;
    /** When it reacts (ms after the alarm starts). */
    delayMs: number;
    /** It calls the alarm too (when its species has a voice and the cap allows). */
    calls: boolean;
};

/**
 * How an alarm spreads from the first animal that noticed: each member
 * reacts after a short delay that grows with its distance from the first,
 * plus a seeded jitter, so the wave runs through the flock. Purely visual;
 * the proximity that starts it never decides anything.
 */
export function alarmWave(startId: string, members: ArkAlarmMember[], startedAtMs: number, opts: {msPerMetre?: number; callers?: number} = {}): ArkAlarmReaction[] {
    const origin = members.find((m) => m.id === startId) ?? members[0];
    if (!origin) return [];
    const msPerMetre = opts.msPerMetre ?? 90;
    const callers = opts.callers ?? 3;
    const reactions = members.map((m) => {
        const d = Math.hypot(m.x - origin.x, m.z - origin.z);
        const jitter = m.id === origin.id ? 0 : 80 + unit(m.id, "alarm", startedAtMs) * 220;
        return {id: m.id, delayMs: Math.round(d * msPerMetre + jitter), calls: false};
    });
    reactions.sort((a, b) => a.delayMs - b.delayMs || (a.id < b.id ? -1 : 1));
    // The first few to react call; the rest only move.
    reactions.forEach((r, i) => {
        r.calls = i < callers;
    });
    return reactions;
}

/** 0–1 how alarmed an animal still is, `sinceMs` after it reacted: up at once, calm again after about 12 s. */
export function alarmLevel(sinceMs: number, calmMs = 12000): number {
    if (sinceMs < 0) return 0;
    if (sinceMs < calmMs * 0.4) return 1;
    return Math.max(0, 1 - (sinceMs - calmMs * 0.4) / (calmMs * 0.6));
}

// ---------------------------------------------------------------------------
// Loudness and the cap

/** The WebAudio "inverse" model, cut to silence beyond `maxDistance`. */
export function distanceGain(distance: number, refDistance = 4, maxDistance = 60, rolloff = 1): number {
    if (distance >= maxDistance) return 0;
    const d = Math.max(distance, refDistance);
    const g = refDistance / (refDistance + rolloff * (d - refDistance));
    // A soft fade over the last fifth, so nothing pops at the edge.
    const edge = Math.min(1, (maxDistance - distance) / (maxDistance * 0.2));
    return g * edge;
}

const MOOD_PRIORITY: Record<ArkCallMood, number> = {alarm: 4, courting: 3, dawn: 2, awake: 1, resting: 0, asleep: -1};

export type ArkCallCandidate = {animalId: string; mood: ArkCallMood; distance: number};

/** The calls that may play at once: alarms first, then courtship, the dawn chorus, the rest; nearest first; at most `cap`. */
export function audibleCalls<T extends ArkCallCandidate>(candidates: T[], cap: number, maxDistance = 60): T[] {
    return candidates
        .filter((c) => c.mood !== "asleep" && c.distance < maxDistance)
        .sort((a, b) => MOOD_PRIORITY[b.mood] - MOOD_PRIORITY[a.mood] || a.distance - b.distance || (a.animalId < b.animalId ? -1 : 1))
        .slice(0, Math.max(0, cap));
}

// ---------------------------------------------------------------------------
// Ambient beds

export const ARK_AMBIENT_BEDS = ["waves", "wind", "river", "pond", "rain", "forest_day", "night_insects", "dawn_chorus", "underwater", "thunder"] as const;
export type ArkAmbientBed = (typeof ARK_AMBIENT_BEDS)[number];

/**
 * Where each bed's audio comes from. A habitat bank from the bucket where one
 * fits (real recordings, already credited in its manifest); null where we
 * have nothing yet: it needs a CC0 / free-for-commercial-use recording,
 * recorded in docs/ark-credits.md before it is used.
 */
export const ARK_AMBIENT_SOURCES: Record<ArkAmbientBed, {habitat: string | null; note: string}> = {
    waves: {habitat: "shore", note: "the shore bank: surf and shingle"},
    wind: {habitat: "grassland", note: "the grassland wind bank; the snow-ice bank over the polar zone, the desert bank over the desert (the mountain bank was set aside for a rockfall)"},
    river: {habitat: "river", note: "the river bank"},
    pond: {habitat: "pond", note: "the pond bank"},
    rain: {habitat: null, note: "needed: a rain bed (light and heavy from one recording, by gain and filter)"},
    forest_day: {habitat: "forest-canopy", note: "the forest-canopy bank: the daytime birdsong bed (rainforest bank in the rainforest)"},
    night_insects: {habitat: null, note: "needed: crickets and frogs at night"},
    dawn_chorus: {habitat: null, note: "needed: a dawn chorus bed; the species' own calls at dawn carry it until then"},
    underwater: {habitat: "open-ocean", note: "the open-ocean bank (the reef bank over the reef)"},
    thunder: {habitat: null, note: "needed: thunder, a few distant rolls"}
};

export type ArkAmbientInput = {
    /** 0–1 how much of each zone is around the camera (the scene's zone weights near the listener). */
    zones: Partial<Record<string, number>>;
    /** 0–1 how near the shore and the open water the camera is. */
    shore: number;
    /** 0–1 near a river or a pond (from the scene's water mask). */
    river: number;
    pond: number;
    /** The camera below the sea's surface. */
    underwater: boolean;
    /** 0–1 the camera's height up the mountain. */
    altitude: number;
    hours: number;
    /** The sun's elevation, degrees. */
    elevation: number;
    weather: {rain: number; wind: number; storm: number; insects: number};
};

/** The gain (0–1) of each bed, before the master volume. Underwater, only the underwater bed (and a muffled rain) is heard. */
export function ambientMix(input: ArkAmbientInput): Record<ArkAmbientBed, number> {
    const z = (key: string) => Math.min(Math.max(input.zones[key] ?? 0, 0), 1);
    const day = Math.min(Math.max((input.elevation + 4) / 12, 0), 1);
    const night = 1 - Math.min(Math.max((input.elevation + 2) / 8, 0), 1);
    const w = input.weather;
    const quietInRain = 1 - 0.7 * w.rain;
    if (input.underwater) {
        return {waves: 0, wind: 0, river: 0, pond: 0, rain: 0.15 * w.rain, forest_day: 0, night_insects: 0, dawn_chorus: 0, underwater: 0.8, thunder: 0.2 * w.storm};
    }
    const forest = Math.max(z("woodland"), z("rainforest"));
    const green = Math.max(forest, z("grassland"), z("wetland"), z("farm_garden"), z("river_lake"));
    const mix: Record<ArkAmbientBed, number> = {
        waves: 0.7 * input.shore * (0.7 + 0.3 * w.wind),
        wind: Math.min(1, 0.12 + 0.6 * w.wind + 0.35 * input.altitude + 0.3 * w.storm) * (0.6 + 0.4 * Math.max(input.altitude, z("polar"), z("desert"), 1 - forest)),
        river: 0.6 * input.river,
        pond: 0.5 * input.pond * (0.6 + 0.4 * night),
        rain: Math.min(1, w.rain * 0.9 + w.storm * 0.1),
        forest_day: 0.55 * forest * day * quietInRain,
        night_insects: 0.5 * green * night * w.insects,
        dawn_chorus: 0.6 * green * dawnChorus(input.hours) * quietInRain,
        underwater: 0,
        thunder: w.storm
    };
    for (const bed of ARK_AMBIENT_BEDS) mix[bed] = Math.min(Math.max(mix[bed], 0), 1);
    return mix;
}

// ---------------------------------------------------------------------------
// Settings and tiers

export type ArkSoundTier = "high" | "medium" | "low";

/** Per quality tier: how many calls at once, how many beds, how far calls carry. */
export const ARK_SOUND_TIERS: Record<ArkSoundTier, {calls: number; beds: number; callDistance: number}> = {
    high: {calls: 6, beds: 5, callDistance: 60},
    medium: {calls: 4, beds: 3, callDistance: 45},
    low: {calls: 2, beds: 2, callDistance: 30}
};

/** The loudest `beds` beds, the rest silent. */
export function cappedMix(mix: Record<ArkAmbientBed, number>, beds: number): Record<ArkAmbientBed, number> {
    const keep = new Set([...ARK_AMBIENT_BEDS].filter((b) => mix[b] > 0.01).sort((a, b) => mix[b] - mix[a] || (a < b ? -1 : 1)).slice(0, Math.max(0, beds)));
    const out = {} as Record<ArkAmbientBed, number>;
    for (const bed of ARK_AMBIENT_BEDS) out[bed] = keep.has(bed) ? mix[bed] : 0;
    return out;
}

export const ARK_SOUND_STORAGE_KEY = "ark.sound.v1";

export type ArkSoundPreference = {on: boolean; volume: number};

/**
 * The sound setting on load: always off until the viewer taps. On the web a
 * remembered "on" only pre-selects the toggle (the first tap still unlocks
 * the audio); in the apps' panel (`embed`) nothing is remembered and nothing
 * plays until a tap inside the panel, so it never sounds inside a chat.
 */
export function initialSoundPreference(stored: string | null | undefined, embed: boolean): ArkSoundPreference & {remembered: boolean} {
    let volume = 0.7;
    let remembered = false;
    if (!embed && stored) {
        try {
            const parsed = JSON.parse(stored) as {on?: unknown; volume?: unknown};
            if (finite(parsed.volume)) volume = Math.min(Math.max(parsed.volume, 0), 1);
            remembered = parsed.on === true;
        } catch {
            // A bad value is ignored.
        }
    }
    return {on: false, volume, remembered};
}

export function storedSoundPreference(pref: ArkSoundPreference): string {
    return JSON.stringify({on: pref.on, volume: Math.round(Math.min(Math.max(pref.volume, 0), 1) * 100) / 100});
}

// ---------------------------------------------------------------------------
// Credits

/**
 * The credit lines for the sounds playing (or heard in this visit): one per
 * recordist + licence + source, in a stable order, with the original's page.
 * CC BY and CC BY-SA need this shown; CC0 and public domain are credited too.
 */
export function soundCreditLines(manifests: Array<ArkSoundManifest | null | undefined>): Array<{text: string; page: string | null; license: string}> {
    const seen = new Map<string, {text: string; page: string | null; license: string}>();
    for (const m of manifests) {
        for (const c of m?.credits ?? []) {
            const text = `${c.recordist} (${c.license}, ${c.source})`;
            if (!seen.has(text)) seen.set(text, {text, page: c.page ?? null, license: c.license});
        }
    }
    return Array.from(seen.values()).sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
}
