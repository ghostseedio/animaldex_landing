"use client";

export type AnimalDetailTab = "learn" | "stats" | "play";

export type AnimalDetailLayout = "compact" | "wide";

const TABS: Array<{id: AnimalDetailTab; label: string}> = [
    {id: "learn", label: "Learn"},
    {id: "stats", label: "Stats"},
    {id: "play", label: "Play"}
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
            <path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 3.6l.7 3.6A2.7 2.7 0 0 1 18.9 18c-.9 0-1.7-.5-2.2-1.2L16 16H8l-.7.8C6.8 17.5 6 18 5.1 18a2.7 2.7 0 0 1-2.7-2.8l.7-3.6A4.5 4.5 0 0 1 7.5 8Z" strokeLinejoin="round" />
            <path d="M7 11.5v2M6 12.5h2M15.5 11.5h.01M17.5 13.5h.01" strokeLinecap="round" />
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
            className={`grid grid-cols-3 gap-px border border-line-300 bg-line-300 ${
                wide ? "lg:w-fit" : ""
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
                        className={`flex min-w-0 items-center justify-center gap-[7px] border-b-2 px-2 py-3 text-xs font-semibold leading-[15px] transition-colors duration-200 ${
                            wide ? "lg:gap-2.5 lg:px-8 lg:py-3.5 lg:text-sm lg:leading-5" : ""
                        } ${
                            active
                                ? "border-primary-400 bg-surface-900 text-white"
                                : "border-transparent bg-black text-white/[0.42] hover:bg-surface-900/60 hover:text-white/[0.7]"
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
