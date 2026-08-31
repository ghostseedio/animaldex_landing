"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {SpeakerOffIcon, SpeakerOnIcon} from "@/app/[locale]/_components/icons";

type SubtitleSpeakerProps = {
    text: string;
    locale: string;
    cacheKey: string;
    refreshUrl?: string;
};

type SubtitleSegment = {
    value: string;
    start: number;
    end: number;
    isWord: boolean;
};

const AUDIO_PREFERENCE_KEY = "animaldex-subtitle-audio-enabled";
const FEMALE_VOICE_HINTS = [
    "samantha",
    "serena",
    "ava",
    "victoria",
    "allison",
    "susan",
    "karen",
    "moira",
    "zira",
    "female",
    "woman",
    "google uk english female",
    "google us english"
];

function buildSegments(text: string): SubtitleSegment[] {
    const matches = Array.from(text.matchAll(/\S+|\s+/g));

    return matches.map((match) => ({
        value: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        isWord: /\S/.test(match[0])
    }));
}

function getActiveSegmentIndex(segments: SubtitleSegment[], charIndex: number | null) {
    if (charIndex === null) {
        return -1;
    }

    return segments.findIndex((segment) => segment.isWord && charIndex >= segment.start && charIndex < segment.end);
}

function pickVoice(locale: string) {
    const normalizedLocale = locale.toLowerCase();
    const speechLocale = normalizedLocale.includes("-") ? normalizedLocale : `${normalizedLocale}-US`;
    const baseLocale = normalizedLocale.split("-")[0];
    const voices = window.speechSynthesis.getVoices();
    const localeMatches = voices.filter((voice) => {
        const voiceLocale = voice.lang.toLowerCase();

        return voiceLocale.startsWith(speechLocale)
            || voiceLocale.startsWith(normalizedLocale)
            || voiceLocale.startsWith(baseLocale);
    });
    const rankedMatches = localeMatches
        .map((voice) => {
            const name = voice.name.toLowerCase();
            const hintScore = FEMALE_VOICE_HINTS.findIndex((hint) => name.includes(hint));

            return {
                voice,
                score: hintScore === -1 ? 999 : hintScore
            };
        })
        .sort((a, b) => a.score - b.score);

    return rankedMatches[0]?.voice ?? localeMatches[0] ?? voices[0] ?? null;
}

function normalizeSpeechLocale(locale: string) {
    const normalizedLocale = locale.toLowerCase();

    return normalizedLocale.includes("-") ? normalizedLocale : `${normalizedLocale}-US`;
}

