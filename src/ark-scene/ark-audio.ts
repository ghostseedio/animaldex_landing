/**
 * The Ark's sound player (liveliness wiring): one AudioContext, made only
 * when the viewer taps to turn sound on (`unlock`, from the tap's own
 * handler), so nothing sounds before that, on the web or in the apps' panel.
 *
 * It plays what the pure sound modules decide:
 * - the animals' calls, each at its shared moment (`scheduledCalls`, through
 *   `planCalls`): only the nearest few at once (the tier's voice cap, alarms
 *   first), quieter with distance, panned left or right of the camera;
 * - an alarm call the moment an animal raises one (`reactive.ts` `called`);
 * - the ambient beds the ambient lane picks (`selectAmbientBeds`), looped and
 *   crossfaded as the camera, the weather and the hour change.
 *
 * A call is only ever a species' own recordings (or its kind's, A1), never a
 * held bank, and never one without its manifest's credits (docs/ark-credits.md):
 * every recording heard is listed by `credits()` for the Sounds panel.
 *
 * Downloads wait for the tap too: no manifest or sprite is fetched while
 * sound is off. Under water everything is muffled. The context is suspended
 * while sound is off or the page is hidden.
 */

import {finalStatus, ModelFileError, readIsFinal, retrySeconds} from "@/ark-scene/model-files";
import {blendLoopSeam} from "@/ark-scene/ambient-beds";
import {alarmCall, bedsToPlay, planCalls, type ArkBedWanted, type ArkCallSource, type ArkListener, type ArkPlannedCall} from "@/lib/ark-audio-plan";
import {ARK_SOUND_BUCKET_PATH, ARK_SOUND_TIERS, callVoice, parseSoundManifest, soundAudioUrl, soundCreditLines, soundManifestUrl, speciesCallPace, type ArkCallMood, type ArkSoundCredit, type ArkSoundManifest, type ArkSoundTier} from "@/lib/ark-sound";

export type ArkAudioAnimal = {
    id: string;
    speciesProfileId: string;
    kindSpeciesProfileId?: string | null;
    x: number;
    y: number;
    z: number;
    mood: ArkCallMood;
};

export type ArkAudioBed = ArkBedWanted & {
    /** The bed's recordists (it is not played without them). */
    credits?: ArkSoundCredit[];
    /** The other format, where `url`'s can't be decoded (WebM Opus on older Safari and iOS web views). */
    fallbackUrl?: string;
    /** Loop from `loopStart` to `loopStart + loopSeconds` (s into the buffer); the whole buffer without them. */
    loopStart?: number;
    loopSeconds?: number;
    /** Seconds to reach a new gain (a time constant of ramp / 3). */
    ramp?: number;
    /** Where to start in the buffer (s, inside the loop): the same moment for every viewer. */
    offset?: number;
    /** Muffled (under water). */
    lowpassHz?: number;
};

/** A one-shot (thunder after lightning): when it sounds (shared ms), how loud, from where. */
export type ArkAudioShot = {id: string; url: string; fallbackUrl?: string; at: number; gain: number; pan?: number; credits?: ArkSoundCredit[]};

export type ArkAudioFrame = {
    /** The shared moment (ms since the epoch): calls fall at the same instants for everyone. */
    nowMs: number;
    listener: ArkListener;
    /** Animals near the camera (the scene passes those within the tier's call distance). */
    animals: ArkAudioAnimal[];
    /** Animals that raised an alarm this frame. */
    alarms: string[];
    beds: ArkAudioBed[];
    underwater?: boolean;
};

export type ArkAudioOptions = {
    /** The storage host (`https://<project>.supabase.co`); null: no calls (beds with full URLs still play). */
    soundBase: string | null;
    tier: ArkSoundTier;
    volume?: number;
    /** For tests: how to fetch, and how to make the context. */
    fetch?: (url: string) => Promise<{ok: boolean; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer>}>;
    createContext?: () => AudioContext | null;
    /** The list of recordings heard changed (the Sounds panel). */
    onCredits?: () => void;
};

