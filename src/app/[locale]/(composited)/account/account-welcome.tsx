"use client";

import {type ReactNode, useEffect, useState} from "react";
import WelcomeIntroStage from "@/components/welcome/welcome-intro-stage";
import WelcomeLanguageSwitcher from "@/components/welcome/welcome-language-switcher";
import {WELCOME_INTRO_MUTED_KEY, welcomeText} from "@/lib/welcome-intro";
import type {WelcomeIntroLanguagePayload} from "@/loaders/welcome-intro";

/**
 * The sign-in page's welcome band, ported from iOS `WelcomeView`: the hero
 * photo blurred and drifting under a dark wash, a quiet green glow behind the
 * card, the looping welcome card, the headline, and the sign-in panel.
 *
 * Pinned dark in both themes, as the app's sign-in screen is.
 *
 * Sound starts OFF on the web (iOS starts on): a browser blocks audio until
 * the visitor interacts, so the button is that interaction. A saved choice is
 * remembered under the same key name as the app's setting.
 *
 * The language control left of the sound button sets the site's locale; the
 * intro reads and speaks in `intro.language` (selected on the server).
 */
export default function AccountWelcome({
    headline,
    soundOnLabel,
    soundOffLabel,
    locale,
    intro,
    children
}: {
    headline: string;
    /** The site's locale. */
    locale: string;
    /** The intro's language, its strings and where its voice comes from. */
    intro: WelcomeIntroLanguagePayload;
    soundOnLabel: string;
    soundOffLabel: string;
    /** The sign-in panel. */
    children: ReactNode;
}) {
    const [muted, setMuted] = useState(true);
    const [soundGeneration, setSoundGeneration] = useState(0);
    const [cardHeight, setCardHeight] = useState(300);

    useEffect(() => {
        try {
            if (window.localStorage.getItem(WELCOME_INTRO_MUTED_KEY) === "false") setMuted(false);
        } catch {
            // Storage unavailable: stay muted.
        }
    }, []);

    useEffect(() => {
        // iOS: 38% of the screen's height, kept between 220 and 340 points.
        const update = () => setCardHeight(Math.round(Math.min(340, Math.max(240, window.innerHeight * 0.38))));
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    const toggleSound = () => {
        const next = !muted;
        setMuted(next);
        // Turning sound on restarts the card on screen, so its voice lines up with it.
        if (!next) setSoundGeneration((value) => value + 1);
        try {
            window.localStorage.setItem(WELCOME_INTRO_MUTED_KEY, String(next));
        } catch {
            // Not remembered; the toggle still works for this visit.
        }
    };

    return (
        <section className="theme-dark relative isolate -mt-8 overflow-hidden border-b border-line-300 bg-[#050806]">
            <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/images/welcome/hero.webp"
                    alt=""
                    className="welcome-hero-drift absolute inset-0 h-full w-full scale-110 object-cover blur-[16px]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-black/[0.97]" />
                {/* A quiet green glow behind the card; the rest stays dark. */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(50,219,101,0.22),transparent_55%)] lg:bg-[radial-gradient(circle_at_32%_42%,rgba(50,219,101,0.22),transparent_45%)]" />
            </div>

            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                <WelcomeLanguageSwitcher
                    currentLocale={locale}
                    displayLanguage={intro.language}
                    languages={intro.languages}
                    label={welcomeText(intro.strings, "Language")}
                />
                <button
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={!muted}
                    aria-label={muted ? soundOnLabel : soundOffLabel}
                    title={muted ? soundOnLabel : soundOffLabel}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.14] bg-black/35 text-white/85 transition-colors hover:border-primary-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
                >
                    <SpeakerIcon muted={muted} />
                </button>
            </div>

            <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-14 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-16 lg:py-20">
                <div className="flex flex-col items-center">
                    <WelcomeIntroStage
                        // A new language starts the loop again at card 1.
                        key={intro.language}
                        muted={muted}
                        soundGeneration={soundGeneration}
                        cardHeight={cardHeight}
                        language={intro.language}
                        strings={intro.strings}
                        voice={intro.voice}
                    />
                    <h1 className="mt-7 whitespace-pre-line text-center font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl">
                        {headline}
                    </h1>
                </div>
                {children}
            </div>
        </section>
    );
}

function SpeakerIcon({muted}: {muted: boolean}) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
            <path d="M4 9.5h3.2L12 5.4v13.2l-4.8-4.1H4z" />
            {muted ? (
                <path d="M16 9.4l1.2-1.2 2 2 2-2 1.2 1.2-2 2 2 2-1.2 1.2-2-2-2 2-1.2-1.2 2-2z" />
            ) : (
                <path d="M15.5 8.2a5 5 0 010 7.6l-1.1-1.2a3.4 3.4 0 000-5.2zm2.4-2.6a8.5 8.5 0 010 12.8l-1.1-1.2a6.9 6.9 0 000-10.4z" />
            )}
        </svg>
    );
}
