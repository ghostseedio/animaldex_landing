"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import SpeciesRankingCarousel from "@/app/[locale]/(composited)/animals/[slug]/species-ranking-carousel";
import type {SpeciesRankingItem} from "@/data/species-rankings";

/**
 * Community rankings on the Stats tab, where iOS puts them
 * (`speciesRankingCarousel` is gated on `shouldShowStatsDetailContent`).
 *
 * Fetched on the client because the species page is statically generated and
 * rankings change with every new public capture. Renders nothing until there is
 * something to rank, so a species with no public captures shows no empty shell.
 */

/**
 * "Spotted by", ported from iOS `photographerRow`.
 *
 * iOS reads it off the catalog seed's `spotter`; a public species page has no
 * seed, so the photographer of the capture the page is representing — the
 * viewer's own if they have one, otherwise the top-ranked — is the same person.
 * Ranking rows carry no avatar URL, so the monogram stands in for
 * `ProfileAvatarView`.
 */
function SpeciesSpotterRow({item}: {item: SpeciesRankingItem}) {
    const handle = item.username?.trim();
    const name = item.displayName?.trim() || (handle ? `@${handle}` : null);

    if (!name) return null;

    const monogram = name.replace(/^@/, "").trim().charAt(0).toUpperCase();

    const body = (
        <>
            <span
                aria-hidden="true"
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-white/[0.12] bg-white/[0.06] font-display text-sm font-bold text-white"
            >
                {monogram}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11px] leading-none text-ink-400">Spotted by</span>
                <span className="truncate text-sm font-semibold leading-tight text-white">{name}</span>
                {handle ? <span className="truncate text-[11px] leading-none text-ink-300">@{handle}</span> : null}
            </span>
            {handle ? (
                <span aria-hidden="true" className="ml-auto shrink-0 text-xs font-bold text-ink-400 transition-transform duration-300 group-hover:translate-x-0.5">
                    ›
                </span>
            ) : null}
        </>
    );

    const shell = "flex items-center gap-2.5 border border-line-300 bg-white/[0.02] px-5 py-3.5";

    return handle ? (
        <Link href={`/u/${handle}`} className={`group ${shell} transition-colors hover:border-primary-500/40`}>
            {body}
        </Link>
    ) : (
        <div className={shell}>{body}</div>
    );
}

export default function SpeciesRankingsSection({
    speciesSlug,
    speciesName,
    currentCaptureId,
    currentCaptureGrade,
    labels
}: {
    speciesSlug: string;
    speciesName: string;
    currentCaptureId?: string | null;
    currentCaptureGrade?: number | null;
    labels: React.ComponentProps<typeof SpeciesRankingCarousel>["labels"];
}) {
    const [items, setItems] = useState<SpeciesRankingItem[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        void (async () => {
            try {
                const response = await fetch(
                    `/api/app/species-rankings?slug=${encodeURIComponent(speciesSlug)}`,
                    {headers: {Accept: "application/json"}, signal: controller.signal}
                );
                if (!response.ok) return;
                const payload = await response.json();
                setItems(Array.isArray(payload.items) ? payload.items : []);
            } catch {
                // Leave the section absent rather than claiming there are no rankings.
            }
        })();

        return () => controller.abort();
    }, [speciesSlug]);

    if (items.length === 0) return null;

    // The capture this page is representing: the viewer's own if it is ranked here,
    // otherwise the top-ranked one — the photograph the page is actually showing.
    const spotterItem = items.find((item) => item.captureId === currentCaptureId) ?? items[0];

    return (
        <div className="flex flex-col gap-4">
            <SpeciesSpotterRow item={spotterItem} />
            <SpeciesRankingCarousel
                layout="wide"
                speciesSlug={speciesSlug}
                speciesName={speciesName}
                items={items}
                currentCaptureId={currentCaptureId}
                currentCaptureGrade={currentCaptureGrade}
                labels={labels}
            />
        </div>
    );
}