/** How far ahead calls are put on the audio clock (ms), and how often the plan is made (ms). */
const LOOKAHEAD_MS = 1500;
const PLAN_EVERY_MS = 250;
/** Downloads at once, and decoded sprites kept. */
const FETCHES_AT_ONCE = 2;
const KEEP_BUFFERS = 28;
/** Beds sit under the calls. */
const BED_LEVEL = 0.5;
const CALL_LEVEL = 0.9;

type Voice = {source: AudioBufferSourceNode; gain: GainNode; ends: number; mood: ArkCallMood; loudness: number; animalId: string};
type Bed = {source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode | null; url: string; fadingOut: boolean; stopAt: number; ramp: number};

/** WebM Opus where the browser says it can play it, else M4A (Safari, iOS web views). */
function preferredFormat(): "webm" | "m4a" {
    try {
        const probe = typeof document !== "undefined" ? document.createElement("audio") : null;
        return probe && probe.canPlayType('audio/webm; codecs="opus"') ? "webm" : "m4a";
    } catch {
        return "m4a";
    }
}

function defaultContext(): AudioContext | null {
    const scope = globalThis as unknown as {AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext};
    const Context = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Context) return null;
    try {
        return new Context({latencyHint: "playback"});
    } catch {
        return new Context();
    }
}

export class ArkAudio {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private muffle: BiquadFilterNode | null = null;
    private on = false;
    private hidden = false;
    private volume: number;
    private tier: ArkSoundTier;
    private readonly fetcher: NonNullable<ArkAudioOptions["fetch"]>;
    private readonly manifests = new Map<string, ArkSoundManifest | null>();
    private readonly buffers = new Map<string, AudioBuffer | null>();
    private readonly bufferUsed = new Map<string, number>();
    private readonly loading = new Set<string>();
    private readonly queue: Array<() => Promise<void>> = [];
    private inflight = 0;
    private readonly voices = new Set<Voice>();
    private readonly beds = new Map<string, Bed>();
    private readonly started = new Set<string>();
    private scheduledTo = 0;
    private plannedAt = 0;
    private readonly heard = new Set<ArkSoundManifest>();
    /** Each animal's latest call: when it starts (shared ms) and how long it lasts (ms), for its head to come up with it. */
    private readonly calling = new Map<string, {at: number; ms: number}>();
    private readonly bedCredits = new Map<string, ArkSoundCredit[]>();
    /** Buffers whose loop seam is already blended. */
    private readonly seamed = new WeakSet<AudioBuffer>();
    private readonly shotsStarted = new Set<string>();
    private disposed = false;
    /** How many calls and beds have started (for the page's tests and the perf numbers). */
    readonly counts = {calls: 0, alarms: 0, beds: 0, fetches: 0, shots: 0};
    /** The beds' format this device decodes: WebM Opus where it can, else M4A (AAC). */
    readonly format: "webm" | "m4a";

    constructor(private readonly options: ArkAudioOptions) {
        this.volume = Math.min(Math.max(options.volume ?? 0.7, 0), 1);
        this.tier = options.tier;
        this.fetcher = options.fetch ?? ((url) => fetch(url, {cache: "force-cache"}));
        this.format = preferredFormat();
    }

    /** The context exists (the viewer has tapped sound on at least once). */
    get unlocked(): boolean {
        return Boolean(this.ctx);
    }

    /** Sound is on and playing (not hidden). */
    get playing(): boolean {
        return Boolean(this.ctx) && this.on && !this.hidden;
    }

    /**
     * Turn sound on from a tap: makes (or wakes) the one AudioContext. Call it
     * only inside the tap's own handler: browsers and the apps' web views
     * allow audio to start nowhere else. False when the device has no WebAudio.
     */
    unlock(): boolean {
        if (this.disposed) return false;
        if (!this.ctx) {
            const ctx = (this.options.createContext ?? defaultContext)();
            if (!ctx) return false;
            this.ctx = ctx;
            this.master = ctx.createGain();
            this.master.gain.value = 0;
            this.muffle = ctx.createBiquadFilter();
            this.muffle.type = "lowpass";
            this.muffle.frequency.value = 20000;
            this.muffle.connect(this.master);
            this.master.connect(ctx.destination);
            // Older WebKit: a silent sample started inside the tap opens the audio for good.
            try {
                const silent = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
                const source = ctx.createBufferSource();
                source.buffer = silent;
                source.connect(ctx.destination);
                source.start(0);
            } catch {
                // Nothing to open.
            }
        }
        void this.ctx.resume?.().catch(() => undefined);
        this.setOn(true);
        return true;
    }

