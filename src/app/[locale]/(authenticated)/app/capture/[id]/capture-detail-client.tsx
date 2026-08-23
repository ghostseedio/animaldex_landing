"use client";

import {type ReactNode, useMemo, useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import CaptureGradeBadge from "@/app/[locale]/(authenticated)/app/_components/capture-grade-badge";
import CaptureGiftsPanel from "@/app/[locale]/(authenticated)/app/_components/capture-gifts-panel";
import AnimalDetailTabBar, {type AnimalDetailTab} from "@/components/animal-detail/animal-detail-tab-bar";
import AnimalStoryCard, {type AnimalStoryPrinciple} from "@/components/animal-detail/animal-story-card";
import AnimalStatsPanel from "@/components/animal-detail/animal-stats-panel";
import CaptureMetadataBand from "@/components/animal-detail/capture-metadata-band";
import type {AppCaptureDetail} from "@/data/authenticated-app";

type CaptureDetailClientProps = {
    capture: AppCaptureDetail;
    speciesSlug?: string | null;
    speciesName: string;
    descriptor?: string | null;
    story?: string | null;
    principle?: AnimalStoryPrinciple | null;
    rankings?: ReactNode;
    nativeRange?: ReactNode;
    compare?: ReactNode;
};

function detailText(details: Record<string, any> | null, ...keys: string[]) {
    for (const key of keys) {
        const value = details?.[key];

        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

function detailList(details: Record<string, any> | null, ...keys: string[]) {
    for (const key of keys) {
        const value = details?.[key];

        if (Array.isArray(value)) {
            return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
        }
    }

    return [];
}

export default function CaptureDetailClient({
    capture,
    speciesSlug,
    speciesName,
    descriptor,
    story,
    principle,
    rankings,
    nativeRange,
    compare
}: CaptureDetailClientProps) {
    const [tab, setTab] = useState<AnimalDetailTab>("learn");
    const fallbackStory = detailText(capture.premiumDetails, "species_subtitle_story", "speciesSubtitleStory", "summary", "overview");
    const fallbackPrincipleName = detailText(capture.premiumDetails, "principle_name", "principleName", "animal_power", "animalPower");
    const resolvedPrinciple = useMemo<AnimalStoryPrinciple | null>(() => principle ?? (fallbackPrincipleName ? {
        name: fallbackPrincipleName,
        motto: detailText(capture.premiumDetails, "short_motto", "shortMotto", "motto"),
        expression: detailText(capture.premiumDetails, "principle_expression", "principleExpression"),
        coreLesson: detailText(capture.premiumDetails, "core_lesson", "coreLesson", "lesson"),
        biologicalBasis: detailText(capture.premiumDetails, "biological_basis", "biologicalBasis"),
        applicationExample: detailText(capture.premiumDetails, "application_example", "applicationExample"),
        bestUseCases: detailList(capture.premiumDetails, "best_use_cases", "bestUseCases")
    } : null), [capture.premiumDetails, fallbackPrincipleName, principle]);
    const resolvedSpeciesSlug = speciesSlug ?? capture.speciesSlug?.replace(/_/g, "-") ?? "animal";

    return (
        <div className="mx-auto w-full max-w-[88rem] pb-12">
            <Link href="/app/collection" className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-primary-200">
                <AppIcon name="back" /> Collection
            </Link>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] xl:gap-8">
                <section className="relative aspect-[4/5] max-h-[48rem] overflow-hidden rounded-[2rem] border border-white/10 bg-black lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:aspect-auto">
                    <Image
                        src={capture.imageSrc}
                        alt={capture.animalName}
                        fill
                        priority
                        sizes="(min-width: 1024px) 42vw, 100vw"
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/15" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            {capture.captureGrade != null ? (
                                <CaptureGradeBadge grade={capture.captureGrade} breakdown={capture.gradeBreakdown} />
                            ) : null}
                            {capture.settingTag ? (
                                <span className="rounded-full bg-[#38fa47] px-3 py-1.5 text-xs font-black text-black">
                                    {capture.settingTag}
                                </span>
                            ) : null}
                        </div>
                        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl xl:text-6xl">{capture.animalName}</h1>
                        {capture.scientificName ? (
                            <p className="mt-1 text-sm italic text-white/55 sm:text-base">{capture.scientificName}</p>
                        ) : null}
                        {descriptor ? (
                            <p className="mt-2 max-w-2xl text-[15px] font-medium leading-6 text-white/[0.62]">{descriptor}</p>
                        ) : null}
                    </div>
                </section>

                <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-black font-sans">
                    <div className="px-5 pt-5">
                        <AnimalDetailTabBar value={tab} onChange={setTab} />
                    </div>

                    <div
                        role="tabpanel"
                        aria-label="Learn"
                        hidden={tab !== "learn"}
                        className={tab === "learn" ? "mt-5 px-5 pb-5" : "hidden"}
                    >
                        <div className="-mx-5">
                            <AnimalStoryCard
                                contentKey={`${capture.id}:${resolvedSpeciesSlug}`}
                                story={story ?? fallbackStory}
                                principle={resolvedPrinciple}
                                settingTag={capture.settingTag}
                            />
                        </div>
                        {rankings ? <div className="mt-5">{rankings}</div> : null}
                        <div className="mt-5">
                            <CaptureMetadataBand
                                captureId={capture.id}
                                capturedAt={capture.createdAt}
                                locationLabel={capture.locationLabel}
                                locationHref={capture.locationLat != null && capture.locationLng != null
                                    ? `https://www.google.com/maps/search/?api=1&query=${capture.locationLat},${capture.locationLng}`
                                    : null}
                            />
                            {nativeRange ? <div className="-mx-5">{nativeRange}</div> : null}
                        </div>
                    </div>

                    <div
                        role="tabpanel"
                        aria-label="Stats"
                        hidden={tab !== "stats"}
                        className={tab === "stats" ? "mt-5 px-5 pb-5" : "hidden"}
                    >
                        {capture.isEligibleCapture && !capture.hasUncertaintyFallback ? (
                            <AnimalStatsPanel
                                speciesName={speciesName}
                                speciesSlug={resolvedSpeciesSlug}
                                baseStats={capture.baseGameStats}
                                effectiveStats={capture.effectiveGameStats}
                                totalProgressionXP={capture.totalProgressionXP}
                                recentProgressionSource={capture.recentProgressionSource}
                                captureGrade={capture.captureGrade}
                                settingTag={capture.settingTag}
                                conservationTier={capture.conservationTier}
                            />
                        ) : null}
                        {capture.isDiscoverable ? <CaptureGiftsPanel captureId={capture.id} /> : null}
                    </div>

                    <div
                        role="tabpanel"
                        aria-label="Compare"
                        hidden={tab !== "compare"}
                        className={tab === "compare" ? "mt-5 px-5 pb-5" : "hidden"}
                    >
                        {compare}
                    </div>
                </section>
            </div>
        </div>
    );
}