export default function SubtitleSpeaker({text, locale, cacheKey, refreshUrl}: SubtitleSpeakerProps) {
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const speakGenerationRef = useRef(0);
    const resumeIntervalRef = useRef<number | null>(null);
    const autoplayAttemptedKeyRef = useRef<string | null>(null);
    const [voiceRevision, setVoiceRevision] = useState(0);
    const [autoplayEnabled, setAutoplayEnabled] = useState(true);
    const [hasLoadedPreference, setHasLoadedPreference] = useState(false);
    const [activeCharIndex, setActiveCharIndex] = useState<number | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [displayText, setDisplayText] = useState(text);
    const segments = buildSegments(displayText);
    const activeSegmentIndex = getActiveSegmentIndex(segments, activeCharIndex);
    const speechLocale = normalizeSpeechLocale(locale);
    const narrationKey = `${cacheKey}:${displayText}`;

    const clearResumeInterval = useCallback(() => {
        if (resumeIntervalRef.current !== null) {
            window.clearInterval(resumeIntervalRef.current);
            resumeIntervalRef.current = null;
        }
    }, []);

    const stopSpeaking = useCallback(() => {
        speakGenerationRef.current += 1;
        clearResumeInterval();

        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        utteranceRef.current = null;
        setIsSpeaking(false);
        setActiveCharIndex(null);
    }, [clearResumeInterval]);

    const speakNow = useCallback((mode: "autoplay" | "manual") => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            return;
        }

        const trimmedText = displayText.trim();

        if (!trimmedText) {
            return;
        }

        if (mode === "autoplay" && !autoplayEnabled) {
            return;
        }

        const generation = speakGenerationRef.current + 1;
        speakGenerationRef.current = generation;
        clearResumeInterval();
        window.speechSynthesis.cancel();

        const startSpeaking = () => {
            if (generation !== speakGenerationRef.current) {
                return;
            }

            const voices = window.speechSynthesis.getVoices();

            if (voices.length === 0) {
                window.setTimeout(startSpeaking, 200);
                return;
            }

            const utterance = new SpeechSynthesisUtterance(trimmedText);
            utterance.lang = speechLocale;
            utterance.rate = 0.92;
            utterance.pitch = 1.08;

            const voice = pickVoice(locale);

            if (voice) {
                utterance.voice = voice;
            }

            utterance.onstart = () => {
                if (generation !== speakGenerationRef.current) {
                    return;
                }

                setIsSpeaking(true);
                setActiveCharIndex(0);
            };
            utterance.onboundary = (event) => {
                if (generation !== speakGenerationRef.current) {
                    return;
                }

                if (typeof event.charIndex === "number") {
                    setActiveCharIndex(event.charIndex);
                }
            };
            utterance.onend = () => {
                if (generation !== speakGenerationRef.current) {
                    return;
                }

                clearResumeInterval();
                utteranceRef.current = null;
                setIsSpeaking(false);
                setActiveCharIndex(null);
            };
            utterance.onerror = () => {
                if (generation !== speakGenerationRef.current) {
                    return;
                }

                clearResumeInterval();
                utteranceRef.current = null;
                setIsSpeaking(false);
                setActiveCharIndex(null);
            };

            utteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);

            resumeIntervalRef.current = window.setInterval(() => {
                if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
            }, 200);
        };

        window.setTimeout(startSpeaking, 60);
    }, [autoplayEnabled, clearResumeInterval, displayText, locale, speechLocale]);

    useEffect(() => {
        setDisplayText(text);
    }, [text]);

    useEffect(() => {
        if (!refreshUrl || typeof window === "undefined") {
            return;
        }

        const controller = new AbortController();

        fetch(refreshUrl, {
            cache: "no-store",
            signal: controller.signal
        })
            .then(async (response) => {
                if (!response.ok) {
                    return null;
                }

                return response.json() as Promise<{heroSubtitle?: string | null}>;
            })
            .then((payload) => {
                const nextText = payload?.heroSubtitle?.trim();

                if (nextText && nextText !== text) {
                    setDisplayText(nextText);
                }
            })
            .catch(() => {
                // Keep the server-rendered subtitle when the refresh request fails.
            });

        return () => {
            controller.abort();
        };
    }, [refreshUrl, text]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const savedPreference = window.localStorage.getItem(AUDIO_PREFERENCE_KEY);

        if (savedPreference === "false") {
            setAutoplayEnabled(false);
        }

        setHasLoadedPreference(true);
    }, []);

    useEffect(() => {
        autoplayAttemptedKeyRef.current = null;
    }, [narrationKey]);

    useEffect(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            return;
        }

        const handleVoicesChanged = () => {
            setVoiceRevision((value) => value + 1);
        };

        window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

        return () => {
            window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        };
    }, []);

    useEffect(() => {
        if (!hasLoadedPreference || !autoplayEnabled || !displayText.trim()) {
            return;
        }

        if (autoplayAttemptedKeyRef.current === narrationKey) {
            return;
        }

        autoplayAttemptedKeyRef.current = narrationKey;
        speakNow("autoplay");
    }, [autoplayEnabled, displayText, hasLoadedPreference, narrationKey, speakNow, voiceRevision]);

    useEffect(() => {
        return () => {
            stopSpeaking();
        };
    }, [stopSpeaking]);

    function handleSpeakerClick() {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            return;
        }

        if (isSpeaking) {
            stopSpeaking();
            return;
        }

        if (!autoplayEnabled) {
            setAutoplayEnabled(true);
            window.localStorage.setItem(AUDIO_PREFERENCE_KEY, "true");
        }

        speakNow("manual");
    }

    function handleDisableAutoplay() {
        setAutoplayEnabled(false);
        window.localStorage.setItem(AUDIO_PREFERENCE_KEY, "false");
        stopSpeaking();
    }

    const statusLabel = !autoplayEnabled
        ? "Voice off"
        : isSpeaking
            ? "Narrating"
            : "Tap to listen";

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleSpeakerClick}
                    onDoubleClick={handleDisableAutoplay}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-300 bg-surface-900/90 text-primary-100 transition-colors hover:border-primary-200 hover:text-primary-50"
                    aria-label={isSpeaking ? "Stop subtitle narration" : "Play subtitle narration"}
                    title={isSpeaking ? "Stop narration (double-click to turn off autoplay)" : "Listen to subtitle (double-click to turn off autoplay)"}
                >
                    {autoplayEnabled ? <SpeakerOnIcon size={20}/> : <SpeakerOffIcon size={20}/>}
                </button>
                <span className="text-xs uppercase tracking-[0.24em] text-ink-300">
                    {statusLabel}
                </span>
            </div>

            <p className="text-lg md:text-xl xl:text-2xl leading-8 text-ink-200">
                {segments.map((segment, index) => {
                    if (!segment.isWord) {
                        return <span key={`${segment.start}-${index}`}>{segment.value}</span>;
                    }

                    const isActive = index === activeSegmentIndex;

                    return (
                        <span
                            key={`${segment.start}-${index}`}
                            className={isActive ? "rounded-md bg-primary-100 px-1 text-canvas-950 shadow-[0_0_28px_rgba(167,244,50,0.28)]" : undefined}
                        >
                            {segment.value}
                        </span>
                    );
                })}
            </p>
        </div>
    );
}
