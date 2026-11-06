"use client";

import {useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import AnimalDetailTabBar, {type AnimalDetailTab} from "@/components/animal-detail/animal-detail-tab-bar";
import AnimalStoryCard from "@/components/animal-detail/animal-story-card";
import AnimalStatsPanel from "@/components/animal-detail/animal-stats-panel";
import AnimalPowerBand from "@/components/animal-detail/animal-powers/animal-power-band";
import {useAnimalPower} from "@/components/animal-detail/animal-powers/use-animal-power";
import {AppearsInBinders} from "@/components/animal-detail/capture-card-bands";
import SystemDynamicsSection from "@/components/animal-detail/system-dynamics/system-dynamics-section";
import type {SpeciesBinderLink} from "@/data/collection-binder-types";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import type {EnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import type {SpeciesStats} from "@/lib/battle-tier";
import {speciesTakesAn} from "@/lib/collection-states";
import {fillCaptureWords, type CaptureWords} from "@/lib/capture-words";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

export type SpeciesViewWords = {
    collection: string;
    breedProfile: string;
    domesticParent: string;
    joiningCatalog: string;
    talkToItNow: string;
    /** "{species}" */
    findToCaptureA: string;
    findToCaptureAn: string;
    findToMeetA: string;
    findToMeetAn: string;
    capture: string;
    talkToIt: string;
    latestCapture: string;
    openCaptureCard: string;
    about: string;
    stats: string;
};

const NEON = "#A7F432";

function relativeTime(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1]];
    const [unit, divisor] = units.find(([, size]) => Math.abs(seconds) >= size) ?? units[units.length - 1];
    return new Intl.RelativeTimeFormat(undefined, {numeric: "auto"}).format(Math.round(seconds / divisor), unit);
}

/** Found: its icon art. Not yet: its silhouette, never someone else's photo (iOS IOS-21). */
function SpeciesThumbnail({slug, discovered, size}: {slug: string; discovered: boolean; size: number}) {
    if (discovered) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={getSpeciesImageRoute(slug)} alt="" width={size} height={size} className="shrink-0 object-contain" style={{width: size, height: size}} />;
    }
    const url = `url(${getSpeciesArtworkRoute(slug)})`;
    return (
        <span
            aria-hidden="true"
            className="block shrink-0 bg-white/[0.18]"
            style={{width: size, height: size, maskImage: url, WebkitMaskImage: url, maskPosition: "center", WebkitMaskPosition: "center", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskSize: "contain", WebkitMaskSize: "contain"}}
        />
    );
}

