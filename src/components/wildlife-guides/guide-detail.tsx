import Link from "@/app/[locale]/_components/link";
import GuideBuyerSections from "@/components/wildlife-guides/guide-buyer-sections";
import {GUIDE_BAND, GUIDE_NEON, GuideBandHeader, GuideMonthBars, GuidePhoto} from "@/components/wildlife-guides/guide-ui";
import {guideAuthorName, guideStatsLine, type GuideDetail as GuideDetailData} from "@/lib/virtual-wildlife-guides";

/**
 * A guide's page body (iOS WildlifeGuideDetailView): photos, title band, best
 * time, about, then the viewer-dependent sections (animals and notes, local
 * contacts, buying or the bought state). Used by the public guide page and by
 * /app/guides/bought/[id] for a guide the author has since paused.
 */
export default function GuideDetail({guide, locale, viewerLoaded = false}: {guide: GuideDetailData; locale: string; viewerLoaded?: boolean}) {
    const media = guide.media.filter((item) => !item.hidden && item.captureId);
    const username = guide.seller?.username?.replace(/^@/, "");
    const months = guide.stats?.monthCounts;
    const hasMonths = Array.isArray(months) && months.length === 12 && months.some((count) => count > 0);
    return (
        <article className="mx-auto w-full max-w-3xl bg-[#121212] pb-16 pt-20 text-white md:pt-24">
        <nav className="flex flex-wrap gap-2 px-[18px] pb-3 text-xs text-white/50" aria-label="Breadcrumb">
            <Link href="/wildlife-guides" className="hover:text-white">Wildlife Guides</Link>
            <span aria-hidden="true">/</span>
            <span className="truncate text-white/70">{guide.areaLabel}</span>
        </nav>

        {media.length > 0 ? (
            <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Photos from this place">
                {media.map((item, index) => (
                    <figure key={item.id ?? `${item.captureId}-${index}`} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-[#1F1F1F]">
                        <GuidePhoto media={item} size="hero" alt={`Wildlife photo ${index + 1} of ${media.length} from ${guide.areaLabel}`} className="h-full w-full" />
                        {media.length > 1 ? (
                            <figcaption className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                                {index + 1} / {media.length}
                            </figcaption>
                        ) : null}
                    </figure>
                ))}
            </div>
        ) : null}

        <header className={`${GUIDE_BAND} px-[18px] py-5`}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{color: GUIDE_NEON}}>Virtual guide</p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-white md:text-4xl">{guide.title}</h1>
            <p className="mt-2 text-sm text-white/70">{guide.areaLabel}</p>
            <p className="mt-1.5 text-xs text-white/45">{guideStatsLine(guide)}</p>
            {guide.seller ? (
                <p className="mt-3 text-xs font-semibold text-white/65">
                    By{" "}
                    {username ? (
                        <Link href={`/u/${encodeURIComponent(username)}`} className="hover:underline" style={{color: GUIDE_NEON}}>@{username}</Link>
                    ) : guideAuthorName(guide.seller)}
                </p>
            ) : null}
        </header>

        {guide.seasonLine ? (
            <>
                <GuideBandHeader title="Best time" />
                <div className={`${GUIDE_BAND} px-[18px] py-4`}>
                    <p className="text-sm leading-6 text-white">{guide.seasonLine}</p>
                    {hasMonths ? <div className="mt-4"><GuideMonthBars counts={months ?? []} /></div> : null}
                </div>
            </>
        ) : null}

        {guide.overview ? (
            <>
                <GuideBandHeader title="About this place" />
                <div className={`${GUIDE_BAND} whitespace-pre-line px-[18px] py-4 text-[15px] leading-7 text-white/90`}>{guide.overview}</div>
            </>
        ) : null}

            <GuideBuyerSections initial={guide} locale={locale} viewerLoaded={viewerLoaded} />
        </article>
    );
}
