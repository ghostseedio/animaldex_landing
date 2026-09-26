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
        <section
            aria-label="Article audio"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-[color:var(--rule)] py-3"
        >
            <button
                type="button"
                onClick={togglePlayback}
                disabled={!isSupported || chunks.length === 0}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--rule-strong)] bg-[color:var(--paper-800)] text-[color:var(--lime)] transition-colors hover:border-[color:var(--lime)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={primaryLabel}
            >
                {playbackState === "playing" ? (
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="M5 3h3v14H5V3Zm7 0h3v14h-3V3Z" /></svg>
                ) : (
                    <svg viewBox="0 0 20 20" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="m5 3 12 7-12 7V3Z" /></svg>
                )}
            </button>

            <div className="order-3 w-full min-w-0 sm:order-none sm:flex-1">
                <p className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-300)]">
                    {isSupported ? "Listen to this story" : "Listen"}
                </p>
                {/* The rail doubles as the progress read-out, so an extra bar and
                    a percentage caption are both unnecessary. */}
                <div className="mt-2 h-px w-full bg-[color:var(--rule)]" role="presentation">
                    <div
                        className="h-px bg-[color:var(--lime)] transition-[width] duration-500"
                        style={{width: `${progress}%`}}
                    />
                </div>
                {!isSupported ? (
                    <p className="mt-2 text-[12px] text-[color:var(--text-400)]">
                        Text-to-speech is not supported by this browser.
                    </p>
                ) : null}
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
                {playbackState !== "idle" && (
                    <button
                        type="button"
                        onClick={restart}
                        className="inline-flex h-10 items-center rounded-full px-3 text-[12px] font-semibold text-[color:var(--text-300)] transition-colors hover:text-[color:var(--text-100)]"
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
                    className="h-10 cursor-pointer rounded-full border border-[color:var(--rule-strong)] bg-transparent px-3 font-mono text-[12px] tabular-nums text-[color:var(--text-200)] outline-none transition-colors hover:border-[color:var(--lime)] focus-visible:border-[color:var(--lime)] disabled:opacity-40"
                    aria-label="Playback speed"
                >
                    <option value={0.8}>0.8&#215;</option>
                    <option value={1}>1&#215;</option>
                    <option value={1.25}>1.25&#215;</option>
                    <option value={1.5}>1.5&#215;</option>
                </select>
            </div>
        </section>
    );
}
