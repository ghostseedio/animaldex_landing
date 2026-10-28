/**
 * The animal's own voice while it types: real field recordings of its
 * species, never synthesised. One of its calls when it starts to speak, then
 * its short sounds on words as the reply types, spaced the way that animal
 * calls in the wild.
 *
 * Each species' bank lives in the public `animal-chat-sounds` bucket at
 * v1/<species_profile_id>/manifest.json, beside the AAC file it names (an
 * animal with no recordings of its own — most fish, spiders, insects — has
 * one of where it lives, whose audio is shared under v1/habitat/). A species
 * with no bank simply types in silence.
 *
 * Port of `AnimalSoundBank` and `AnimalChatVoiceScheduler` in the iOS app
 * (`AnimalChatSounds.swift`, AnimalDex 6471f467, 46809a93), rule for rule,
 * with its tests. Pure: the clock and the dice are passed in. The drawer's
 * `use-animal-sounds.ts` fetches and plays.
 */

/** The public bucket's v1 folder (the site already reads its other public buckets by this address). */
export const ASK_SOUNDS_BASE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animal-chat-sounds/v1";

/** A sound cut from the bank's audio: [start, duration] in seconds. */
export type AskSoundSegment = {start: number; duration: number};

/** Whose recording it is: shown in the chat, as the licences require. */
export type AskSoundCredit = {recordist: string; license: string; source: string; page: string | null};

export type AskSoundBank = {
    version: number;
    /** The species' own recordings, or, for an animal with none, recordings of where it lives. */
    kind: "species" | "habitat";
    /** Habitat banks: "the reef", "the forest floor". */
    habitatLabel: string | null;
    /**
     * The audio file's name beside the manifest; content-hashed, so a new cut
     * gets a new name. For a habitat bank, the shared file's path under v1/.
     */
    audio: string;
    calls: AskSoundSegment[];
    grains: AskSoundSegment[];
    /** short: chirps, croaks, meows. long: howls, whale song, sparingly. ambient: where it lives. */
    style: "short" | "long" | "ambient";
    /** How the species calls in the wild: seconds from one call to the next, and one call's length. */
    rhythm: {interval: number; callLength: number};
    credits: AskSoundCredit[];
};

const HABITAT_AUDIO = /^habitat\/[a-z0-9-]+\/sprite-[0-9a-f]{8}\.m4a$/;

function segments(raw: unknown): AskSoundSegment[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item): AskSoundSegment[] => {
        if (!Array.isArray(item) || item.length < 2) return [];
        const start = Number(item[0]);
        const duration = Number(item[1]);
        return Number.isFinite(start) && Number.isFinite(duration) && duration > 0 ? [{start, duration}] : [];
    });
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/**
 * A published manifest, or null when it is not a bank this player can trust:
 * no calls, a species audio that is not beside its manifest, or a habitat
 * audio outside the shared habitat folder.
 */
export function parseAskSoundBank(raw: unknown): AskSoundBank | null {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!row || typeof row.version !== "number") return null;
    const kind = row.kind === "habitat" ? "habitat" : "species";
    let audio: string;
    if (kind === "habitat") {
        // Shared by every animal of that habitat, so cached once.
        if (typeof row.shared_audio !== "string" || !HABITAT_AUDIO.test(row.shared_audio)) return null;
        audio = row.shared_audio;
    } else {
        if (typeof row.audio !== "string" || !row.audio || row.audio.includes("/")) return null;
        audio = row.audio;
    }
    const calls = segments(row.calls);
    if (calls.length === 0) return null;
    const rhythmRow = row.rhythm && typeof row.rhythm === "object" ? row.rhythm as Record<string, unknown> : {};
    const interval = Number(rhythmRow.ioi);
    const callLength = Number(rhythmRow.event);
    // A bad value must never make the animal chatter nonstop or go mute.
    const rhythm = {
        interval: clamp(Number.isFinite(interval) ? interval : 0.6, 0.08, 3),
        callLength: clamp(Number.isFinite(callLength) ? callLength : 0.3, 0.04, 3)
    };
    const credits = (Array.isArray(row.credits) ? row.credits : []).flatMap((item): AskSoundCredit[] => {
        const credit = item && typeof item === "object" ? item as Record<string, unknown> : null;
        if (!credit || typeof credit.recordist !== "string") return [];
        const page = typeof credit.page === "string" && /^https:\/\//.test(credit.page) ? credit.page : null;
        return [{
            recordist: credit.recordist,
            license: typeof credit.license === "string" ? credit.license : "",
            source: typeof credit.source === "string" ? credit.source : "",
            page
        }];
    });
    return {
        version: row.version,
        kind,
        habitatLabel: kind === "habitat" && typeof row.habitat_label === "string" ? row.habitat_label : null,
        audio,
        calls,
        grains: segments(row.grains),
        style: row.style === "long" || row.style === "ambient" ? row.style : "short",
        rhythm,
        credits
    };
}

/** Calls first, then grains: the order the player keeps its buffers in. */
export function askSoundSegments(bank: AskSoundBank): AskSoundSegment[] {
    return [...bank.calls, ...bank.grains];
}

