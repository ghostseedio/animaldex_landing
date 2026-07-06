import Link from "@/app/[locale]/_components/link";
import {AppProgress} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import PowerSetTierLadder from "@/app/[locale]/(authenticated)/app/sets/power-set-tier-ladder";
import type {PowerSetAlbum, PowerSetCatalogSuggestion} from "@/data/power-sets";

type PowerSetDetailViewProps = {
    album: PowerSetAlbum;
    catalogSuggestions: PowerSetCatalogSuggestion[];
};

function tierBadge(album: PowerSetAlbum) {
    if (album.isGoldMastered) {
        return {label: "Gold", className: "bg-amber-400 text-black"};
    }

    if (album.isCompleted) {
        return {label: "Silver", className: "bg-primary-400 text-black"};
    }

    if (album.activeTier?.tier === "bronze") {
        return {label: "Bronze", className: "bg-orange-400/90 text-black"};
    }

    if (album.activeTier) {
        return {
            label: album.activeTier.tier.charAt(0).toUpperCase() + album.activeTier.tier.slice(1),
            className: "bg-violet-400/90 text-black"
        };
    }

    return {label: "Building", className: "bg-white/5 text-white/55"};
}

export default function PowerSetDetailView({album, catalogSuggestions}: PowerSetDetailViewProps) {
    const badge = tierBadge(album);
    const activeTierName = album.activeTier?.tier ?? null;
    const progressAccent = album.isGoldMastered ? "gold" : album.isCompleted ? "green" : album.isNearComplete ? "violet" : "green";
    const discoveredText = album.activeTier
        ? `${album.activeTier.progressCount} / ${album.activeTier.targetCount} distinct animals · ${album.activeTier.tier.charAt(0).toUpperCase()}${album.activeTier.tier.slice(1)} tier`
        : `${album.found} distinct animals`;

    return (
        <div className="space-y-6">
            <header className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-display text-4xl font-bold text-white">{album.title}</h1>
                        <p className={`mt-2 text-lg font-bold ${album.isCompleted ? "text-primary-200" : "text-white"}`}>
                            {discoveredText}
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${badge.className}`}>{badge.label}</span>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-white/45">{album.subtitle}</p>
                {album.curationReason ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-200">{album.curationReason}</p>
                ) : null}
            </header>

            <section className={`rounded-[1.5rem] border p-5 ${album.isCompleted ? "border-primary-400/30 bg-primary-400/[0.05]" : "border-white/10 bg-[#151515]"}`}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[0.63rem] font-black uppercase tracking-[0.18em] text-primary-200">Current tier</p>
                        <p className="mt-2 text-sm text-white/70">
                            {album.isCompleted
                                ? "Every distinct animal for the active tier is in your collection."
                                : "Distinct owned animals matching this quality count toward each tier."}
                        </p>
                    </div>
                    {album.isCompleted && album.completionReward ? (
                        <div className="text-right">
                            <p className="font-display text-3xl font-bold text-primary-200">+{album.completionReward}</p>
                            <p className="text-xs text-white/35">collector score</p>
                        </div>
                    ) : album.isNearComplete ? (
                        <span className="rounded-full bg-violet-400/15 px-3 py-1.5 text-xs font-bold text-violet-200">Almost there</span>
                    ) : null}
                </div>

                <div className="mt-5">
                    <AppProgress value={album.progressPercent} accent={progressAccent} />
                </div>

                {album.completionRewardBreakdown ? (
                    <div className="mt-5 space-y-2 rounded-[1rem] border border-white/8 bg-black/20 p-4 text-sm">
                        {[
                            ["Base points", album.completionRewardBreakdown.basePoints],
                            ["Habitat weight", album.completionRewardBreakdown.habitatAdjustment],
                            ["Wild bonus", album.completionRewardBreakdown.wildBonus]
                        ].map(([label, value]) => (
                            <div key={String(label)} className="flex justify-between gap-4 text-white/55">
                                <span>{label}</span>
                                <span className="font-bold text-white">{Number(value) >= 0 ? `+${value}` : value}</span>
                            </div>
                        ))}
                        <div className="flex justify-between gap-4 border-t border-white/8 pt-2 font-bold text-white">
                            <span>Total</span>
                            <span className="text-primary-200">+{album.completionRewardBreakdown.totalPoints}</span>
                        </div>
                    </div>
                ) : !album.isCompleted && album.remainingCount > 0 ? (
                    <p className="mt-4 text-sm text-white/45">
                        {album.remainingCount} more distinct {album.remainingCount === 1 ? "animal" : "animals"} to clear the active tier.
                    </p>
                ) : null}
            </section>

            {album.tierStatuses.length > 0 ? (
                <PowerSetTierLadder
                    statuses={album.tierStatuses}
                    catalogLinkedCount={album.catalogLinkedCount}
                    activeTier={activeTierName}
                />
            ) : null}

            {catalogSuggestions.length > 0 ? (
                <section className="space-y-4">
                    <div>
                        <p className="text-[0.63rem] font-black uppercase tracking-[0.18em] text-primary-200">Find in catalog</p>
                        <p className="mt-2 text-sm text-white/45">
                            Catalog animals linked to this power that you have not captured yet.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {catalogSuggestions.map((entry) => (
                            <Link
                                key={entry.speciesProfileId}
                                href={entry.href}
                                className="rounded-[1.4rem] border border-white/10 bg-[#151515] p-3 transition hover:border-primary-400/30"
                            >
                                <div className="aspect-square overflow-hidden rounded-[1rem] bg-white/5">
                                    <img src={entry.imageSrc} alt={entry.name} className="h-full w-full object-cover" />
                                </div>
                                <p className="mt-3 line-clamp-2 font-display text-lg font-bold text-white">{entry.name}</p>
                                <p className="mt-1 text-xs text-white/35">#{String(entry.animalDexNumber).padStart(3, "0")}</p>
                            </Link>
                        ))}
                    </div>
                    {album.catalogLinkedCount > catalogSuggestions.length ? (
                        <p className="text-sm text-white/35">
                            {album.catalogLinkedCount} total catalog animals carry this power.
                        </p>
                    ) : null}
                </section>
            ) : null}

            <section className="space-y-4">
                <p className="text-[0.63rem] font-black uppercase tracking-[0.18em] text-white/35">Collected animals</p>
                {album.matchedItems.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {album.matchedItems.map((item) => (
                            <Link
                                key={item.captureId}
                                href={item.href}
                                className="rounded-[1.4rem] border border-white/10 bg-[#151515] p-3 transition hover:border-primary-400/30"
                            >
                                <div className="aspect-[4/3] overflow-hidden rounded-[1rem] bg-white/5">
                                    <img src={item.imageSrc} alt={item.animalName} className="h-full w-full object-cover" />
                                </div>
                                <div className="mt-3 flex items-start justify-between gap-3">
                                    <p className="line-clamp-2 font-display text-lg font-bold text-white">{item.label}</p>
                                    <span className="text-primary-200">✓</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-white/45">No distinct animals collected for this power yet.</p>
                )}
            </section>
        </div>
    );
}
