"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import type {
    UniversalSearchResponse,
    UniversalSearchSpeciesHit
} from "@/data/universal-search";

export type UniversalSearchResultsCopy = {
    loading: string;
    loadingHint: string;
    errorTitle: string;
    errorBody: string;
    rateLimited: string;
    emptyTitle: string;
    emptyBody: string;
    retry: string;
    previewTitle: string;
    speciesTitle: string;
    comparisonsTitle: string;
    locationsTitle: string;
    learnTitle: string;
    factsTitle: string;
    helpTitle: string;
    openSpecies: string;
    openComparison: string;
    viewOnMaps: string;
    poweredNote: string;
};

type UniversalSearchResultsProps = {
    query: string;
    locale: string;
    previewSpecies: Array<{slug: string; name: string; scientificName: string; category: string}>;
    copy: UniversalSearchResultsCopy;
};

/** Mirrors `databaseSpeciesCanonicalSlug`: catalog slugs carry a dex-number suffix. */
function resolveSpeciesHref(hit: UniversalSearchSpeciesHit) {
    const raw = hit.landing_page_slug?.trim()
        || hit.normalized_identity_key?.trim().replace(/_/g, "-")
        || "";
    if (!raw) return null;

    const suffix = hit.animaldex_number ? `-${hit.animaldex_number}` : "";
    const slug = suffix && raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw;
    return slug ? `/animals/${slug}` : null;
}

function SectionHeading({children}: {children: React.ReactNode}) {
    return (
        <h2 className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-primary-200">{children}</h2>
    );
}

function LoadingBar() {
    return (
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-[searchProgress_1.5s_ease-in-out_infinite] rounded-full bg-primary-400" />
            <style>{"@keyframes searchProgress{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}"}</style>
        </div>
    );
}

