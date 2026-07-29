"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";

type PlaybackState = "idle" | "playing" | "paused";

type BlogListenControlProps = {
    locale: string;
    text: string;
};

function splitForSpeech(text: string) {
    const normalized = text.replace(/\s+/g, " ").trim();
    const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized];
    const chunks: string[] = [];

    for (const sentence of sentences) {
        const cleanSentence = sentence.trim();

        if (cleanSentence.length <= 240) {
            chunks.push(cleanSentence);
            continue;
        }

        const words = cleanSentence.split(" ");
        let chunk = "";

        for (const word of words) {
            const candidate = chunk ? `${chunk} ${word}` : word;

            if (candidate.length > 240 && chunk) {
                chunks.push(chunk);
                chunk = word;
            } else {
                chunk = candidate;
            }
        }

        if (chunk) {
            chunks.push(chunk);
        }
    }

    return chunks.filter(Boolean);
}

function getPreferredVoice(locale: string) {
    const voices = window.speechSynthesis.getVoices();
    const language = locale.toLowerCase();
    const baseLanguage = language.split("-")[0];

    return voices.find((voice) => voice.lang.toLowerCase() === language)
        || voices.find((voice) => voice.lang.toLowerCase().startsWith(`${baseLanguage}-`))
        || voices.find((voice) => voice.default)
        || voices[0];
}

export default function BlogListenControl({locale, text}: BlogListenControlProps) {
    const chunks = useMemo(() => splitForSpeech(text), [text]);
    const [isSupported, setIsSupported] = useState(true);
    const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
    const [currentChunk, setCurrentChunk] = useState(0);
    const [rate, setRate] = useState(1);
    const chunkIndexRef = useRef(0);
    const rateRef = useRef(rate);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        rateRef.current = rate;
    }, [rate]);

    const reset = useCallback(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        utteranceRef.current = null;
        chunkIndexRef.current = 0;
        setCurrentChunk(0);
        setPlaybackState("idle");
    }, []);

    const speakChunk = useCallback((index: number) => {
        if (!("speechSynthesis" in window) || index >= chunks.length) {
            reset();
            return;
        }

        chunkIndexRef.current = index;
        setCurrentChunk(index);

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = locale;
        utterance.rate = rateRef.current;
        utterance.pitch = 1;
        utterance.voice = getPreferredVoice(locale) || null;
        utterance.onend = () => {
            if (utteranceRef.current !== utterance) {
                return;
            }

            const nextIndex = index + 1;

            if (nextIndex < chunks.length) {
                speakChunk(nextIndex);
            } else {
                reset();
            }
        };
        utterance.onerror = (event) => {
            if (event.error !== "canceled" && event.error !== "interrupted") {
                reset();
            }
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setPlaybackState("playing");
    }, [chunks, locale, reset]);

    useEffect(() => {
        const supported = typeof window !== "undefined"
            && "speechSynthesis" in window
            && "SpeechSynthesisUtterance" in window;

        setIsSupported(supported);

        return () => {
            if (supported) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    function togglePlayback() {
        if (!isSupported || chunks.length === 0) {
            return;
        }

        if (playbackState === "playing") {
            window.speechSynthesis.pause();
            setPlaybackState("paused");
            return;
        }

        if (playbackState === "paused") {
            window.speechSynthesis.resume();
            setPlaybackState("playing");
            return;
        }

        window.speechSynthesis.cancel();
        speakChunk(0);
    }

    function restart() {
        if (!isSupported) {
            return;
        }

        window.speechSynthesis.cancel();
        utteranceRef.current = null;
        speakChunk(0);
    }

    function changeRate(nextRate: number) {
        setRate(nextRate);
        rateRef.current = nextRate;

        if (playbackState !== "idle") {
            const resumeAt = chunkIndexRef.current;
            window.speechSynthesis.cancel();
            utteranceRef.current = null;
            speakChunk(resumeAt);
        }
    }

    const progress = playbackState === "idle" || chunks.length === 0
        ? 0
        : Math.max(2, ((currentChunk + 1) / chunks.length) * 100);
    const primaryLabel = playbackState === "playing"
        ? "Pause"
        : playbackState === "paused"
            ? "Resume"
            : "Listen to article";

    return (
        <section className="overflow-hidden rounded-3xl border border-primary-500/25 bg-[linear-gradient(135deg,rgba(28,196,81,0.1),rgba(14,27,19,0.84))] shadow-[0_20px_70px_-48px_rgba(47,220,106,0.7)]" aria-label="Article audio">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-400/30 bg-primary-400/15 text-primary-100">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M4 14h3l4 4V6L7 10H4v4Z" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="font-display text-lg font-bold text-white">Listen to this story</p>
                        <p className="text-sm text-ink-300">
                            {isSupported
                                ? playbackState === "idle"
                                    ? "Hear the full article read aloud."
                                    : `${Math.round(progress)}% complete`
                                : "Text-to-speech is not supported by this browser."}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={togglePlayback}
                        disabled={!isSupported || chunks.length === 0}
                        className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-primary-300 px-5 text-sm font-bold text-canvas-950 transition-colors hover:bg-primary-200 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label={primaryLabel}
                    >
                        {playbackState === "playing" ? (
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M5 3h3v14H5V3Zm7 0h3v14h-3V3Z" /></svg>
                        ) : (
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="m5 3 12 7-12 7V3Z" /></svg>
                        )}
                        {primaryLabel}
                    </button>

                    {playbackState !== "idle" && (
                        <button
                            type="button"
                            onClick={restart}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-line-300 bg-surface-900/70 px-4 text-sm font-semibold text-ink-100 transition-colors hover:border-primary-400 hover:text-primary-100"
                        >
                            Restart
                        </button>
                    )}

                    <label className="sr-only" htmlFor="blog-narration-speed">Playback speed</label>
                    <select
                        id="blog-narration-speed"
                        value={rate}
                        onChange={(event) => changeRate(Number(event.target.value))}
                        disabled={!isSupported}
                        className="min-h-[42px] rounded-full border border-line-300 bg-surface-900/80 px-3 text-sm font-semibold text-ink-100 outline-none transition-colors hover:border-primary-400 focus:border-primary-400 disabled:opacity-45"
                        aria-label="Playback speed"
                    >
                        <option value={0.8}>0.8×</option>
                        <option value={1}>1×</option>
                        <option value={1.25}>1.25×</option>
                        <option value={1.5}>1.5×</option>
                    </select>
                </div>
            </div>
            <div className="h-1 bg-white/[0.05]" aria-hidden="true">
                <div className="h-full bg-primary-300 transition-[width] duration-300" style={{width: `${progress}%`}} />
            </div>
        </section>
    );
}