    /** On (needs `unlock` first) or off: the master fades, and off the context sleeps. */
    setOn(on: boolean) {
        if (on && !this.ctx) return;
        this.on = on;
        this.applyMaster();
        if (!this.ctx) return;
        if (on && !this.hidden) void this.ctx.resume?.().catch(() => undefined);
        if (!on) this.sleepSoon();
    }

    setVolume(volume: number) {
        this.volume = Math.min(Math.max(Number.isFinite(volume) ? volume : 0.7, 0), 1);
        this.applyMaster();
    }

    setTier(tier: ArkSoundTier) {
        this.tier = tier;
    }

    /** The page went out of sight (or the app's panel closed): silence and sleep; back on when seen again. */
    setHidden(hidden: boolean) {
        this.hidden = hidden;
        this.applyMaster();
        if (!this.ctx) return;
        if (hidden) this.sleepSoon();
        else if (this.on) void this.ctx.resume?.().catch(() => undefined);
    }

    /** A tap anywhere while sound is on: wakes a context the system suspended (iOS after a call or the lock screen). */
    touch() {
        if (this.ctx && this.on && !this.hidden && this.ctx.state !== "running") void this.ctx.resume?.().catch(() => undefined);
    }

    private applyMaster() {
        if (!this.ctx || !this.master) return;
        const target = this.on && !this.hidden ? this.volume : 0;
        const at = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues?.(at);
        this.master.gain.setTargetAtTime(target, at, 0.12);
    }

    private sleepSoon() {
        const ctx = this.ctx;
        if (!ctx) return;
        setTimeout(() => {
            if (this.ctx === ctx && (!this.on || this.hidden)) void ctx.suspend?.().catch(() => undefined);
        }, 600);
    }

    // MARK: Downloads (only while on)

    private run(task: () => Promise<void>) {
        this.queue.push(task);
        this.pump();
    }

    private pump() {
        while (this.inflight < FETCHES_AT_ONCE && this.queue.length) {
            const task = this.queue.shift()!;
            this.inflight++;
            task()
                .catch(() => undefined)
                .finally(() => {
                    this.inflight--;
                    this.pump();
                });
        }
    }

    private manifestOf(speciesProfileId: string): ArkSoundManifest | null | undefined {
        if (this.manifests.has(speciesProfileId)) return this.manifests.get(speciesProfileId);
        const base = this.options.soundBase;
        if (!base || this.loading.has(speciesProfileId)) return undefined;
        this.loading.add(speciesProfileId);
        this.run(async () => {
            this.counts.fetches++;
            try {
                const response = await this.fetcher(soundManifestUrl(base, speciesProfileId));
                this.manifests.set(speciesProfileId, response.ok ? parseSoundManifest(await response.json()) : null);
            } catch {
                this.manifests.set(speciesProfileId, null);
            } finally {
                this.loading.delete(speciesProfileId);
            }
        });
        return undefined;
    }

    /** Sounds that failed to arrive: how many times in a row, and when they may be asked for again (`performance.now()`). */
    private readonly retries = new Map<string, {count: number; until: number}>();

