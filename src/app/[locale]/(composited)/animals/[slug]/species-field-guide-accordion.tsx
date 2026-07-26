"use client";

import {useState} from "react";
import type {ReactNode} from "react";

export type FieldGuideAccordionIcon =
    | "introduction"
    | "environment"
    | "diet"
    | "predators"
    | "lifeCycle"
    | "reproduction"
    | "behavior"
    | "meaning"
    | "spotting"
    | "lookalikes";

export type FieldGuideAccordionSection = {
    id: string;
    title: string;
    content: ReactNode;
    icon?: FieldGuideAccordionIcon;
    tintClass?: string;
};

type SpeciesFieldGuideAccordionProps = {
    headerTitle: string;
    headerDescription: string;
    sections: FieldGuideAccordionSection[];
    defaultOpenId?: string;
};

const ICON_PATHS: Record<FieldGuideAccordionIcon, string> = {
    introduction: "M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 8v4m0 0v2m0-2h2m-2 0H9",
    environment: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    diet: "M3 3v8a4 4 0 004 4h1v6m8-18v6a4 4 0 01-4 4h-1m5-10h4v18",
    predators: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7zM12 2v2m0 16v2m9-10h-2M5 12H3",
    lifeCycle: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646zM16 5l1.5-1.5M18.5 8L20 6.5",
    reproduction: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    behavior: "M13 10V3L4 14h7v7l9-11h-7z",
    meaning: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    spotting: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    lookalikes: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
};

const DEFAULT_TINT = "text-primary-200 bg-primary-400/15 border-primary-300/25";

function FieldGuideIcon({icon, tintClass}: {icon: FieldGuideAccordionIcon; tintClass: string}) {
    return (
        <span
            aria-hidden="true"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border ${tintClass}`}
        >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d={ICON_PATHS[icon]} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
}

export default function SpeciesFieldGuideAccordion({
    headerTitle,
    headerDescription,
    sections,
    defaultOpenId
}: SpeciesFieldGuideAccordionProps) {
    const [openId, setOpenId] = useState(defaultOpenId ?? sections[0]?.id ?? "");

    if (sections.length === 0) {
        return null;
    }

    return (
        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-surface-900/55">
            <div className="border-b border-white/[0.08] px-5 py-6 md:px-8 md:py-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                    {headerTitle}
                </p>
                <p className="mt-2 max-w-3xl text-base leading-7 text-ink-200 md:text-lg">
                    {headerDescription}
                </p>
            </div>

            <div>
                {sections.map((section) => {
                    const isOpen = openId === section.id;
                    const panelId = `field-guide-panel-${section.id}`;
                    const buttonId = `field-guide-button-${section.id}`;
                    const tintClass = section.tintClass ?? DEFAULT_TINT;

                    return (
                        <div
                            key={section.id}
                            className={`border-t border-white/[0.08] transition-colors ${isOpen ? "bg-white/[0.025]" : ""}`}
                        >
                            <button
                                id={buttonId}
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setOpenId(isOpen ? "" : section.id)}
                                className="flex w-full items-center gap-3 px-5 py-5 text-left md:gap-4 md:px-8 md:py-6"
                            >
                                {section.icon ? <FieldGuideIcon icon={section.icon} tintClass={tintClass} /> : null}
                                <span className="min-w-0 flex-1 font-display text-xl font-bold text-white md:text-2xl">
                                    {section.title}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all ${
                                        isOpen
                                            ? `rotate-180 ${tintClass}`
                                            : "border-white/10 bg-black/20 text-ink-300"
                                    }`}
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            </button>

                            <div
                                id={panelId}
                                role="region"
                                aria-labelledby={buttonId}
                                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="border-t border-white/[0.06] px-5 pb-6 pt-4 md:px-8 md:pb-8 md:pt-5">
                                        {section.content}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
