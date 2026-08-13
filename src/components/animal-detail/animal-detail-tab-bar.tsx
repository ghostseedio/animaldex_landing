"use client";

export type AnimalDetailTab = "learn" | "stats" | "compare";

export type AnimalDetailLayout = "compact" | "wide";

const TABS: Array<{id: AnimalDetailTab; label: string}> = [
    {id: "learn", label: "Learn"},
    {id: "stats", label: "Stats"},
    {id: "compare", label: "Compare"}
];

function TabIcon({tab, className}: {tab: AnimalDetailTab; className: string}) {
    if (tab === "learn") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 3.5h8l4 4V21H6z" strokeLinejoin="round" />
                <path d="M14 3.5v4h4M9 12h6M9 16h6" strokeLinecap="round" />
            </svg>
        );
    }
    if (tab === "stats") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 19h18M5 16l4-5 3 3 6-8 2 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 19 19 5M11 5h8v8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function AnimalDetailTabBar({
    value,
    onChange,
    labels,
    layout = "compact"
}: {
    value: AnimalDetailTab;
    onChange: (value: AnimalDetailTab) => void;
    labels?: Partial<Record<AnimalDetailTab, string>>;
    layout?: AnimalDetailLayout;
}) {
    const wide = layout === "wide";

    return (
        <div
            role="tablist"
            aria-label="Animal details"
            className={`grid grid-cols-3 gap-1 rounded-[18px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.045),transparent_55%),rgba(31,31,31,0.94)] p-1 ${
                wide ? "lg:w-fit lg:gap-1.5 lg:rounded-[22px] lg:p-1.5" : ""
            }`}
        >
            {TABS.map((tab) => {
                const active = value === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(tab.id)}
                        className={`flex min-w-0 items-center justify-center gap-[7px] rounded-[14px] border px-2 py-[11px] text-xs font-semibold leading-[15px] transition-[background-color,border-color,color] duration-300 ${
                            wide ? "lg:gap-2.5 lg:rounded-[18px] lg:px-8 lg:py-3 lg:text-sm lg:leading-5" : ""
                        } ${
                            active
                                ? "border-[#38fa47]/[0.28] bg-[linear-gradient(135deg,rgba(56,250,71,0.17),rgba(255,255,255,0.055))] text-white"
                                : "border-transparent text-white/[0.42] hover:text-white/[0.62]"
                        }`}
                    >
                        <TabIcon tab={tab.id} className={`h-3 w-3 ${wide ? "lg:h-4 lg:w-4" : ""}`} />
                        <span className="truncate">{labels?.[tab.id] ?? tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