    private bufferOf(url: string, now: number): AudioBuffer | null | undefined {
        if (this.buffers.has(url)) {
            this.bufferUsed.set(url, now);
            return this.buffers.get(url);
        }
        const ctx = this.ctx;
        if (!ctx || this.loading.has(url)) return undefined;
        // (One that only failed to arrive waits its turn before it is asked for again.)
        const again = this.retries.get(url);
        if (again && performance.now() < again.until) return undefined;
        this.loading.add(url);
        this.run(async () => {
            this.counts.fetches++;
            try {
                const response = await this.fetcher(url);
                if (!response.ok) {
                    // (A fetcher that gives no status, a test's: final, as every failure was before.)
                    const status = (response as {status?: number}).status;
                    throw new ModelFileError(`sound ${status ?? "not read"}`, typeof status === "number" ? finalStatus(status) : true);
                }
                const data = await response.arrayBuffer();
                const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
                    const promised = ctx.decodeAudioData(data, resolve, reject) as unknown as Promise<AudioBuffer> | undefined;
                    promised?.then?.(resolve, reject);
                });
                this.buffers.set(url, buffer);
                this.bufferUsed.set(url, now);
                this.retries.delete(url);
                this.evictBuffers();
            } catch (error) {
                // A file that is not there, or is not sound: never asked for again. One that only failed to arrive (a
                // phone changing networks): again when it is next wanted, after a wait that grows; before, that sound
                // was silent for the whole visit.
                if (readIsFinal(error)) this.buffers.set(url, null);
                else {
                    const count = (this.retries.get(url)?.count ?? 0) + 1;
                    this.retries.set(url, {count, until: performance.now() + retrySeconds(count) * 1000});
                }
            } finally {
                this.loading.delete(url);
            }
        });
        return undefined;
    }

    private evictBuffers() {
        const live = this.buffers.size;
        if (live <= KEEP_BUFFERS) return;
        const busy = new Set(Array.from(this.beds.values()).map((bed) => bed.url));
        const order = Array.from(this.bufferUsed.entries()).filter(([url]) => !busy.has(url)).sort((a, b) => a[1] - b[1]);
        for (let i = 0; i < live - KEEP_BUFFERS && i < order.length; i++) {
            this.buffers.delete(order[i][0]);
            this.bufferUsed.delete(order[i][0]);
        }
    }

    // MARK: Every frame

    step(frame: ArkAudioFrame) {
        if (!this.ctx || !this.master || this.disposed) return;
        const ctx = this.ctx;
        const nowMs = frame.nowMs;
        // Ended voices go.
        this.voices.forEach((voice) => {
            if (ctx.currentTime > voice.ends + 0.05) this.voices.delete(voice);
        });
        this.retireBeds(ctx.currentTime);
        if (!this.on || this.hidden) {
            this.scheduledTo = nowMs + LOOKAHEAD_MS;
            return;
        }
        const lowpass = frame.beds.reduce((low, bed) => (bed.lowpassHz && bed.lowpassHz < low ? bed.lowpassHz : low), frame.underwater ? 650 : 20000);
        this.muffle?.frequency.setTargetAtTime(lowpass, ctx.currentTime, 0.15);

        // Who could call: its own (or its kind's) bank, credited, not held back.
        const sources: ArkCallSource[] = [];
        const voiceOf = new Map<string, {manifest: ArkSoundManifest; speciesProfileId: string}>();
        const callDistance = ARK_SOUND_TIERS[this.tier].callDistance;
        for (const animal of frame.animals) {
            const d = Math.hypot(animal.x - frame.listener.x, animal.y - frame.listener.y, animal.z - frame.listener.z);
            if (d > callDistance) continue;
            const voice = callVoice({species_profile_id: animal.speciesProfileId, kind_species_profile_id: animal.kindSpeciesProfileId}, (id) => {
                const manifest = this.manifestOf(id);
                return manifest && manifest.credits.length ? manifest : null;
            });
            if (!voice) continue;
            const manifest = this.manifests.get(voice.speciesProfileId)!;
            voiceOf.set(animal.id, {manifest, speciesProfileId: voice.speciesProfileId});
            sources.push({id: animal.id, x: animal.x, y: animal.y, z: animal.z, mood: animal.mood, pace: speciesCallPace(manifest), callCount: manifest.calls.length});
        }
        const base = this.options.soundBase;
        const urlOf = (id: string) => {
            const v = voiceOf.get(id);
            return v && base ? soundAudioUrl(base, v.speciesProfileId, v.manifest) : null;
        };

        // Alarms at once (they take the place of the quietest calm call when the cap is full).
        for (const id of frame.alarms) {
            const source = sources.find((s) => s.id === id);
            const url = source ? urlOf(id) : null;
            if (!source || !url) continue;
            const call = alarmCall(source, frame.listener, nowMs, this.tier);
            const buffer = this.bufferOf(url, nowMs);
            if (call && buffer) this.play(call, buffer, voiceOf.get(id)!.manifest, nowMs, true);
        }

        // The calm calls of the coming moment, planned a few times a second.
        if (nowMs - this.plannedAt >= PLAN_EVERY_MS || nowMs < this.plannedAt) {
            this.plannedAt = nowMs;
            const from = Math.max(this.scheduledTo, nowMs);
            const to = nowMs + LOOKAHEAD_MS;
            if (to > from) {
                // Their sprites load as they come into hearing.
                for (const source of sources) {
                    const url = urlOf(source.id);
                    if (url) this.bufferOf(url, nowMs);
                }
                for (const call of planCalls(sources, frame.listener, from, to, this.tier)) {
                    const key = `${call.animalId}@${call.at}`;
                    if (this.started.has(key)) continue;
                    const url = urlOf(call.animalId);
                    const buffer = url ? this.bufferOf(url, nowMs) : null;
                    if (!buffer) continue;
                    if (this.play(call, buffer, voiceOf.get(call.animalId)!.manifest, nowMs, false)) this.started.add(key);
                }
                this.scheduledTo = to;
                if (this.started.size > 512) this.started.clear();
            }
        }

        this.stepBeds(frame, nowMs);
    }

    private play(call: ArkPlannedCall, buffer: AudioBuffer, manifest: ArkSoundManifest, nowMs: number, alarm: boolean): boolean {
        const ctx = this.ctx!;
        const span = manifest.calls[call.call] ?? manifest.calls[0];
        if (!span) return false;
        const cap = ARK_SOUND_TIERS[this.tier].calls;
        const loudness = call.gain;
        if (this.voices.size >= cap) {
            if (!alarm) return false;
            // An alarm takes the quietest calm voice's place.
            const quietest = Array.from(this.voices).filter((v) => v.mood !== "alarm").sort((a, b) => a.loudness - b.loudness)[0];
            if (!quietest) return false;
            this.stopVoice(quietest);
        }
        const when = ctx.currentTime + Math.max(0, (call.at - nowMs) / 1000);
        const [offset, duration] = span;
        if (offset >= buffer.duration) return false;
        const length = Math.min(duration, buffer.duration - offset);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = call.rate;
        const gain = ctx.createGain();
        gain.gain.value = loudness * CALL_LEVEL;
        let pan: StereoPannerNode | null = null;
        if (typeof ctx.createStereoPanner === "function") {
            pan = ctx.createStereoPanner();
            pan.pan.value = call.pan;
            source.connect(gain).connect(pan).connect(this.muffle!);
        } else {
            source.connect(gain).connect(this.muffle!);
        }
        source.start(when, offset, length);
        const voice: Voice = {source, gain, ends: when + length / Math.max(call.rate, 0.5), mood: call.mood, loudness, animalId: call.animalId};
        source.onended = () => {
            this.voices.delete(voice);
            try {
                source.disconnect();
                gain.disconnect();
                pan?.disconnect();
            } catch {
                // Already gone.
            }
        };
        this.voices.add(voice);
        this.calling.set(call.animalId, {at: call.at, ms: (length / Math.max(call.rate, 0.5)) * 1000});
        if (this.calling.size > 64) this.calling.delete(this.calling.keys().next().value as string);
        if (!this.heard.has(manifest)) {
            this.heard.add(manifest);
            this.options.onCredits?.();
        }
        if (alarm) this.counts.alarms++;
        else this.counts.calls++;
        return true;
    }

    private stopVoice(voice: Voice) {
        this.voices.delete(voice);
        try {
            voice.source.stop();
        } catch {
            // Not started yet, or done.
        }
    }

    /** A bed's URL: as given when absolute or site-relative, else inside the sound bucket's `v1/`. */
    private resolve(url: string): string | null {
        if (/^(https?:|blob:|data:)/.test(url) || url.startsWith("/")) return url;
        const base = this.options.soundBase;
        if (!base) return null;
        return `${base.replace(/\/$/, "")}/${ARK_SOUND_BUCKET_PATH}/${url.replace(/^\.?\//, "")}`;
    }

    private stepBeds(frame: ArkAudioFrame, nowMs: number) {
        const ctx = this.ctx!;
        const resolved = frame.beds.flatMap((bed) => {
            if ((bed.credits?.length ?? 0) === 0) return [];
            // Its own format, or the other where this one failed to decode here.
            const first = this.resolve(bed.url);
            const other = bed.fallbackUrl ? this.resolve(bed.fallbackUrl) : null;
            const url = first && this.buffers.get(first) === null && other ? other : first;
            return url ? [{...bed, url}] : [];
        });
        const wanted = bedsToPlay(resolved, ARK_SOUND_TIERS[this.tier].beds);
        const keep = new Set(wanted.map((bed) => bed.id));
        for (const bed of wanted) {
            const level = Math.min(Math.max(bed.gain, 0), 1) * BED_LEVEL;
            const constant = Math.max((bed.ramp ?? 2.4) / 3, 0.05);
            const playing = this.beds.get(bed.id);
            if (playing && playing.url === bed.url) {
                // Still sounding (or fading out and wanted again): to its new level.
                playing.fadingOut = false;
                playing.stopAt = Infinity;
                playing.gain.gain.setTargetAtTime(level, ctx.currentTime, constant);
                if (playing.pan) playing.pan.pan.setTargetAtTime(bed.pan ?? 0, ctx.currentTime, 0.5);
                continue;
            }
            const buffer = this.bufferOf(bed.url, nowMs);
            if (!buffer) continue;
            // Another file for the same bed (its fallback): the old one stops.
            if (playing) {
                playing.fadingOut = true;
                playing.stopAt = 0;
                this.retireBeds(ctx.currentTime);
            }
            const loopStart = bed.loopStart ?? 0;
            const looped = typeof bed.loopSeconds === "number" && bed.loopSeconds > 0 && loopStart + bed.loopSeconds <= buffer.duration;
            // Once per buffer: the loop's first milliseconds continue from its last, so the codec leaves no tick at the seam.
            if (looped && !this.seamed.has(buffer)) {
                for (let c = 0; c < buffer.numberOfChannels; c++) blendLoopSeam(buffer.getChannelData(c), buffer.sampleRate, loopStart, bed.loopSeconds!);
                this.seamed.add(buffer);
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            if (looped) {
                source.loopStart = loopStart;
                source.loopEnd = loopStart + bed.loopSeconds!;
            }
            const gain = ctx.createGain();
            gain.gain.value = 0;
            let pan: StereoPannerNode | null = null;
            if (typeof ctx.createStereoPanner === "function") {
                pan = ctx.createStereoPanner();
                pan.pan.value = bed.pan ?? 0;
                source.connect(gain).connect(pan).connect(this.muffle!);
            } else {
                source.connect(gain).connect(this.muffle!);
            }
            // At the shared point of its loop (the same moment for every viewer), else its own point of the buffer.
            const at = looped && typeof bed.offset === "number" && bed.offset >= loopStart && bed.offset < loopStart + bed.loopSeconds! ? bed.offset : looped ? loopStart : (buffer.duration * ((nowMs / 1000) % 97)) / 97;
            source.start(ctx.currentTime, at);
            gain.gain.setTargetAtTime(level, ctx.currentTime, constant);
            this.beds.set(bed.id, {source, gain, pan, url: bed.url, fadingOut: false, stopAt: Infinity, ramp: Math.max(bed.ramp ?? 2.4, 0.3)});
            this.counts.beds++;
            if (bed.credits && !this.bedCredits.has(bed.url)) {
                this.bedCredits.set(bed.url, bed.credits);
                this.options.onCredits?.();
            }
        }
        this.beds.forEach((bed, id) => {
            if (!keep.has(id) && !bed.fadingOut) this.fadeBed(bed, ctx.currentTime);
        });
    }

    private fadeBed(bed: Bed, at: number) {
        bed.fadingOut = true;
        bed.gain.gain.setTargetAtTime(0, at, bed.ramp / 3);
        bed.stopAt = at + bed.ramp * 1.6;
    }

    private retireBeds(at: number) {
        this.beds.forEach((bed, id) => {
            if (!bed.fadingOut || at < bed.stopAt) return;
            try {
                bed.source.stop();
                bed.source.disconnect();
                bed.gain.disconnect();
                bed.pan?.disconnect();
            } catch {
                // Done.
            }
            if (this.beds.get(id) === bed) this.beds.delete(id);
        });
    }

    /** Fetch (and decode) these now, ahead of need (thunder once a storm is near). Only while sound is on. */
    preload(urls: Array<string | undefined>) {
        if (!this.ctx || !this.on) return;
        const now = Date.now();
        for (const url of urls) {
            const resolved = url ? this.resolve(url) : null;
            if (resolved) this.bufferOf(resolved, now);
        }
    }

    /**
     * A one-shot at its shared moment (thunder `at`, after its flash): played once, panned, not counted against the
     * calls' cap; skipped when its sprite isn't in yet or its moment has passed.
     */
    shot(clip: ArkAudioShot, nowMs: number): boolean {
        const ctx = this.ctx;
        if (!ctx || !this.master || !this.on || this.hidden || (clip.credits?.length ?? 0) === 0) return false;
        const key = `${clip.id}@${clip.at}`;
        if (this.shotsStarted.has(key) || clip.at < nowMs - 250) return false;
        const first = this.resolve(clip.url);
        const other = clip.fallbackUrl ? this.resolve(clip.fallbackUrl) : null;
        const url = first && this.buffers.get(first) === null && other ? other : first;
        const buffer = url ? this.bufferOf(url, nowMs) : null;
        if (!buffer) return false;
        this.shotsStarted.add(key);
        if (this.shotsStarted.size > 256) this.shotsStarted.clear();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = Math.min(Math.max(clip.gain, 0), 1) * BED_LEVEL * 1.6;
        let pan: StereoPannerNode | null = null;
        if (typeof ctx.createStereoPanner === "function") {
            pan = ctx.createStereoPanner();
            pan.pan.value = clip.pan ?? 0;
            source.connect(gain).connect(pan).connect(this.muffle!);
        } else {
            source.connect(gain).connect(this.muffle!);
        }
        source.start(ctx.currentTime + Math.max(0, (clip.at - nowMs) / 1000));
        source.onended = () => {
            try {
                source.disconnect();
                gain.disconnect();
                pan?.disconnect();
            } catch {
                // Gone.
            }
        };
        this.counts.shots++;
        if (clip.credits && !this.bedCredits.has(clip.id)) {
            this.bedCredits.set(clip.id, clip.credits);
            this.options.onCredits?.();
        }
        return true;
    }

    /** Every recording heard in this visit (calls and beds), one line per recordist, licence and source. */
    credits(): Array<{text: string; page: string | null; license: string}> {
        const bedManifests = Array.from(this.bedCredits.values()).map((credits) => ({credits}) as unknown as ArkSoundManifest);
        return soundCreditLines([...Array.from(this.heard), ...bedManifests]);
    }

    /** The recordists of one species' own voice (the tap card's "Sounds:" line), once its manifest is in. */
    creditsFor(speciesProfileId: string, kindSpeciesProfileId?: string | null): Array<{text: string; page: string | null; license: string}> {
        const voice = callVoice({species_profile_id: speciesProfileId, kind_species_profile_id: kindSpeciesProfileId}, (id) => this.manifests.get(id) ?? null);
        return voice ? soundCreditLines([this.manifests.get(voice.speciesProfileId)]) : [];
    }

    /** An animal's latest call heard (shared ms and length), or null. */
    callOf(animalId: string): {at: number; ms: number} | null {
        return this.calling.get(animalId) ?? null;
    }

    /** Voices sounding now and beds playing (for stats). */
    activity(): {voices: number; beds: number; on: boolean} {
        return {voices: this.voices.size, beds: Array.from(this.beds.values()).filter((bed) => !bed.fadingOut).length, on: this.playing};
    }

    dispose() {
        this.disposed = true;
        this.voices.forEach((voice) => this.stopVoice(voice));
        this.beds.forEach((bed) => {
            try {
                bed.source.stop();
            } catch {
                // Done.
            }
        });
        this.beds.clear();
        this.queue.length = 0;
        void this.ctx?.close?.().catch(() => undefined);
        this.ctx = null;
    }
}
