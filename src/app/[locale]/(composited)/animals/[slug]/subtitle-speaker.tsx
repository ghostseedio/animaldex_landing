"use client";

import {useEffect, useRef, useState} from "react";
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

declare global {
    interface Window {
        __animalDexLastSpokenKey?: string;
    }
}

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
    const baseLocale = normalizedLocale.split("-")[0];
    const voices = window.speechSynthesis.getVoices();
    const localeMatches = voices.filter((voice) => {
        const voiceLocale = voice.lang.toLowerCase();

        return voiceLocale.startsWith(normalizedLocale) || voiceLocale.startsWith(baseLocale);
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

export default function SubtitleSpeaker({text, locale, cacheKey, refreshUrl}: SubtitleSpeakerProps) {
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [voiceRevision, setVoiceRevision] = useState(0);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [hasLoadedPreference, setHasLoadedPreference] = useState(false);
    const [activeCharIndex, setActiveCharIndex] = useState<number | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [displayText, setDisplayText] = useState(text);
    const segments = buildSegments(displayText);
    const activeSegmentIndex = getActiveSegmentIndex(segments, activeCharIndex);
    const effectiveCacheKey = `${cacheKey}:${displayText}`;

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
            setIsAudioEnabled(false);
        }

        setHasLoadedPreference(true);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            return;
        }

        const handleVoicesChanged = () => {
            setVoiceRevision((value) => value + 1);
        };

        window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

        return () => {
            window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            return;
        }

        if (!hasLoadedPreference) {
            return;
        }

        if (!isAudioEnabled) {
            window.speechSynthesis.cancel();
            utteranceRef.current = null;
            setIsSpeaking(false);
            setActiveCharIndex(null);
            return;
        }

        if (window.__animalDexLastSpokenKey === effectiveCacheKey || !displayText.trim()) {
            return;
        }

        if (window.speechSynthesis.getVoices().length === 0) {
            const retryTimer = window.setTimeout(() => {
                setVoiceRevision((value) => value + 1);
            }, 250);

            return () => {
                window.clearTimeout(retryTimer);
            };
        }

        window.__animalDexLastSpokenKey = effectiveCacheKey;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(displayText);
        utterance.lang = locale;
        utterance.rate = 0.92;
        utterance.pitch = 1.08;

        const voice = pickVoice(locale);

        if (voice) {
            utterance.voice = voice;
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            setActiveCharIndex(0);
        };
        utterance.onboundary = (event) => {
            if (typeof event.charIndex === "number") {
                setActiveCharIndex(event.charIndex);
            }
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            setActiveCharIndex(null);
            utteranceRef.current = null;
        };
        utterance.onerror = () => {
            setIsSpeaking(false);
            setActiveCharIndex(null);
            utteranceRef.current = null;
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);

        return () => {
            if (utteranceRef.current === utterance) {
                window.speechSynthesis.cancel();
                utteranceRef.current = null;
            }
        };
    }, [displayText, effectiveCacheKey, hasLoadedPreference, isAudioEnabled, locale, voiceRevision]);

    function handleToggleAudio() {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            return;
        }

        const nextValue = !isAudioEnabled;

        setIsAudioEnabled(nextValue);
        window.localStorage.setItem(AUDIO_PREFERENCE_KEY, String(nextValue));

        if (!nextValue) {
            window.speechSynthesis.cancel();
            window.__animalDexLastSpokenKey = effectiveCacheKey;
            setIsSpeaking(false);
            setActiveCharIndex(null);
            return;
        }

        window.__animalDexLastSpokenKey = "";
        setActiveCharIndex(null);
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleToggleAudio}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-300 bg-surface-900/90 text-primary-100 transition-colors hover:border-primary-200 hover:text-primary-50"
                    aria-label={isAudioEnabled ? "Mute subtitle narration" : "Play subtitle narration"}
                    title={isAudioEnabled ? "Mute subtitle narration" : "Play subtitle narration"}
                >
                    {isAudioEnabled ? <SpeakerOnIcon size={20}/> : <SpeakerOffIcon size={20}/>}
                </button>
                <span className="text-xs uppercase tracking-[0.24em] text-ink-300">
                    {isAudioEnabled ? (isSpeaking ? "Narrating" : "Voice ready") : "Voice off"}
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
                            className={isActive ? "rounded-md bg-primary-100 px-1 text-canvas-950 shadow-[0_0_28px_rgba(131,255,174,0.28)]" : undefined}
                        >
                            {segment.value}
                        </span>
                    );
                })}
            </p>
        </div>
    );
}
