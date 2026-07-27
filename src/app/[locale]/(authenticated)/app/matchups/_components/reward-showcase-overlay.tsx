"use client";

export type RewardShowcaseItem = {
    id: string;
    title: string;
    totalValueText: string;
    subtitle: string;
    accent: "points" | "credits";
};

export default function RewardShowcaseOverlay({
    item,
    visible
}: {
    item: RewardShowcaseItem;
    visible: boolean;
}) {
    const accentClass = item.accent === "credits"
        ? "border-cyan-300/40 from-cyan-400/25 to-cyan-400/5 text-cyan-100"
        : "border-primary-400/40 from-primary-400/25 to-primary-400/5 text-primary-100";

    return (
        <div
            className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-6 transition duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!visible}
        >
            <div
                className={`w-full max-w-xs rounded-[1.5rem] border bg-gradient-to-b px-5 py-6 text-center shadow-2xl transition duration-300 ${accentClass} ${visible ? "translate-y-0 scale-100" : "translate-y-3 scale-95"}`}
            >
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/55">{item.title}</p>
                <p className="mt-3 font-display text-4xl font-bold text-white">{item.totalValueText}</p>
                <p className="mt-2 text-sm text-white/60">{item.subtitle}</p>
            </div>
        </div>
    );
}
