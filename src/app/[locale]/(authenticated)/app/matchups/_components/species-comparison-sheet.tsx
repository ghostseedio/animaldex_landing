"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import type {ChallengeEntry} from "@/data/challenges";

type SpeciesComparisonSheetProps = {
    slug?: string | null;
    animalASlug?: string | null;
    animalBSlug?: string | null;
    animalAFallbackName?: string;
    animalBFallbackName?: string;
    onClose: () => void;
};

function displayName(slug: string | null | undefined, fallback?: string) {
    if (fallback?.trim()) return fallback.trim();
    if (!slug) return "Animal";
    return slug
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export default function SpeciesComparisonSheet({
    slug,
    animalASlug,
    animalBSlug,
    animalAFallbackName,
    animalBFallbackName,
    onClose
}: SpeciesComparisonSheetProps) {
    const [comparison, setComparison] = useState<ChallengeEntry | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams();
        if (slug) params.set("slug", slug);
        if (animalASlug) params.set("animalA", animalASlug);
        if (animalBSlug) params.set("animalB", animalBSlug);

        setLoading(true);
        setError(null);
        setComparison(null);

        fetch(`/api/app/species-comparison?${params.toString()}`, {
            headers: {Accept: "application/json"}
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload.error ?? "Comparison unavailable.");
                }
                return payload.comparison as ChallengeEntry;
            })
            .then((entry) => {
                if (!cancelled) setComparison(entry);
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : "Comparison unavailable.");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [slug, animalASlug, animalBSlug]);

    const nameA = comparison?.animalADisplayName
        ?? displayName(comparison?.animalASlug ?? animalASlug, animalAFallbackName);
    const nameB = comparison?.animalBDisplayName
        ?? displayName(comparison?.animalBSlug ?? animalBSlug, animalBFallbackName);
    const fightTitle = comparison?.title ?? `${nameA} vs ${nameB}`;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button type="button" aria-label="Close comparison" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-[#0d0d0d] shadow-2xl sm:rounded-[1.75rem]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-primary-200">Species comparison</p>
                        <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{fightTitle}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-full border border-white/10 p-2 text-white/45">
                        <AppIcon name="close" className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {loading ? (
                        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-400/30 border-t-primary-400" />
                            <p className="text-sm font-bold text-white/70">Building evergreen species comparison…</p>
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-white/35">
                                {nameA} vs {nameB}
                            </p>
                        </div>
                    ) : null}

                    {!loading && error ? (
                        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                            <p className="font-display text-2xl font-bold text-white">Comparison unavailable</p>
                            <p className="max-w-sm text-sm text-white/55">{error}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white"
                            >
                                Close
                            </button>
                        </div>
                    ) : null}

                    {!loading && comparison ? (
                        <div className="space-y-5">
                            {comparison.featuredImage?.src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={comparison.featuredImage.src}
                                    alt={comparison.featuredImage.alt || fightTitle}
                                    className="aspect-[16/9] w-full rounded-[1.15rem] object-cover"
                                />
                            ) : null}

                            <div className="rounded-[1.15rem] border border-primary-400/25 bg-primary-400/10 px-4 py-4">
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-primary-200">Quick verdict</p>
                                <p className="mt-2 text-sm leading-6 text-white/80">{comparison.quickVerdict}</p>
                            </div>

                            {comparison.shortAnswer.length ? (
                                <div className="space-y-2">
                                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">Short answer</p>
                                    {comparison.shortAnswer.slice(0, 3).map((paragraph) => (
                                        <p key={paragraph} className="text-sm leading-6 text-white/60">{paragraph}</p>
                                    ))}
                                </div>
                            ) : null}

                            {comparison.statCategories.length ? (
                                <div className="space-y-2.5">
                                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">Trait edges</p>
                                    <div className="space-y-2">
                                        {comparison.statCategories.slice(0, 5).map((stat) => {
                                            const edge = stat.advantage === "animalA"
                                                ? nameA
                                                : stat.advantage === "animalB"
                                                    ? nameB
                                                    : stat.advantage === "even"
                                                        ? "Even"
                                                        : "Depends";
                                            return (
                                                <div key={stat.key} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-bold text-white">{stat.label}</p>
                                                        <span className="text-[0.68rem] font-black uppercase tracking-[0.1em] text-primary-200">{edge}</span>
                                                    </div>
                                                    {stat.takeaway ? (
                                                        <p className="mt-1.5 text-xs leading-5 text-white/45">{stat.takeaway}</p>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            {comparison.scenarioBreakdown.length ? (
                                <div className="space-y-2.5">
                                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">Scenarios</p>
                                    {comparison.scenarioBreakdown.slice(0, 3).map((scenario) => (
                                        <div key={scenario.slug} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                                            <p className="text-sm font-bold text-white">{scenario.title}</p>
                                            <p className="mt-1 text-xs leading-5 text-white/50">{scenario.verdict}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {comparison.finalTake.length ? (
                                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-4">
                                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">Final take</p>
                                    <p className="mt-2 text-sm leading-6 text-white/65">{comparison.finalTake[0]}</p>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                {comparison ? (
                    <div className="border-t border-white/10 p-5">
                        <Link
                            href={`/comparisons/${comparison.slug}`}
                            className="flex w-full items-center justify-center rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black"
                        >
                            Open full page
                        </Link>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
