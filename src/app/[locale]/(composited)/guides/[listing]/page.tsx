import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {
    GUIDE_BAND,
    GUIDE_NEON,
    GuideBandHeader,
    GuideGlyph,
    GuideMonthBars,
    GuidePhoto,
    RarityLabel
} from "@/components/wildlife-guides/guide-ui";
import {GuidePageView} from "@/components/wildlife-guides/guide-page-view";
import {getPublicWildlifeGuide} from "@/data/virtual-wildlife-guides";
import {earnBreadcrumbList} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {
    GUIDE_DISCLAIMER,
    GUIDE_INCLUDED,
    formatGuidePrice,
    guideAuthorName,
    guideMediaSrc,
    guidePath,
    guideSeo,
    guideStatsLine,
    guideStructuredData,
    parseGuideRouteSegment,
    type GuideDetail
} from "@/lib/virtual-wildlife-guides";

export const revalidate = 86400;

type Props = {params: {locale: string; listing: string}};

async function resolve(params: Props["params"]) {
    const route = parseGuideRouteSegment(params.listing);
    if (!route) return null;
    return getPublicWildlifeGuide(route.listingId);
}

function visibleMedia(guide: GuideDetail) {
    return guide.media.filter((media) => !media.hidden && media.captureId);
}

function shareImage(guide: GuideDetail) {
    const src = guideMediaSrc(visibleMedia(guide)[0], "hero");
    return src ? new URL(src, getSiteUrl()).toString() : null;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const guide = await resolve(params);
    if (!guide) return {title: "Wildlife Guide unavailable", robots: {index: false, follow: false}};
    const canonicalPath = guidePath(guide);
    const canonicalUrl = getAbsoluteUrl(params.locale, canonicalPath);
    const seo = guideSeo(guide);
    const image = shareImage(guide) ?? "/images/og.png";
    return {
        title: {absolute: seo.title},
        description: seo.description,
        robots: {index: true, follow: true},
        alternates: {canonical: canonicalPath},
        openGraph: {
            type: "website",
            title: seo.title,
            description: seo.description,
            url: canonicalUrl,
            siteName: "AnimalDex",
            images: [{url: image, alt: guide.title}]
        },
        twitter: {card: "summary_large_image", title: seo.title, description: seo.description, images: [image]}
    };
}

export default async function WildlifeGuidePage({params}: Props) {
    const guide = await resolve(params);
    if (!guide) notFound();
    const canonicalPath = guidePath(guide);
    if (`/guides/${params.listing}` !== canonicalPath) redirect(canonicalPath);

    const canonicalUrl = getAbsoluteUrl(params.locale, canonicalPath);
    const media = visibleMedia(guide);
    const species = guide.species.filter((item) => !item.hidden);
    const username = guide.seller?.username?.replace(/^@/, "");
    const months = guide.stats?.monthCounts;
    const hasMonths = Array.isArray(months) && months.length === 12 && months.some((count) => count > 0);
    const price = formatGuidePrice(guide.amountMinor, guide.currencyCode, params.locale);
    const structuredData = [
        guideStructuredData(guide, canonicalUrl, shareImage(guide)),
        earnBreadcrumbList(params.locale, [
            {name: "Home", path: "/"},
            {name: "Wildlife Guides", path: "/wildlife-guides"},
            {name: guide.title, path: canonicalPath}
        ])
    ];

    return (
        <>
            <GuidePageView
                event="wildlife_guide_web_view"
                dimensions={{guide_id: guide.id, country: guide.countryCode, service_category: guide.serviceCategory ?? "", page_type: "guide"}}
            />
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData).replace(/</g, "\\u003c")}} />
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

                <GuideBandHeader
                    id="species"
                    title={`Animals here · ${species.length}`}
                    trailing={guide.hasPrivateAccess ? null : (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45">
                            <GuideGlyph name="lock" className="h-3 w-3" />
                            Notes unlock with the guide
                        </span>
                    )}
                />
                {species.map((animal) => {
                    const name = animal.landingPageSlug ? (
                        <Link href={`/animals/${animal.landingPageSlug}`} className="hover:underline">{animal.name}</Link>
                    ) : animal.name;
                    return (
                        <div key={animal.speciesProfileId} className={`${GUIDE_BAND} px-[18px] py-3`}>
                            <div className="flex items-center gap-3">
                                <span className="h-[52px] w-[52px] shrink-0 overflow-hidden bg-[#2A2A2A]">
                                    {animal.photo ? <GuidePhoto media={animal.photo} size="thumb" alt="" className="h-full w-full" /> : (
                                        <span className="grid h-full w-full place-items-center text-white/35"><GuideGlyph name="paw" className="h-5 w-5" /></span>
                                    )}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">{name}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <RarityLabel rarity={animal.rarity} />
                                        {animal.threatened && animal.conservationTier ? (
                                            <span className="text-[10px] font-semibold text-[#FF9F0A]">{animal.conservationTier}</span>
                                        ) : null}
                                        {animal.captureCount > 1 ? <span className="text-[10px] text-white/45">Seen {animal.captureCount}×</span> : null}
                                    </span>
                                </span>
                            </div>
                            {guide.hasPrivateAccess && animal.note ? (
                                <p className="mt-2 pl-16 text-xs leading-5 text-white/60">{animal.note}</p>
                            ) : null}
                        </div>
                    );
                })}

                <GuideBandHeader id="included" title="What you get" />
                <div className={`${GUIDE_BAND} px-[18px] py-4`}>
                    <ul className="grid gap-3">
                        {GUIDE_INCLUDED.map((line, index) => (
                            <li key={line} className="flex items-start gap-3 text-sm leading-6 text-white">
                                <span className="mt-0.5 shrink-0" style={{color: GUIDE_NEON}}>
                                    <GuideGlyph name={(["note", "chat", "people"] as const)[index]} className="h-5 w-5" />
                                </span>
                                {line}
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="font-display text-2xl font-bold text-white">{price}</span>
                        <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white/50"
                        >
                            Coming soon
                        </button>
                    </div>
                </div>
                <p className={`${GUIDE_BAND} px-[18px] py-4 text-[11px] leading-5 text-white/45`} style={{backgroundColor: "rgba(31,31,31,0.5)"}}>
                    {GUIDE_DISCLAIMER}
                </p>
            </article>
        </>
    );
}
