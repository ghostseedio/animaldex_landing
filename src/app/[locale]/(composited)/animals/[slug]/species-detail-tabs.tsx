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
        <div className="flex w-full flex-col gap-5 border-y border-line-300 bg-black px-5 py-6 font-sans sm:px-6 lg:gap-8 lg:px-10 lg:py-9">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                {eyebrow || title ? (
                    <div className="hidden min-w-0 flex-col gap-1 lg:flex">
                        {eyebrow ? (
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A7F432]">{eyebrow}</p>
                        ) : null}
                        {title ? (
                            <h2 className="truncate font-display text-2xl font-bold text-white xl:text-3xl">{title}</h2>
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
