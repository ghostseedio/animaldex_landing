"use client";

import {type ReactNode, useState} from "react";

export type SpeciesDetailTab = "story" | "progress" | "growth";

type SpeciesDetailTabsProps = {
    labels: {
        story: string;
        progress: string;
        growth: string;
    };
    defaultTab?: SpeciesDetailTab;
    story: ReactNode;
    progress: ReactNode;
    growth: ReactNode;
};

const tabs: Array<{id: SpeciesDetailTab; icon: string}> = [
    {id: "story", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"},
    {id: "progress", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"},
    {id: "growth", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"}
];

function TabIcon({path}: {path: string}) {
    return (
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d={path} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function SpeciesDetailTabs({
    labels,
    defaultTab = "story",
    story,
    progress,
    growth
}: SpeciesDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<SpeciesDetailTab>(defaultTab);

    const labelMap: Record<SpeciesDetailTab, string> = {
        story: labels.story,
        progress: labels.progress,
        growth: labels.growth
    };

    const panelMap: Record<SpeciesDetailTab, ReactNode> = {
        story,
        progress,
        growth
    };

    return (
        <div className="flex flex-col gap-10 md:gap-14">
            <nav
                aria-label="Animal profile sections"
                className="sticky top-20 z-20 -mx-4 border-y border-white/[0.08] bg-canvas-950/90 px-4 py-4 backdrop-blur-xl md:top-24 md:mx-0 md:rounded-2xl md:border md:px-3 md:py-3"
            >
                <div className="grid grid-cols-3 gap-1 rounded-[18px] border border-white/10 bg-[#1f1f1f]/95 p-1 md:gap-1.5 md:p-1.5">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                aria-selected={isActive}
                                role="tab"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition-colors md:min-h-[3.25rem] md:px-3 ${
                                    isActive
                                        ? "border border-[#38fa47]/30 bg-[linear-gradient(135deg,rgba(56,250,71,0.17),rgba(255,255,255,0.055))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                        : "border border-transparent text-white/40 hover:text-white/60"
                                }`}
                            >
                                <TabIcon path={tab.icon} />
                                <span className="truncate">{labelMap[tab.id]}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            <div role="tabpanel">
                {panelMap[activeTab]}
            </div>
        </div>
    );
}
