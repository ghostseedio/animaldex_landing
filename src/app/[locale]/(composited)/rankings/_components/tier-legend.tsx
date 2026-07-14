import TierBadge from "@/app/[locale]/(composited)/rankings/_components/tier-badge";

type TierLegendProps = {
    tiers: string[];
};

const definitions: Record<string, string> = {
    S: "category leaders with the strongest evidence or AnimalDex stat profile",
    A: "high-ranking specialists that remain near the top of the comparison",
    B: "strong fits with clear category relevance",
    C: "credible entries with narrower or more contextual advantages",
    D: "weaker category fits included for broad comparison",
    E: "edge cases or low-fit entries in expanded lists"
};

export default function TierLegend({tiers}: TierLegendProps) {
    const uniqueTiers = Array.from(new Set(tiers)).sort((left, right) => "SABCDE".indexOf(left) - "SABCDE".indexOf(right));

    if (uniqueTiers.length === 0) {
        return null;
    }

    return (
        <section className="rounded-lg border border-line-300/80 bg-surface-900/70 p-5">
            <h2 className="font-display text-2xl font-bold text-white">Tier guide</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-300">
                Tier labels summarize category fit for this list. They are not interchangeable across unrelated measurements such as speed, bite force, cognition, or body size.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {uniqueTiers.map((tier) => (
                    <div key={tier} className="flex items-start gap-3 rounded-md border border-line-400 bg-canvas-900/40 p-3">
                        <TierBadge tier={tier} />
                        <p className="text-sm leading-6 text-ink-200">{definitions[tier] ?? definitions.E}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