/** Where a bank's audio is: beside its manifest, or the habitat's shared file. */
export function askSoundAudioUrl(speciesProfileId: string, bank: AskSoundBank): string {
    return bank.kind === "habitat"
        ? `${ASK_SOUNDS_BASE}/${bank.audio}`
        : `${ASK_SOUNDS_BASE}/${speciesProfileId.toLowerCase()}/${bank.audio}`;
}

export function askSoundManifestUrl(speciesProfileId: string): string {
    return `${ASK_SOUNDS_BASE}/${speciesProfileId.toLowerCase()}/manifest.json`;
}

/** One sound to play: which, whether it is a full call, and how. */
export type AskSoundCue = {
    /** Index into `askSoundSegments(bank)`. */
    segment: number;
    isCall: boolean;
    /**
     * Playback rate: speed and pitch together, as a slightly bigger or smaller
     * voice would sound. Never a pitch shift on its own, which is what makes
     * processed audio sound robotic.
     */
    rate: number;
    gain: number;
};

/** Dice in [0, 1): `Math.random` in the drawer, seeded in the tests. */
export type AskRandom = () => number;

const between = (random: AskRandom, low: number, high: number) => low + (high - low) * random();

/**
 * Decides when the animal makes a sound as its reply types out.
 *
 * The rules: a call as the first word appears (a short sound instead if it
 * called less than 25 s ago); after that, a short sound on a word once the
 * animal's own interval has passed, never over a sound still playing, never
 * on the word after a full stop (it draws breath), never the same sound twice
 * in a row, each at a slightly different speed and loudness. It settles down
 * as a long reply goes on, the way an animal does once it has your attention.
 */
export class AskVoiceScheduler {
    pace: string;
    private busyUntil = -Infinity;
    private lastStart = -Infinity;
    private lastCallAt = -Infinity;
    private replies = 0;
    private soundsThisReply = 0;
    private drawingBreath = false;
    private lastGrain: number | null = null;
    private bag: number[] = [];

    constructor(readonly bank: AskSoundBank, pace = "measured") {
        this.pace = pace;
    }

    /**
     * Seconds between sounds before the dice: the animal's own interval,
     * stretched for a slow talker, at least 2.8 s for long-call animals.
     */
    get baseInterval(): number {
        const paceFactor = this.pace === "quick" ? 0.85 : this.pace === "slow" ? 1.25 : 1;
        const base = Math.max(this.bank.rhythm.interval, 0.22) * paceFactor;
        switch (this.bank.style) {
            case "long":
                return Math.max(base, 2.8);
            case "ambient":
                return Math.max(base, 3.5);
            default:
                return base;
        }
    }

    /** Surroundings sit under the words, softer than a voice. */
    private get softness(): number {
        return this.bank.style === "ambient" ? 0.7 : 1;
    }

    replyBegan(now: number, random: AskRandom): AskSoundCue | null {
        this.soundsThisReply = 0;
        this.drawingBreath = false;
        if (now - this.lastCallAt < 25 && this.bank.grains.length > 0) {
            // Back and forth quickly: a full call every reply gets tiring.
            return this.grain(now, random);
        }
        const index = this.replies % this.bank.calls.length;
        this.replies += 1;
        this.lastCallAt = now;
        return this.start(index, true, now, between(random, 0.98, 1.02), 0.85 * this.softness, 0.15);
    }

    wordShown(now: number, endsSentence: boolean, random: AskRandom): AskSoundCue | null {
        const breath = this.drawingBreath;
        this.drawingBreath = endsSentence;
        if (breath || now < this.busyUntil || this.bank.grains.length === 0) return null;
        const settling = Math.min(1 + 0.04 * this.soundsThisReply, 2);
        const wait = this.baseInterval * settling * between(random, 0.75, 1.35);
        if (now - this.lastStart < wait) return null;
        return this.grain(now, random);
    }

    /**
     * Asked to hear it ("Hear its call"): a full call now, the next of its
     * calls in turn, however recently it called.
     */
    callOnRequest(now: number, random: AskRandom): AskSoundCue {
        const index = this.replies % this.bank.calls.length;
        this.replies += 1;
        this.lastCallAt = now;
        return this.start(index, true, now, between(random, 0.98, 1.02), 0.95 * this.softness, 0.15);
    }

    private grain(now: number, random: AskRandom): AskSoundCue | null {
        if (this.bag.length === 0) {
            const grains = this.bank.grains.map((_, index) => index);
            this.bag = grains.filter((index) => index !== this.lastGrain || grains.length === 1);
            // Fisher–Yates, on the same dice.
            for (let index = this.bag.length - 1; index > 0; index -= 1) {
                const other = Math.floor(random() * (index + 1));
                [this.bag[index], this.bag[other]] = [this.bag[other], this.bag[index]];
            }
        }
        const pick = this.bag.pop();
        if (pick === undefined) return null;
        this.lastGrain = pick;
        return this.start(this.bank.calls.length + pick, false, now, between(random, 0.965, 1.035), between(random, 0.42, 0.58) * this.softness, 0.06);
    }

    private start(segment: number, isCall: boolean, now: number, rate: number, gain: number, tail: number): AskSoundCue {
        const duration = askSoundSegments(this.bank)[segment].duration / rate;
        this.busyUntil = now + duration + tail;
        this.lastStart = now;
        this.soundsThisReply += 1;
        return {segment, isCall, rate, gain};
    }
}