export default function UniversalSearchResults({
    query,
    locale,
    previewSpecies,
    copy
}: UniversalSearchResultsProps) {
    const [data, setData] = useState<UniversalSearchResponse | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error" | "rate-limited">("loading");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setStatus("loading");
        setData(null);

        (async () => {
            try {
                const response = await fetch("/api/animals/search", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({query, locale})
                });

                if (cancelled) return;

                if (response.status === 429) {
                    setStatus("rate-limited");
                    return;
                }
                if (!response.ok) {
                    setStatus("error");
                    return;
                }

                const payload = (await response.json()) as UniversalSearchResponse;
                if (cancelled) return;
                setData(payload);
                setStatus("ready");
            } catch {
                if (!cancelled) setStatus("error");
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [attempt, locale, query]);

    if (status === "loading") {
        return (
            <div className="space-y-8">
                <div>
                    <LoadingBar />
                    <p className="mt-3 text-sm font-semibold text-white">{copy.loading}</p>
                    <p className="text-xs text-ink-400">{copy.loadingHint}</p>
                </div>

                {previewSpecies.length ? (
                    <section>
                        <SectionHeading>{copy.previewTitle}</SectionHeading>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {previewSpecies.map((item) => (
                                <Link
                                    key={item.slug}
                                    href={`/animals/${item.slug}`}
                                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary-400/40"
                                >
                                    <p className="font-display text-lg font-bold text-white">{item.name}</p>
                                    <p className="mt-1 text-xs italic text-ink-400">{item.scientificName}</p>
                                </Link>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        );
    }

    if (status === "error" || status === "rate-limited") {
        return (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                <h2 className="font-display text-2xl font-bold text-white">{copy.errorTitle}</h2>
                <p className="mx-auto mt-3 max-w-lg text-ink-200">
                    {status === "rate-limited" ? copy.rateLimited : copy.errorBody}
                </p>
                {status === "error" ? (
                    <button
                        type="button"
                        onClick={() => setAttempt((value) => value + 1)}
                        className="mt-6 rounded-full bg-primary-400 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-primary-300"
                    >
                        {copy.retry}
                    </button>
                ) : null}
            </div>
        );
    }

    if (!data) return null;

    const hasAnything = Boolean(
        data.brief
        || data.species.length
        || data.comparisons.length
        || data.locations.length
        || data.learn.length
        || data.facts.length
        || data.help.length
    );

    if (!hasAnything) {
        return (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                <h2 className="font-display text-2xl font-bold text-white">{copy.emptyTitle}</h2>
                <p className="mx-auto mt-3 max-w-lg text-ink-200">{copy.emptyBody}</p>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {data.brief ? (
                <section className="rounded-3xl border border-primary-400/25 bg-primary-400/[0.06] p-6 md:p-8">
                    <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{data.brief.title}</h2>
                    <p className="mt-3 text-base leading-7 text-ink-100">{data.brief.summary}</p>
                    {data.brief.bullets.length ? (
                        <ul className="mt-4 space-y-2">
                            {data.brief.bullets.map((bullet) => (
                                <li key={bullet} className="flex gap-3 text-sm leading-6 text-ink-200">
                                    <span className="text-primary-300" aria-hidden="true">•</span>
                                    <span>{bullet}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </section>
            ) : null}

            {data.species.length ? (
                <section>
                    <SectionHeading>{copy.speciesTitle}</SectionHeading>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {data.species.map((hit) => {
                            const href = resolveSpeciesHref(hit);
                            const body = (
                                <>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-display text-lg font-bold text-white">{hit.display_name}</p>
                                            {hit.scientific_name ? (
                                                <p className="mt-0.5 truncate text-xs italic text-ink-400">{hit.scientific_name}</p>
                                            ) : null}
                                        </div>
                                        {hit.animaldex_number ? (
                                            <span className="shrink-0 text-xs font-black text-ink-500">#{hit.animaldex_number}</span>
                                        ) : null}
                                    </div>
                                    {hit.species_subtitle || hit.core_lesson ? (
                                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-200">
                                            {hit.species_subtitle || hit.core_lesson}
                                        </p>
                                    ) : null}
                                    {hit.match_reasons?.length ? (
                                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-primary-300">
                                            {hit.match_reasons.slice(0, 2).join(" · ")}
                                        </p>
                                    ) : null}
                                </>
                            );

                            return href ? (
                                <Link
                                    key={`${hit.display_name}-${hit.species_profile_id ?? ""}`}
                                    href={href}
                                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-primary-400/40"
                                >
                                    {body}
                                </Link>
                            ) : (
                                <article
                                    key={`${hit.display_name}-${hit.species_profile_id ?? ""}`}
                                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                                >
                                    {body}
                                </article>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            {data.comparisons.length ? (
                <section>
                    <SectionHeading>{copy.comparisonsTitle}</SectionHeading>
                    <div className="grid gap-4 md:grid-cols-2">
                        {data.comparisons.map((hit) => {
                            const slugBase = `${hit.animal_a_slug}-vs-${hit.animal_b_slug}`;
                            const slug = hit.comparison_type && hit.comparison_type !== "battle"
                                ? `${slugBase}-${hit.comparison_type}`
                                : slugBase;
                            return (
                                <Link
                                    key={slug}
                                    href={`/comparisons/${slug}`}
                                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-primary-400/40"
                                >
                                    <p className="font-display text-lg font-bold text-white">
                                        {hit.animal_a_name} <span className="text-primary-300">vs</span> {hit.animal_b_name}
                                    </p>
                                    {hit.quick_verdict ? (
                                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-200">{hit.quick_verdict}</p>
                                    ) : null}
                                    <span className="mt-3 inline-block text-sm font-bold text-primary-200">{copy.openComparison} →</span>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            {data.locations.length ? (
                <section>
                    <SectionHeading>{copy.locationsTitle}</SectionHeading>
                    <div className="grid gap-4 md:grid-cols-2">
                        {data.locations.map((hit) => (
                            <article key={`${hit.name}-${hit.latitude ?? 0}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="font-display text-lg font-bold text-white">{hit.name}</p>
                                    {hit.approx_distance_label ? (
                                        <span className="shrink-0 text-xs font-semibold text-ink-400">{hit.approx_distance_label}</span>
                                    ) : null}
                                </div>
                                {hit.notes ? <p className="mt-2 text-sm leading-6 text-ink-200">{hit.notes}</p> : null}
                                {hit.matched_animal_names.length || hit.notable_animal_names.length ? (
                                    <p className="mt-3 text-xs text-ink-400">
                                        {(hit.matched_animal_names.length ? hit.matched_animal_names : hit.notable_animal_names)
                                            .slice(0, 6)
                                            .join(" · ")}
                                    </p>
                                ) : null}
                                {hit.google_maps_uri ? (
                                    <a
                                        href={hit.google_maps_uri}
                                        target="_blank"
                                        rel="noopener noreferrer nofollow"
                                        className="mt-3 inline-block text-sm font-bold text-primary-200 hover:text-primary-100"
                                    >
                                        {copy.viewOnMaps} →
                                    </a>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            {data.learn.length ? (
                <section>
                    <SectionHeading>{copy.learnTitle}</SectionHeading>
                    <div className="grid gap-4 md:grid-cols-2">
                        {data.learn.map((hit) => (
                            <article key={`${hit.title}-${hit.display_name}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <p className="font-display text-lg font-bold text-white">{hit.title}</p>
                                {hit.subtitle ? <p className="mt-1 text-sm text-ink-300">{hit.subtitle}</p> : null}
                                {hit.principle_expression ? (
                                    <p className="mt-3 text-sm leading-6 text-ink-200">{hit.principle_expression}</p>
                                ) : null}
                                {hit.short_motto ? (
                                    <p className="mt-3 text-sm font-semibold italic text-primary-200">“{hit.short_motto}”</p>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            {data.facts.length ? (
                <section>
                    <SectionHeading>{copy.factsTitle}</SectionHeading>
                    <div className="grid gap-4 md:grid-cols-2">
                        {data.facts.map((hit) => (
                            <article key={`fact-${hit.display_name}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <p className="font-display text-lg font-bold text-white">{hit.display_name}</p>
                                {hit.species_spotlight ? (
                                    <p className="mt-2 text-sm leading-6 text-ink-200">{hit.species_spotlight}</p>
                                ) : null}
                                <dl className="mt-3 space-y-1.5 text-sm">
                                    {[
                                        ["Habitat", hit.typical_habitat],
                                        ["Diet", hit.diet_summary],
                                        ["Predators", hit.predators_summary],
                                        ["Lifespan", hit.lifespan_estimate],
                                        ["Where to look", hit.where_to_look]
                                    ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                                        <div key={label} className="flex gap-2">
                                            <dt className="shrink-0 font-semibold text-ink-400">{label}:</dt>
                                            <dd className="text-ink-200">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {hit.interesting_facts.length ? (
                                    <ul className="mt-3 space-y-1.5">
                                        {hit.interesting_facts.slice(0, 3).map((fact) => (
                                            <li key={fact} className="flex gap-2 text-sm leading-6 text-ink-200">
                                                <span className="text-primary-300" aria-hidden="true">•</span>
                                                <span>{fact}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            {data.help.length ? (
                <section>
                    <SectionHeading>{copy.helpTitle}</SectionHeading>
                    <div className="space-y-3">
                        {data.help.map((hit) => (
                            <article key={hit.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <p className="font-bold text-white">{hit.title}</p>
                                <p className="mt-2 text-sm leading-6 text-ink-200">{hit.summary}</p>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            <p className="text-xs text-ink-500">{copy.poweredNote}</p>
        </div>
    );
}
