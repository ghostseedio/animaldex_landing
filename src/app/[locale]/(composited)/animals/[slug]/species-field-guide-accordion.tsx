"use client";

import {useState} from "react";
import type {ReactNode} from "react";

export type FieldGuideAccordionSection = {
    id: string;
    title: string;
    content: ReactNode;
};

type SpeciesFieldGuideAccordionProps = {
    headerTitle: string;
    headerDescription: string;
    sections: FieldGuideAccordionSection[];
    defaultOpenId?: string;
};

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

                    return (
                        <div
                            key={section.id}
                            className={`border-t border-white/[0.08] transition-colors ${isOpen ? "bg-white/[0.02]" : ""}`}
                        >
                            <button
                                id={buttonId}
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setOpenId(isOpen ? "" : section.id)}
                                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-8 md:py-6"
                            >
                                <span className="font-display text-xl font-bold text-white md:text-2xl">
                                    {section.title}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all ${
                                        isOpen
                                            ? "rotate-180 border-amber-300/40 bg-amber-200/10 text-amber-100"
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
