"use client";

import {useEffect, useMemo, useState} from "react";

export type AnimalStoryPrinciple = {
    name: string;
    motto?: string | null;
    expression?: string | null;
    coreLesson?: string | null;
    biologicalBasis?: string | null;
    applicationExample?: string | null;
    bestUseCases?: string[];
};

type AnimalStoryCardProps = {
    contentKey: string;
    story?: string | null;
    principle?: AnimalStoryPrinciple | null;
    settingTag?: string | null;
    layout?: "compact" | "wide";
};

const SETTING_TINT: Record<string, string> = {
    wild: "56,250,71",
    zoo: "250,219,71",
    domestic: "140,199,255",
    farm: "209,166,89",
    unknown: "158,158,173"
};

function clean(value: string | null | undefined) {
    return value?.trim() || null;
}

function sentences(value: string) {
    return (value.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [value])
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}

function collapsedStory(value: string) {
    const parts = sentences(value);
    return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : value.trim();
}

function Icon({name, className = "h-3 w-3"}: {name: "book" | "play" | "stop" | "chevron" | "bolt" | "lesson" | "leaf" | "try" | "grid"; className?: string}) {
    const common = {className, viewBox: "0 0 24 24", "aria-hidden": true} as const;
    switch (name) {
        case "book":
            return <svg {...common} fill="currentColor"><path d="M4.5 3.5A2.5 2.5 0 0 1 7 1h4v18H7a2.5 2.5 0 0 0-2.5 2.5V3.5ZM13 1h4a2.5 2.5 0 0 1 2.5 2.5v18A2.5 2.5 0 0 0 17 19h-4V1Z" /></svg>;
        case "play":
            return <svg {...common} fill="currentColor"><path d="M7.5 4.8v14.4a1 1 0 0 0 1.55.83l10.2-7.2a1 1 0 0 0 0-1.66L9.05 3.97A1 1 0 0 0 7.5 4.8Z" /></svg>;
        case "stop":
            return <svg {...common} fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>;
        case "chevron":
            return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m7 9 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
        case "bolt":
            return <svg {...common} fill="currentColor"><path d="M13.2 1.7 5.5 13h5.3l-1 9.3L18.5 10h-5.7l.4-8.3Z" /></svg>;
        case "lesson":
            return <svg {...common} fill="currentColor"><path d="M9 20h6v2H9v-2Zm3-19a7 7 0 0 0-4.2 12.6c.8.6 1.2 1.3 1.2 2.1V18h6v-2.3c0-.8.4-1.5 1.2-2.1A7 7 0 0 0 12 1Z" /></svg>;
        case "leaf":
            return <svg {...common} fill="currentColor"><path d="M20.8 2.3C12.9 2.5 6.4 5.4 4 10.2c-1.5 3-.9 6.2 1.5 8.1 2.1-4.9 5.5-8.2 10.2-10.5-3.9 2.8-6.8 6.5-8.4 11.1 3.2 1.1 6.5-.2 8.4-3.1 2.8-4.3 3.5-9.4 5.1-13.5Z" /></svg>;
        case "try":
            return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M9 15 15 9m-4 0h4v4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
        case "grid":
            return <svg {...common} fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>;
    }
}