export default function SpeciesViewClient({
    slug,
    name,
    scientificName,
    speciesProfileId,
    animalDexNumber,
    identityKind,
    story,
    powerProfile,
    stats,
    binders,
    latest,
    captureWords,
    words
}: {
    slug: string;
    name: string;
    scientificName: string | null;
    speciesProfileId: string | null;
    animalDexNumber: number | null;
    identityKind: string | null;
    story: string | null;
    powerProfile: EnhancedAnimalPowerProfile | null;
    stats: SpeciesStats | null;
    binders: SpeciesBinderLink[];
    /** The account's newest capture of this species; null when not caught yet. */
    latest: {captureId: string; animalName: string; capturedAt: string | null} | null;
    captureWords: CaptureWords;
    words: SpeciesViewWords;
}) {
    const [tab, setTab] = useState<AnimalDetailTab>("about");
    const animalPower = useAnimalPower(speciesProfileId);
    const discovered = latest !== null;
    const badge = animalDexNumber != null
        ? `#${String(animalDexNumber).padStart(3, "0")}`
        : identityKind === "breed" ? words.breedProfile : identityKind === "domestic_parent" ? words.domesticParent : words.joiningCatalog;
    const an = speciesTakesAn(name);
    const latestWhen = useMemo(() => relativeTime(latest?.capturedAt ?? null), [latest?.capturedAt]);

    const captureButton = (primary: boolean) => (
        <Link
            href="/app/capture"
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-[18px] text-[15px] font-black ${primary ? "bg-primary-400 text-black/90" : "border border-primary-400/60 text-primary-400"}`}
            data-testid="species-capture"
        >
            <AppIcon name="camera" className="h-4 w-4" />
            {words.capture}
        </Link>
    );

    return (
        <div className="mx-auto w-full max-w-3xl pb-12 font-sans">
            <div className="mb-4 flex items-center justify-between gap-3">
                <Link href="/app/collection" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm font-bold text-primary-200">
                    <AppIcon name="back" className="h-4 w-4" />
                    {words.collection}
                </Link>
                {discovered && latest ? (
                    // Talk to it, for an animal the account holds: its chat.
                    <Link href={`/app/capture/${encodeURIComponent(latest.captureId)}?talk=1`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-4 text-sm font-black text-black">
                        {words.talkToIt}
                    </Link>
                ) : null}
            </div>

            <section className="overflow-hidden border border-white/[0.08] bg-[#090909]">
                {/* The hero band: the number or what kind of entry it is, the name, the art. */}
                <div className="flex items-start gap-[18px] border-b border-white/[0.08] bg-[linear-gradient(135deg,#141414,rgba(148,84,250,0.12))] px-5 py-[22px]">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <span
                            className="w-fit rounded-full px-3 py-2 text-xs font-semibold"
                            style={{color: discovered ? NEON : "rgb(255 255 255 / 0.62)", backgroundColor: discovered ? "rgba(167,244,50,0.12)" : "rgba(255,255,255,0.08)"}}
                        >
                            {badge}
                        </span>
                        <h1 className="break-words font-display text-4xl font-bold text-white">{name}</h1>
                        {scientificName ? <p className="text-base italic text-white/60">{scientificName}</p> : null}
                    </div>
                    <SpeciesThumbnail slug={slug} discovered={discovered} size={112} />
                </div>

                {/* Not caught yet (iOS JRN-16): talk to it now, and the way to make it yours. */}
                {!discovered ? (
                    powerProfile ? (
                        <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-3.5" data-testid="species-uncaught">
                            <Link href={`/talk/${encodeURIComponent(slug)}`} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-400 text-base font-black text-black/90" data-testid="species-talk-now">
                                {words.talkToItNow}
                            </Link>
                            <div className="flex items-center gap-3">
                                <p className="min-w-0 flex-1 text-[15px] leading-6 text-white/60">{fillCaptureWords(an ? words.findToCaptureAn : words.findToCaptureA, {species: name})}</p>
                                {captureButton(false)}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3.5 border-b border-white/[0.08] px-5 py-3.5" data-testid="species-uncaught">
                            <p className="min-w-0 flex-1 text-[15px] font-semibold leading-6 text-white">{fillCaptureWords(an ? words.findToMeetAn : words.findToMeetA, {species: name})}</p>
                            {captureButton(true)}
                        </div>
                    )
                ) : null}

                <div className="px-5 pt-5">
                    <AnimalDetailTabBar value={tab} onChange={setTab} tabs={["about", "battle"]} labels={{about: words.about, bond: words.about, battle: words.stats}} />
                </div>

                <div role="tabpanel" aria-label={words.about} hidden={tab !== "about"} className={tab === "about" ? "mt-5 px-5 pb-5" : "hidden"}>
                    {powerProfile ? (
                        <div className="-mx-5">
                            <AnimalPowerBand profile={powerProfile} power={animalPower.power} speciesProfileId={speciesProfileId} words={captureWords.card} />
                        </div>
                    ) : null}
                    <div className="-mx-5">
                        <AnimalStoryCard contentKey={`species:${slug}`} story={story} principle={null} settingTag={null} />
                    </div>
                    <div className="mt-5">
                        <SystemDynamicsSection speciesProfileId={speciesProfileId} animalName={name} defersHeadlineToAnimalPower={Boolean(powerProfile)} />
                    </div>
                    {binders.length ? (
                        <div className="-mx-5 mt-5 border-t border-white/[0.08]">
                            <AppearsInBinders binders={binders} words={captureWords.card} />
                        </div>
                    ) : null}
                </div>

                <div role="tabpanel" aria-label={words.stats} hidden={tab !== "battle"} className={tab === "battle" ? "mt-5 px-5 pb-5" : "hidden"}>
                    {stats ? (
                        <AnimalStatsPanel speciesName={name} speciesSlug={slug} baseStats={stats} words={captureWords.stats} />
                    ) : null}
                    {latest ? (
                        // iOS `latestCaptureCard`: your latest capture of it.
                        <div className="-mx-5 mt-5 flex items-center gap-3 border-y border-white/[0.08] px-5 py-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-white/45">{words.latestCapture}</p>
                                <p className="truncate text-base font-bold text-white">{latest.animalName}</p>
                                {latestWhen ? <p className="text-xs text-white/50">{latestWhen}</p> : null}
                            </div>
                            <Link href={`/app/capture/${encodeURIComponent(latest.captureId)}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-black text-primary-400">
                                {words.openCaptureCard}
                                <AppIcon name="chevron" className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
