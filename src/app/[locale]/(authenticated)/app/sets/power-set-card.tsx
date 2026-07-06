import Link from "@/app/[locale]/_components/link";
import {AppProgress} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {PowerSetAlbum} from "@/data/power-sets";

type PowerSetCardProps = {
    album: PowerSetAlbum;
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
        return {label: album.activeTier.tier.charAt(0).toUpperCase() + album.activeTier.tier.slice(1), className: "bg-violet-400/90 text-black"};
    }

    return {label: "Building", className: "bg-white/5 text-white/55"};
}

export default function PowerSetCard({album}: PowerSetCardProps) {
    const badge = tierBadge(album);
    const accent = album.isGoldMastered ? "gold" : album.isCompleted ? "green" : album.isNearComplete ? "violet" : "green";

    return (
        <Link href={`/app/sets/${encodeURIComponent(album.key)}`} className="block">
            <article className={`overflow-hidden rounded-[1.5rem] border bg-gradient-to-br from-primary-400/[0.08] to-[#141414] p-5 transition hover:-translate-y-0.5 hover:border-primary-400/35 ${album.isCompleted ? "border-primary-400/30" : album.isNearComplete ? "border-violet-400/30" : "border-white/10"}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[0.63rem] font-black uppercase tracking-wider text-primary-200">Power collection</p>
                    <h2 className="mt-2 font-display text-2xl font-bold">{album.title}</h2>
                    <p className="mt-1 text-sm text-white/40 line-clamp-2">{album.subtitle}</p>
                    {album.curationReason ? (
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-200">{album.curationReason}</p>
                    ) : album.activeTier ? (
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/35">
                            {album.activeTier.tier.charAt(0).toUpperCase() + album.activeTier.tier.slice(1)} tier · {album.progressLabel}
                        </p>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${badge.className}`}>{badge.label}</span>
                    <span className="text-sm font-bold text-white/70">{album.progressLabel}</span>
                </div>
            </div>
            <div className="mt-6">
                <AppProgress value={album.progressPercent} accent={accent} />
            </div>
            <div className="mt-2 flex justify-between text-xs font-bold text-white/35">
                <span>{album.found} distinct species</span>
                <span>{album.progressPercent}%</span>
            </div>
        </article>
        </Link>
    );
}
