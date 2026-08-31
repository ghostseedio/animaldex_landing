"use client";

import {type ReactNode, useState} from "react";
import AnimalDetailTabBar, {type AnimalDetailTab} from "@/components/animal-detail/animal-detail-tab-bar";

export type SpeciesDetailTab = AnimalDetailTab;

type SpeciesDetailTabsProps = {
    labels: {
        story: string;
        progress: string;
        growth: string;
    };
    eyebrow?: string;
    title?: string;
    defaultTab?: SpeciesDetailTab;
    learn: ReactNode;
    stats: ReactNode;
    compare: ReactNode;
};

export default function SpeciesDetailTabs({
    labels,
    eyebrow,
    title,
    defaultTab = "learn",
    learn,
    stats,
    compare
}: SpeciesDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<SpeciesDetailTab>(defaultTab);
    const panels: Record<SpeciesDetailTab, ReactNode> = {learn, stats, compare};

    return (
        <div className="flex w-full flex-col gap-5 bg-black px-5 py-5 font-sans sm:rounded-[24px] sm:border sm:border-white/[0.08] lg:gap-8 lg:rounded-[32px] lg:px-10 lg:py-9">
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
                    labels={{learn: labels.story, stats: labels.progress, compare: labels.growth}}
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
