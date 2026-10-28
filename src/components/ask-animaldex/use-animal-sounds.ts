"use client";

/**
 * Plays the animal's own recorded sounds as its reply types: one of its calls
 * as the first word appears, then its short sounds on words, at its own
 * rhythm (`AskVoiceScheduler`). Quiet, under the words, off from the chat's
 * menu, and held while the animal's spoken voice plays.
 *
 * The web counterpart of `AnimalChatSoundscape` and `AnimalSoundBankStore`
 * in the iOS app (AnimalDex 6471f467, 46809a93): the bank's manifest and
 * audio come from the public `animal-chat-sounds` bucket (the browser's cache
 * keeps them; a species with no bank is remembered as such for three days),
 * the audio is decoded once and cut into one buffer per sound, and each cue
 * plays at its own rate (speed and pitch together) and loudness.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {
    AskVoiceScheduler,
    askSoundAudioUrl,
    askSoundManifestUrl,
    askSoundSegments,
    parseAskSoundBank,
    type AskSoundBank,
    type AskSoundCue
} from "@/lib/ask-animaldex/animal-sounds";

/** The chat menu's "Animal sounds" switch. */
export const ASK_ANIMAL_SOUNDS_KEY = "animaldex:ask:animal-sounds";

const NONE_KEY_PREFIX = "animaldex:ask:sounds-none:";
const NONE_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
/** Overall level under the system volume: present, never loud. */
const LEVEL = 0.6;

type Decoded = {bank: AskSoundBank; buffers: AudioBuffer[]};

/** Banks and their decoded sounds for this page, so reopening the chat does not fetch them again. */
const decodedBanks = new Map<string, Promise<Decoded | null>>();

function readFlag(key: string): boolean {
    try {
        return window.localStorage.getItem(key) !== "off";
    } catch {
        return true;
    }
}

function knownToHaveNone(speciesProfileId: string): boolean {
    try {
        const at = Number(window.localStorage.getItem(`${NONE_KEY_PREFIX}${speciesProfileId}`));
        return Number.isFinite(at) && at > 0 && Date.now() - at < NONE_LIFETIME_MS;
    } catch {
        return false;
    }
}

function rememberNone(speciesProfileId: string) {
    try {
        window.localStorage.setItem(`${NONE_KEY_PREFIX}${speciesProfileId}`, String(Date.now()));
    } catch {
        // Asked again next time, then.
    }
}

let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext | null {
    if (sharedContext) return sharedContext;
    const Context = typeof window === "undefined"
        ? null
        : window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext ?? null;
    if (!Context) return null;
    try {
        sharedContext = new Context();
    } catch {
        sharedContext = null;
    }
    return sharedContext;
}

async function loadBank(speciesProfileId: string): Promise<Decoded | null> {
    if (knownToHaveNone(speciesProfileId)) return null;
    let bank: AskSoundBank | null;
    try {
        const response = await fetch(askSoundManifestUrl(speciesProfileId));
        if (response.status === 400 || response.status === 404) {
            // Storage answers 400 for a missing object on some routes.
            rememberNone(speciesProfileId);
            return null;
        }
        if (!response.ok) return null;
        bank = parseAskSoundBank(await response.json());
    } catch {
        return null;
    }
    const context = audioContext();
    if (!bank || !context) return null;
    try {
        const response = await fetch(askSoundAudioUrl(speciesProfileId, bank));
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        if (data.byteLength < 1000) return null;
        const whole = await context.decodeAudioData(data);
        const buffers: AudioBuffer[] = [];
        for (const segment of askSoundSegments(bank)) {
            const start = Math.floor(segment.start * whole.sampleRate);
            const count = Math.floor(segment.duration * whole.sampleRate);
            if (start < 0 || count <= 0 || start + count > whole.length) return null;
            const slice = context.createBuffer(whole.numberOfChannels, count, whole.sampleRate);
            for (let channel = 0; channel < whole.numberOfChannels; channel += 1) {
                slice.copyToChannel(whole.getChannelData(channel).subarray(start, start + count), channel);
            }
            buffers.push(slice);
        }
        return {bank, buffers};
    } catch {
        return null;
    }
}

