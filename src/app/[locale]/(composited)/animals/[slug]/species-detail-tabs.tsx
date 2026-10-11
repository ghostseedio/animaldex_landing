"use client";

import {type ReactNode, useState} from "react";
import AnimalDetailTabBar, {type AnimalDetailTab} from "@/components/animal-detail/animal-detail-tab-bar";

export type SpeciesDetailTab = AnimalDetailTab;

type SpeciesDetailTabsProps = {
    labels: {
        story: string;
        progress: string;
        play: string;
    };
    eyebrow?: string;
    title?: string;
    defaultTab?: SpeciesDetailTab;
    learn: ReactNode;
    stats: ReactNode;
    play: ReactNode;
};

export default function SpeciesDetailTabs({
    labels,
    eyebrow,
    title,
    defaultTab = "learn",
    learn,
    stats,
    play
}: SpeciesDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<SpeciesDetailTab>(defaultTab);
    const panels: Record<SpeciesDetailTab, ReactNode> = {learn, stats, play};

    return (
        // The same panel as the Animal Power guide above it: full green-tinted
        // border, the lime glow over a deep green, and the same eyebrow and
        // heading. Side padding stays 20px below lg so the Learn cards' -mx-5
        // still meets the edge exactly.
        <div className="flex w-full flex-col gap-5 border border-primary-400/20 bg-[radial-gradient(circle_at_80%_0%,rgba(167,244,50,0.14),transparent_32%),linear-gradient(180deg,rgba(16,22,14,0.96),rgba(8,11,8,0.98))] px-5 py-6 font-sans light:border-line-200 light:bg-none light:bg-surface-900 md:py-8 lg:gap-8 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
                {eyebrow || title ? (
                    <div className="flex min-w-0 flex-col">
                        {eyebrow ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{eyebrow}</p>
                        ) : null}
                        {title ? (
                            <h2 className="mt-2 break-words font-display text-4xl font-bold tracking-tight text-white md:text-5xl">{title}</h2>
                        ) : null}
                    </div>
                ) : null}
                <AnimalDetailTabBar
                    value={activeTab}
                    onChange={setActiveTab}
                    layout="wide"
                    labels={{learn: labels.story, stats: labels.progress, play: labels.play}}
                />
            </div>

            {(Object.keys(panels) as SpeciesDetailTab[]).map((tab) => (
                <div
                    key={tab}
                    role="tabpanel"
                    hidden={activeTab !== tab}
                    className={activeTab === tab ? "min-w-0" : "hidden"}
                >
                    {panels[tab]}
                </div>
            ))}
        </div>
    );
}
