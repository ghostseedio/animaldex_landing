import Link from "@/app/[locale]/_components/link";
import GuideBuyerSections from "@/components/wildlife-guides/guide-buyer-sections";
import {GUIDE_BAND, GUIDE_NEON, GuideBandHeader, GuideGlyph, GuideMonthBars, GuidePhoto, RarityLabel} from "@/components/wildlife-guides/guide-ui";
import {
    guideAuthorName,
    guideGalleryMedia,
    guideHeroMedia,
    guideMonthRange,
    guidePeakMonth,
    type GuideDetail as GuideDetailData
} from "@/lib/virtual-wildlife-guides";

/**
 * A guide's page body (iOS WildlifeGuideDetailView): the banner with the
 * title, the highlights, who wrote it, the animals and photos, best time,
 * about, then the viewer-dependent sections (notes, local contacts, buying or
 * the bought state). Used by the public guide page and by
 * /app/guides/bought/[id] for a guide the author has since paused.
 */
export default function GuideDetail({guide, locale, viewerLoaded = false}: {guide: GuideDetailData; locale: string; viewerLoaded?: boolean}) {
    const hero = guideHeroMedia(guide);
    const photos = guideGalleryMedia(guide);
    const strip = photos.slice(1);
    const animals = guide.species.filter((animal) => !animal.hidden);
    const username = guide.seller?.username?.replace(/^@/, "");
    const months = guide.stats?.monthCounts;
    const hasMonths = Array.isArray(months) && months.length === 12 && months.some((count) => count > 0);
    const peak = guidePeakMonth(months, locale);
    const days = guide.stats?.visitDayCount ?? 0;
    const range = guideMonthRange(guide.stats?.firstVisitMonth, guide.stats?.lastVisitMonth);
    const highlights = [
        {value: String(guide.speciesCount), label: "species"},
        guide.rareSpeciesCount > 0 ? {value: String(guide.rareSpeciesCount), label: "rare"} : null,
        peak ? {value: peak, label: "best month"} : null,
        days > 0 ? {value: String(days), label: days === 1 ? "day there" : "days there"} : null
    ].filter((item): item is {value: string; label: string} => item !== null).slice(0, 4);

    return (
        <article className="mx-auto w-full max-w-3xl bg-[#121212] pb-28 text-white">
            <header className="relative h-[420px] w-full overflow-hidden bg-[#1F1F1F] md:h-[480px]">
                {hero ? (
                    <GuidePhoto media={hero} size="hero" alt={`Wildlife at ${guide.areaLabel}`} className="absolute inset-0 h-full w-full" />
                ) : (
                    <span className="absolute inset-0" style={{background: `linear-gradient(135deg, ${GUIDE_NEON}55, #12351C)`}} aria-hidden="true" />
                )}
                <span className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b from-transparent via-black/30 to-black/85" aria-hidden="true" />
                <nav className="absolute left-0 top-0 flex flex-wrap gap-2 px-[18px] py-3 text-xs text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]" aria-label="Breadcrumb">
                    <Link href="/wildlife-guides" className="hover:text-white">Wildlife Guides</Link>
                    <span aria-hidden="true">/</span>
                    <span className="max-w-[60vw] truncate">{guide.areaLabel}</span>
                </nav>
                <div className="absolute inset-x-0 bottom-0 px-[18px] pb-5">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{color: GUIDE_NEON}}>
                        Virtual guide{photos.length > 1 ? ` · ${photos.length} photos` : ""}
                    </p>
                    <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.45)] md:text-[40px]">
                        {guide.title}
                    </h1>
                    <p className="mt-2 text-sm text-white/85">{guide.areaLabel}</p>
                </div>
            </header>

            <div className={`${GUIDE_BAND} grid px-2 py-3.5`} style={{gridTemplateColumns: `repeat(${highlights.length}, minmax(0, 1fr))`}}>
                {highlights.map((item, index) => (
                    <div key={item.label} className={`text-center ${index > 0 ? "border-l border-white/10" : ""}`}>
                        <p className="font-display text-xl font-extrabold text-white">{item.value}</p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/45">{item.label}</p>
                    </div>
                ))}
            </div>

            <div className={`${GUIDE_BAND} px-[18px] py-4`}>
                {guide.seller ? (
                    <div className="flex items-center gap-2.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2A2A2A] text-sm font-bold text-white/60">
                            {guide.seller.avatarUrl ? (
                                <img src={guide.seller.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (guide.seller.displayName || guide.seller.username || "?").slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-white">
                                By{" "}
                                {username ? (
                                    <Link href={`/u/${encodeURIComponent(username)}`} className="hover:underline" style={{color: GUIDE_NEON}}>@{username}</Link>
                                ) : guideAuthorName(guide.seller)}
                            </span>
                            <span className="block text-xs text-white/55">From their own sightings{range ? `, ${range}` : ""}</span>
                        </span>
                    </div>
                ) : null}
                {guide.summary ? <p className="mt-3 text-[15px] leading-7 text-white/90">{guide.summary}</p> : null}
            </div>

            {animals.length > 0 ? (
                <>
                    <GuideBandHeader title={`Animals you can find · ${animals.length}`} />
                    <div className={`${GUIDE_BAND} flex gap-2.5 overflow-x-auto px-[18px] py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                        {animals.map((animal) => {
                            const card = (
                                <>
                                    <span className="block h-40 w-[132px] overflow-hidden rounded-lg bg-[#2A2A2A]">
                                        {animal.photo ? <GuidePhoto media={animal.photo} size="card" alt={animal.name} className="h-full w-full" /> : (
                                            <span className="grid h-full w-full place-items-center text-white/35"><GuideGlyph name="paw" className="h-6 w-6" /></span>
                                        )}
                                    </span>
                                    <span className="mt-1.5 line-clamp-2 block text-xs font-semibold text-white">{animal.name}</span>
                                    <RarityLabel rarity={animal.rarity} />
                                </>
                            );
                            return animal.landingPageSlug ? (
                                <Link key={animal.speciesProfileId} href={`/animals/${animal.landingPageSlug}`} className="w-[132px] shrink-0 hover:opacity-90">{card}</Link>
                            ) : (
                                <span key={animal.speciesProfileId} className="w-[132px] shrink-0">{card}</span>
                            );
                        })}
                    </div>
                </>
            ) : null}

            {strip.length > 0 ? (
                <>
                    <GuideBandHeader title="Photos from the place" />
                    <div className={`${GUIDE_BAND} flex snap-x gap-1.5 overflow-x-auto px-[18px] py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                        {strip.map((item, index) => (
                            <a
                                key={item.id ?? `${item.captureId ?? item.imageUrl}-${index}`}
                                href={item.imageUrl ?? undefined}
                                target={item.imageUrl ? "_blank" : undefined}
                                rel="noopener noreferrer"
                                className="block h-[150px] w-[220px] shrink-0 snap-start overflow-hidden rounded-lg bg-[#2A2A2A]"
                            >
                                <GuidePhoto media={item} size="card" alt={`Photo ${index + 2} of ${photos.length} from ${guide.areaLabel}`} className="h-full w-full" />
                            </a>
                        ))}
                    </div>
                </>
            ) : null}

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