export function useAnimalSounds(params: {
    /** The canonical species: its bank is filed under it. Null: no sounds. */
    speciesProfileId: string | null;
    /** slow, measured or quick, from the persona the server reported. */
    pace: string | null;
    /** Held quiet while the animal's spoken voice plays. */
    held: boolean;
}) {
    const {speciesProfileId, pace, held} = params;
    const [bank, setBank] = useState<AskSoundBank | null>(null);
    const [soundsOn, setSoundsOnState] = useState(true);
    useEffect(() => setSoundsOnState(readFlag(ASK_ANIMAL_SOUNDS_KEY)), []);

    const buffersRef = useRef<AudioBuffer[]>([]);
    const schedulerRef = useRef<AskVoiceScheduler | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const latest = useRef({soundsOn, held});
    latest.current = {soundsOn, held};

    useEffect(() => {
        setBank(null);
        buffersRef.current = [];
        schedulerRef.current = null;
        if (!speciesProfileId) return;
        let cancelled = false;
        const id = speciesProfileId.toLowerCase();
        let pending = decodedBanks.get(id);
        if (!pending) {
            pending = loadBank(id);
            decodedBanks.set(id, pending);
        }
        void pending.then((decoded) => {
            // Nothing came of it (offline, a failed decode): tried again next time.
            if (!decoded) decodedBanks.delete(id);
            if (cancelled || !decoded) return;
            buffersRef.current = decoded.buffers;
            schedulerRef.current = new AskVoiceScheduler(decoded.bank, "measured");
            setBank(decoded.bank);
        });
        return () => {
            cancelled = true;
        };
    }, [speciesProfileId]);

    useEffect(() => {
        if (schedulerRef.current) schedulerRef.current.pace = pace ?? "measured";
    }, [pace, bank]);

    const stop = useCallback(() => {
        try {
            sourceRef.current?.stop();
        } catch {
            // Already finished.
        }
        sourceRef.current = null;
    }, []);

    const playCue = useCallback((cue: AskSoundCue) => {
        const context = audioContext();
        const buffer = buffersRef.current[cue.segment];
        if (!context || !buffer) return;
        if (context.state === "suspended") void context.resume().catch(() => undefined);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = cue.rate;
        const gain = context.createGain();
        gain.gain.value = cue.gain * LEVEL;
        source.connect(gain).connect(context.destination);
        source.onended = () => {
            if (sourceRef.current === source) sourceRef.current = null;
        };
        sourceRef.current = source;
        source.start();
    }, []);

    const canPlay = () => latest.current.soundsOn && !latest.current.held && buffersRef.current.length > 0;

    /** The first word of a reply is on screen. */
    const replyBegan = useCallback(() => {
        const scheduler = schedulerRef.current;
        if (!scheduler || !canPlay()) return;
        const cue = scheduler.replyBegan(performance.now() / 1000, Math.random);
        if (cue) playCue(cue);
    }, [playCue]);

    /** Another word of the reply is on screen. */
    const wordShown = useCallback((endsSentence: boolean) => {
        const scheduler = schedulerRef.current;
        if (!scheduler || !canPlay()) return;
        const cue = scheduler.wordShown(performance.now() / 1000, endsSentence, Math.random);
        if (cue) playCue(cue);
    }, [playCue]);

    /**
     * "Hear its call" in the chat's menu: one full call now, whatever already
     * sounds giving way. The caller stops the spoken voice first.
     */
    const playCall = useCallback(() => {
        const scheduler = schedulerRef.current;
        if (!scheduler || !latest.current.soundsOn || buffersRef.current.length === 0) return;
        stop();
        playCue(scheduler.callOnRequest(performance.now() / 1000, Math.random));
    }, [playCue, stop]);

    // The voice started, or the sounds were switched off: silence now.
    useEffect(() => {
        if (held || !soundsOn) stop();
    }, [held, soundsOn, stop]);

    // Closing the chat silences it.
    useEffect(() => stop, [stop]);

    const setSoundsOn = useCallback((on: boolean) => {
        setSoundsOnState(on);
        try {
            window.localStorage.setItem(ASK_ANIMAL_SOUNDS_KEY, on ? "on" : "off");
        } catch {
            // For this page, then.
        }
    }, []);

    return {bank, soundsOn, setSoundsOn, replyBegan, wordShown, playCall, stop};
}
