"use client";

/**
 * Companions, the first tab (docs/companion-loop/SPEC.md, phase 4): every
 * animal you hold, in the server's order (an unread message, a referral
 * waiting, an open step, then the most recent). A row is the animal as its
 * icon art, its name, its level and stage, and one line on where the two of
 * you are. Tapping it opens that animal's chat on its newest card.
 *
 * Refreshed when the tab is opened and when the window comes back into view.
 */

import {useEffect, useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {useCompanions} from "@/components/companions/use-companions";
import {
    COMPANIONS_COPY,
    bondChipText,
    companionStatusLine,
    companionSummaryName,
    type CompanionSummary
} from "@/lib/companion-bond";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

const NEON = "#A7F432";

function CompanionArt({slug}: {slug: string | null}) {
    const [failed, setFailed] = useState(false);
    if (!slug || failed) return <span aria-hidden="true" className="h-14 w-14 shrink-0" />;
    return (
        <span className="relative h-14 w-14 shrink-0">
            <Image src={getSpeciesImageRoute(slug)} alt="" fill sizes="56px" unoptimized className="object-contain" onError={() => setFailed(true)} />
        </span>
    );
}

function CompanionRow({row}: {row: CompanionSummary}) {
    const status = companionStatusLine(row);
    const unread = row.unread > 0;
    const body = (
        <>
            <CompanionArt slug={row.slug} />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="truncate text-base font-bold text-white">{companionSummaryName(row)}</span>
                    {row.mastered ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-black" style={{backgroundColor: NEON}}>
                            {COMPANIONS_COPY.mastered}
                        </span>
                    ) : null}
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-white/55">{bondChipText(row)}</span>
                <span className={`mt-1 flex items-center gap-1.5 text-sm ${unread ? "font-semibold text-white" : "text-white/60"}`}>
                    {unread ? <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: NEON}} /> : null}
                    <span className="truncate">{status.text}</span>
                </span>
            </span>
            <AppIcon name="chevron" className="h-4 w-4 shrink-0 text-white/35" />
        </>
    );
    const className = "flex items-center gap-3.5 border-b border-white/[0.08] px-4 py-3.5 transition hover:bg-white/[0.03] md:px-5";
    // Its chat, on its newest card.
    return row.captureId
        ? <Link href={`/app/capture/${encodeURIComponent(row.captureId)}?talk=1`} className={className}>{body}</Link>
        : <div className={className}>{body}</div>;
}

export default function CompanionsPage() {
    const {rows, didLoad, available, reload} = useCompanions();

    useEffect(() => {
        void reload();
        const onFocus = () => void reload();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [reload]);

    return (
        <AppPage narrow>
            <AppPageHeader eyebrow="AnimalDex" title={COMPANIONS_COPY.title} />
            {!didLoad ? (
                <div className="-mx-4 md:mx-0" aria-busy="true">
                    {[0, 1, 2].map((index) => (
                        <div key={index} className="flex items-center gap-3.5 border-b border-white/[0.08] px-4 py-3.5">
                            <span className="h-14 w-14 shrink-0 bg-white/[0.05]" />
                            <span className="h-4 w-40 bg-white/[0.05]" />
                        </div>
                    ))}
                </div>
            ) : !available ? (
                // The list could not be read (or the bond is not live yet):
                // your animals are still all in the Collection.
                <div className="-mx-4 border-y border-white/[0.08] px-4 py-6 md:mx-0 md:px-5">
                    <Link
                        href="/app/collection"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                        <AppIcon name="collection" /> Collection
                    </Link>
                </div>
            ) : rows.length === 0 ? (
                <div className="-mx-4 flex flex-col items-start gap-4 border-y border-white/[0.08] px-4 py-8 md:mx-0 md:px-5">
                    <p className="text-base font-semibold text-white">{COMPANIONS_COPY.empty}</p>
                    <Link
                        href="/app/capture"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300"
                    >
                        <AppIcon name="camera" /> {COMPANIONS_COPY.capture}
                    </Link>
                </div>
            ) : (
                <div className="-mx-4 border-t border-white/[0.08] md:mx-0">
                    {rows.map((row) => <CompanionRow key={row.speciesProfileId} row={row} />)}
                </div>
            )}
        </AppPage>
    );
}
