"use client";

import Image from "next/image";
import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {useCompanions} from "@/components/companions/use-companions";
import {COMPANION_WORDS_EN, bondChipText, companionSummaryName, fillWords, type CompanionSummary, type CompanionWords} from "@/lib/companion-bond";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

/**
 * "My Companions" on your own profile (docs/companion-loop/SPEC.md, phase 4;
 * it was "My Animal Powers"): your animals with their level, and how many you
 * have mastered and whose Powers you have earned. Each opens its card.
 *
 * Someone with no companions yet sees nothing here: no empty scoreboard.
 */

const NEON = "#A7F432";

function Tile({row, words}: {row: CompanionSummary; words: CompanionWords}) {
    const [artFailed, setArtFailed] = useState(false);
    const body = (
        <>
            {row.slug && !artFailed ? (
                <span className="relative h-12 w-12 shrink-0">
                    <Image src={getSpeciesImageRoute(row.slug)} alt="" fill sizes="48px" unoptimized className="object-contain" onError={() => setArtFailed(true)} />
                </span>
            ) : <span aria-hidden="true" className="h-12 w-12" />}
            <p className="line-clamp-2 text-sm font-bold text-white">{companionSummaryName(row, words)}</p>
            <p className="mt-auto text-[10px] font-semibold text-white/55">{bondChipText(row, words)}</p>
            {row.mastered ? (
                <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{color: NEON}}>{words.list.mastered}</p>
            ) : null}
        </>
    );
    const className = "flex h-[150px] w-[150px] shrink-0 flex-col gap-1.5 border border-white/10 bg-white/[0.04] p-3";
    return row.captureId
        ? <Link href={`/app/capture/${encodeURIComponent(row.captureId)}?tab=bond`} className={`${className} transition hover:border-primary-400/30`}>{body}</Link>
        : <div className={className}>{body}</div>;
}

export default function MyCompanionsSection({words = COMPANION_WORDS_EN}: {words?: CompanionWords}) {
    const {rows} = useCompanions();
    if (!rows.length) return null;

    const mastered = rows.filter((row) => row.mastered).length;
    const powersEarned = rows.filter((row) => row.powerEarned).length;

    return (
        <section className="flex flex-col border-y border-white/[0.08] bg-white/[0.02] font-sans">
            <header className="flex items-center gap-2 px-[18px] py-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white">{words.list.myCompanions}</h2>
                <span className="ml-auto text-xs font-semibold text-white/55">
                    {fillWords(words.list.masteredCount, {n: mastered})}
                    {" · "}
                    {fillWords(words.list.powersEarned, {n: powersEarned})}
                </span>
            </header>
            <div className="flex gap-3 overflow-x-auto border-t border-white/[0.08] px-[18px] py-3.5">
                {rows.map((row) => <Tile key={row.speciesProfileId} row={row} words={words} />)}
            </div>
        </section>
    );
}