function PanelLabel({icon, children, cyan = false}: {icon: "lesson" | "leaf" | "grid"; children: React.ReactNode; cyan?: boolean}) {
    return (
        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${cyan ? "text-cyan-300/90" : "text-[#38fa47]"}`}>
            <Icon name={icon} className="h-[11px] w-[11px]" />
            <span>{children}</span>
        </div>
    );
}

export default function AnimalStoryCard({contentKey, story, principle, settingTag, layout = "compact"}: AnimalStoryCardProps) {
    const wide = layout === "wide";
    const [expanded, setExpanded] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const cleanStory = clean(story);
    const principleName = clean(principle?.name);
    const coreLesson = clean(principle?.coreLesson);
    const powerLine = clean(principle?.motto) ?? clean(principle?.expression);
    const biologicalBasis = clean(principle?.biologicalBasis);
    const applicationExample = clean(principle?.applicationExample);
    const bestUseCases = (principle?.bestUseCases ?? []).map((item) => item.trim()).filter(Boolean);
    const tint = SETTING_TINT[settingTag?.trim().toLowerCase() ?? "unknown"] ?? SETTING_TINT.unknown;
    const isUnknown = !settingTag || settingTag.trim().toLowerCase() === "unknown";

    const speechText = useMemo(() => [
        cleanStory,
        principleName ? `Animal Power. ${principleName}.` : null,
        clean(principle?.expression),
        clean(principle?.motto),
        coreLesson ? `What it teaches. ${coreLesson}` : null,
        biologicalBasis ? `Nature proof. ${biologicalBasis}` : null,
        applicationExample ? `Try it. ${applicationExample}` : null,
        bestUseCases.length ? `Use it for. ${bestUseCases.join(". ")}` : null
    ].filter(Boolean).join(" "), [applicationExample, bestUseCases, biologicalBasis, cleanStory, coreLesson, principle?.expression, principle?.motto, principleName]);

    useEffect(() => {
        setExpanded(false);
        setSpeaking(false);
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    }, [contentKey]);

    useEffect(() => () => {
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    }, []);

    if (!cleanStory && !principleName) return null;

    const toggleSpeech = () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window) || !speechText) return;
        if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            return;
        }
        setExpanded(true);
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setSpeaking(true);
    };

    const bodyClass = `text-[15px] font-medium leading-6 text-white ${wide ? "lg:text-base lg:leading-7" : ""}`;

    const power = principleName ? (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#38fa47]">
                <Icon name="bolt" className="h-2.5 w-2.5" />
                <span>Animal Power</span>
            </div>
            <p className={`text-[17px] font-bold leading-[1.3] text-white ${wide ? "lg:text-2xl" : ""}`}>{principleName}</p>
            {powerLine ? <p className={`text-[15px] font-bold leading-6 text-[#38fa47] ${wide ? "lg:text-lg lg:leading-7" : ""}`}>{powerLine}</p> : null}
        </div>
    ) : null;

    const lesson = coreLesson ? (
        <div className="relative space-y-[5px] pl-[11px] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:rounded-full before:bg-[#38fa47]/70">
            <PanelLabel icon="lesson">What it teaches</PanelLabel>
            <p className={bodyClass}>{coreLesson}</p>
        </div>
    ) : null;

    return (
        <section
            className={`border-b px-5 py-4 font-sans ${wide ? "lg:rounded-[22px] lg:border lg:px-7 lg:py-6" : ""}`}
            style={{
                background: `linear-gradient(135deg, rgba(${tint},${isUnknown ? 0.08 : 0.18}), rgba(${tint},${isUnknown ? 0.04 : 0.10}), #1f1f1f)`,
                borderColor: isUnknown ? "rgba(255,255,255,.10)" : `rgba(${tint},.16)`
            }}
        >
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Icon name="book" className="h-3 w-3 text-[#38fa47]" />
                    <span>Story</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    {speechText ? (
                        <button
                            type="button"
                            onClick={toggleSpeech}
                            className="flex items-center gap-1.5 rounded-full border border-[#38fa47]/25 bg-[#121212] px-2.5 py-2 text-[11px] font-semibold text-[#38fa47]"
                        >
                            <Icon name={speaking ? "stop" : "play"} className="h-[11px] w-[11px]" />
                            {speaking ? "Stop" : "Play"}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        aria-label={expanded ? "Collapse story" : "Expand story"}
                        aria-expanded={expanded}
                        className="grid h-[30px] w-[30px] place-items-center rounded-full border border-white/[0.14] bg-[#121212] text-white/[0.62]"
                    >
                        <Icon name="chevron" className={`h-2.5 w-2.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
                    </button>
                </div>
            </div>

            {!expanded ? (
                <div className="mt-3 space-y-3">
                    {power}
                    {lesson ?? (cleanStory ? <p className={bodyClass}>{collapsedStory(cleanStory)}</p> : null)}
                </div>
            ) : (
                <div className="mt-3 space-y-3">
                    {cleanStory ? <p className={bodyClass}>{cleanStory}</p> : null}
                    {cleanStory && power ? <div className="h-px bg-white/[0.14]" /> : null}
                    {power}
                    {lesson}
                    {biologicalBasis ? (
                        <>
                            <div className="h-px bg-white/[0.14]" />
                            <div className="space-y-2.5">
                                <PanelLabel icon="leaf" cyan>Nature proof</PanelLabel>
                                <div className="space-y-2">
                                    {sentences(biologicalBasis).map((sentence, index) => (
                                        <div key={`${sentence}-${index}`} className="flex items-start gap-[9px]">
                                            <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-cyan-300/85" />
                                            <p className={`${bodyClass} text-white/[0.62]`}>{sentence}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : null}
                    {applicationExample ? (
                        <>
                            <div className="h-px bg-white/[0.14]" />
                            <div className="flex items-start gap-2.5 rounded-[14px] border border-[#38fa47]/[0.14] bg-white/[0.035] p-3">
                                <Icon name="try" className="mt-0.5 h-4 w-4 shrink-0 text-[#38fa47]" />
                                <div className="space-y-1.5">
                                    <p className="text-[11px] font-bold text-[#38fa47]">Try it</p>
                                    <p className={bodyClass}>{applicationExample}</p>
                                </div>
                            </div>
                        </>
                    ) : null}
                    {bestUseCases.length ? (
                        <>
                            <div className="h-px bg-white/[0.14]" />
                            <div className="space-y-2.5">
                                <PanelLabel icon="grid">Use it for</PanelLabel>
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-[9px]">
                                    {bestUseCases.map((useCase) => (
                                        <div key={useCase} className="flex items-start gap-2 rounded-xl border border-[#38fa47]/[0.16] bg-black/[0.16] px-2.5 py-2 text-[11px] font-semibold leading-4 text-white">
                                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#38fa47]" />
                                            <span>{useCase}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </section>
    );
}
