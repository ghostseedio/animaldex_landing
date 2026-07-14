"use client";

import {useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import TierBadge from "@/app/[locale]/(composited)/rankings/_components/tier-badge";

type RankingTableItem = {
    rank: number;
    tier: string;
    speciesSlug: string;
    speciesName: string;
    iconSrc: string;
    primaryMetric: string;
    shortReason: string;
    domain: string;
};

type RankingTableProps = {
    title: string;
    description: string;
    labels: {
        rank: string;
        animal: string;
        metric: string;
        tier: string;
        whyItRanks: string;
        readSpecies: string;
        search: string;
        searchPlaceholder: string;
        tierFilter: string;
        domainFilter: string;
        all: string;
        showing: string;
        of: string;
        backToTop: string;
    };
    items: RankingTableItem[];
};

export default function RankingTable({title, description, labels, items}: RankingTableProps) {
    const [query, setQuery] = useState("");
    const [tier, setTier] = useState("all");
    const [domain, setDomain] = useState("all");
    const [showBackToTop, setShowBackToTop] = useState(false);
    const tiers = useMemo(() => Array.from(new Set(items.map((item) => item.tier))).sort((left, right) => "SABCDE".indexOf(left) - "SABCDE".indexOf(right)), [items]);
    const domains = useMemo(() => Array.from(new Set(items.map((item) => item.domain))).filter(Boolean).sort(), [items]);
    const normalizedQuery = query.trim().toLowerCase();
    const filteredItems = items.filter((item) => {
        const matchesQuery = normalizedQuery.length === 0 || [
            item.speciesName,
            item.primaryMetric,
            item.shortReason,
            item.tier,
            item.domain
        ].join(" ").toLowerCase().includes(normalizedQuery);

        return matchesQuery
            && (tier === "all" || item.tier === tier)
            && (domain === "all" || item.domain === domain);
    });
    const firstVisibleRankByTier = new Map<string, number>();

    for (const item of filteredItems) {
        if (!firstVisibleRankByTier.has(item.tier)) {
            firstVisibleRankByTier.set(item.tier, item.rank);
        }
    }

    return (
        <section className="flex flex-col gap-5" aria-labelledby="ranking-table-heading">
            <div className="flex flex-col gap-2">
                <h2 id="ranking-table-heading" className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
                <p className="max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Tier jump links">
                {tiers.map((item) => (
                    <a
                        key={item}
                        href={`#tier-${item}`}
                        className="min-h-[40px] rounded-md border border-line-300 bg-surface-900 px-3 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-500/60 hover:text-primary-100 focus-visible:text-primary-100"
                    >
                        {item} tier
                    </a>
                ))}
            </div>

            <div className="sticky top-[73px] z-20 flex flex-col gap-3 rounded-lg border border-line-300 bg-canvas-900/95 p-3 backdrop-blur lg:flex-row lg:items-end">
                <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
                    <label htmlFor="animal-ranking-search" className="text-sm font-semibold text-white">{labels.search}</label>
                    <input
                        id="animal-ranking-search"
                        type="search"
                        value={query}
                        placeholder={labels.searchPlaceholder}
                        onChange={(event) => setQuery(event.target.value)}
                        onFocus={() => setShowBackToTop(true)}
                        className="min-h-[42px] rounded-md border border-line-300 bg-surface-900 px-3 text-base text-white placeholder:text-ink-400 outline-none transition-colors focus:border-primary-400"
                    />
                </div>
                <label className="flex flex-col gap-2 text-sm font-semibold text-white">
                    {labels.domainFilter}
                    <select
                        value={domain}
                        onChange={(event) => setDomain(event.target.value)}
                        onFocus={() => setShowBackToTop(true)}
                        className="min-h-[42px] rounded-md border border-line-300 bg-surface-900 px-3 text-base text-white outline-none transition-colors focus:border-primary-400"
                    >
                        <option value="all">{labels.all}</option>
                        {domains.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-white">
                    {labels.tierFilter}
                    <select
                        value={tier}
                        onChange={(event) => setTier(event.target.value)}
                        onFocus={() => setShowBackToTop(true)}
                        className="min-h-[42px] rounded-md border border-line-300 bg-surface-900 px-3 text-base text-white outline-none transition-colors focus:border-primary-400"
                    >
                        <option value="all">{labels.all}</option>
                        {tiers.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                </label>
                <p className="text-sm text-ink-300 lg:ml-auto lg:pb-3" aria-live="polite">
                    {labels.showing} {filteredItems.length} {labels.of} {items.length}
                </p>
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-line-300 bg-surface-900/75 lg:block">
                <table className="w-full min-w-[960px] border-collapse">
                    <thead className="sticky top-[177px] z-10 bg-surface-900">
                        <tr className="border-b border-line-300 text-left">
                            <th className="w-24 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.rank}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.animal}</th>
                            <th className="w-24 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.tier}</th>
                            <th className="w-56 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.metric}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.whyItRanks}</th>
                            <th className="w-40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.readSpecies}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.map((item) => (
                            <tr key={`${item.rank}-${item.speciesSlug}`} id={firstVisibleRankByTier.get(item.tier) === item.rank ? `tier-${item.tier}` : undefined} className="scroll-mt-48 border-b border-line-400 transition-colors last:border-b-0 hover:bg-surface-800/55">
                                <td className="px-4 py-3 text-base font-semibold text-white">#{item.rank}</td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/animals/${item.speciesSlug}`}
                                        className="flex items-center gap-3 text-base font-semibold text-white transition-colors hover:text-primary-100 focus-visible:text-primary-100"
                                    >
                                        <SpeciesArtworkImage
                                            slug={item.speciesSlug}
                                            alt={`${item.speciesName} animal icon`}
                                            src={item.iconSrc}
                                            className="h-11 w-11 rounded-md border border-line-300"
                                            sizes="44px"
                                        />
                                        {item.speciesName}
                                    </Link>
                                </td>
                                <td className="px-4 py-3"><TierBadge tier={item.tier} /></td>
                                <td className="px-4 py-3 text-base font-semibold text-primary-100">{item.primaryMetric}</td>
                                <td className="px-4 py-3 text-sm leading-6 text-ink-200">{item.shortReason}</td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/animals/${item.speciesSlug}`}
                                        className="text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100"
                                        underline
                                    >
                                        {labels.readSpecies}
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid gap-3 lg:hidden">
                {filteredItems.map((item) => (
                    <article key={`${item.rank}-${item.speciesSlug}`} className="rounded-lg border border-line-300 bg-surface-900/75 p-4">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-300 bg-canvas-900 text-sm font-bold text-white">#{item.rank}</span>
                            <div className="min-w-0 flex-1">
                                <Link href={`/animals/${item.speciesSlug}`} className="flex items-center gap-3 font-semibold text-white transition-colors hover:text-primary-100 focus-visible:text-primary-100">
                                    <SpeciesArtworkImage
                                        slug={item.speciesSlug}
                                        alt={`${item.speciesName} animal icon`}
                                        src={item.iconSrc}
                                        className="h-12 w-12 shrink-0 rounded-md border border-line-300"
                                        sizes="48px"
                                    />
                                    <span>{item.speciesName}</span>
                                </Link>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <TierBadge tier={item.tier} />
                                    <span className="rounded-md border border-line-400 bg-canvas-900/50 px-2.5 py-1 text-sm font-semibold text-primary-100">{item.primaryMetric}</span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-ink-200">{item.shortReason}</p>
                                <Link href={`/animals/${item.speciesSlug}`} className="mt-3 inline-block text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100" underline>
                                    {labels.readSpecies}
                                </Link>
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            {showBackToTop && (
                <a
                    href="#top"
                    className="fixed bottom-4 right-4 z-30 rounded-md border border-primary-400/60 bg-canvas-900 px-4 py-3 text-sm font-semibold text-primary-100 shadow-lg transition-colors hover:bg-surface-800 focus-visible:bg-surface-800"
                >
                    {labels.backToTop}
                </a>
            )}
        </section>
    );
}
