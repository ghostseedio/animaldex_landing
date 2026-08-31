"use client";

import {useState} from "react";
import SpeciesRadarStats from "@/app/[locale]/(composited)/animals/[slug]/species-radar-stats";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import {SIZE_SCALE_ANCHORS} from "@/data/size-scale-anchors";
import {getBattleTier, type AnimalBattleTier, type SpeciesStats} from "@/lib/battle-tier";

const STAT_LABELS: Record<keyof SpeciesStats, string> = {
    dominance: "Dominance",
    speed: "Speed",
    size: "Size",
    intelligence: "Intelligence",
    rarity: "Rarity"
};

const TIER_TINT: Record<AnimalBattleTier, string> = {
    S: "56,250,71",
    A: "56,250,71",
    B: "34,211,238",
    C: "255,255,255",
    D: "251,146,60",
    E: "248,113,113"
};

const SETTING_TINT: Record<string, string> = {
    zoo: "rgb(250 219 71)",
    wild: "#A7F432",
    domestic: "rgb(140 199 255)",
    farm: "rgb(209 166 89)"
};

const CONSERVATION: Record<string, {label: string; tint: string}> = {
    lc: {label: "Least Concern", tint: "#A7F432"},
    leastconcern: {label: "Least Concern", tint: "#A7F432"},
    nt: {label: "Near Threatened", tint: "rgb(250 219 56)"},
    nearthreatened: {label: "Near Threatened", tint: "rgb(250 219 56)"},
    vu: {label: "Vulnerable", tint: "rgb(250 158 51)"},
    vulnerable: {label: "Vulnerable", tint: "rgb(250 158 51)"},
    en: {label: "Endangered", tint: "rgb(250 89 71)"},
    endangered: {label: "Endangered", tint: "rgb(250 89 71)"},
    cr: {label: "Critically Endangered", tint: "rgb(191 46 242)"},
    criticallyendangered: {label: "Critically Endangered", tint: "rgb(191 46 242)"},
    ew: {label: "Extinct in the Wild", tint: "rgb(140 140 148)"},
    extinctinthewild: {label: "Extinct in the Wild", tint: "rgb(140 140 148)"},
    ex: {label: "Extinct", tint: "rgb(89 89 97)"},
    extinct: {label: "Extinct", tint: "rgb(89 89 97)"}
};

function normalize(value: string | null | undefined) {
    return value?.trim().toLowerCase().replace(/[^a-z]/g, "") ?? "";
}

function titleCase(value: string) {
    return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function levelPresentation(totalXP: number) {
    const xp = Math.max(0, Math.round(totalXP));
    const level = Math.min(100, Math.floor(Math.sqrt(xp)) + 1);
    const currentThreshold = (level - 1) ** 2;
    const nextThreshold = level >= 100 ? 9801 : level ** 2;
    const span = Math.max(1, nextThreshold - currentThreshold);
    const progressXP = level >= 100 ? 0 : Math.max(0, xp - currentThreshold);

    return {
        xp,
        level,
        span,
        progressXP,
        needed: level >= 100 ? 0 : Math.max(0, nextThreshold - xp),
        fraction: level >= 100 ? 1 : Math.min(1, Math.max(0, progressXP / span))
    };
}

function rarityPresentation(score: number) {
    if (score < 10) return {label: "Common", tint: "rgb(110 231 183)", lightText: false};
    if (score < 25) return {label: "Uncommon", tint: "rgb(110 231 183)", lightText: false};
    if (score < 45) return {label: "Rare", tint: "rgb(34 211 238)", lightText: false};
    if (score < 65) return {label: "Epic", tint: "rgb(251 146 60)", lightText: false};
    if (score < 90) return {label: "Legendary", tint: "#9454fa", lightText: true};
    return {label: "Mythic", tint: "rgb(235 82 56)", lightText: true};
}

function GradeChip({grade}: {grade: number}) {
    const tint = grade >= 9 ? "251,146,60" : grade >= 7 ? "34,211,238" : grade >= 5 ? "56,250,71" : grade >= 3 ? "255,255,255" : "248,113,113";
    return (
        <span className="inline-flex h-[31px] items-center gap-1.5 rounded-full border px-2.5" style={{background: `linear-gradient(rgba(${tint},.18),rgba(0,0,0,.36))`, borderColor: `rgba(${tint},.38)`}}>
            <span className="text-[9px] font-extrabold text-white/[0.72]">GRADE</span>
            <span className="text-[13px] font-extrabold tabular-nums text-white">{grade}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white/[0.72]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" strokeLinecap="round" /><circle cx="12" cy="8" r=".7" fill="currentColor" /></svg>
        </span>
    );
}

function TierChip({tier}: {tier: AnimalBattleTier}) {
    const tint = TIER_TINT[tier];
    return (
        <span className="inline-flex h-[31px] items-center gap-1.5 rounded-full border px-2.5" style={{background: `linear-gradient(rgba(${tint},.18),rgba(0,0,0,.36))`, borderColor: `rgba(${tint},.38)`}}>
            <span className="text-[9px] font-extrabold" style={{color: `rgba(${tint},.72)`}}>TIER</span>
            <span className="text-[13px] font-extrabold text-white">{tier}</span>
        </span>
    );
}

function ClassificationChips({settingTag, conservationTier, baseRarity}: {settingTag?: string | null; conservationTier?: string | null; baseRarity: number}) {
    const [showExplanation, setShowExplanation] = useState(false);
    const settingKey = normalize(settingTag);
    const settingTint = SETTING_TINT[settingKey];
    const conservation = CONSERVATION[normalize(conservationTier)];
    const rarity = rarityPresentation(baseRarity);
    const settingLabel = settingTag?.trim() ? titleCase(settingTag.trim()) : null;

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {settingTint && settingLabel ? (
                    <button
                        type="button"
                        onClick={() => setShowExplanation(true)}
                        className="rounded-full border border-black/[0.12] px-2.5 py-1.5 text-[11px] font-semibold uppercase leading-[14px] text-black/[0.88] shadow-[0_1px_0_rgba(0,0,0,.28)]"
                        style={{backgroundColor: settingTint}}
                    >
                        {settingLabel}
                    </button>
                ) : null}
                {conservation ? (
                    <span className="rounded-full border border-white/[0.18] px-3 py-2 text-[11px] font-semibold leading-[14px] text-white" style={{backgroundColor: conservation.tint}}>
                        {conservation.label}
                    </span>
                ) : null}
                <span className={`rounded-full border px-2.5 py-[7px] text-[11px] font-semibold uppercase leading-[14px] ${rarity.lightText ? "border-white/[0.18] text-white" : "border-black/[0.08] text-black/[0.88]"}`} style={{backgroundColor: rarity.tint}}>
                    {rarity.label}
                </span>
            </div>
            {showExplanation && settingLabel ? (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={`Why it says ${settingLabel}`}>
                    <button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setShowExplanation(false)} />
                    <div className="relative z-10 w-full max-w-sm rounded-[20px] border border-white/10 bg-[#1f1f1f] p-5">
                        <h3 className="text-[17px] font-semibold text-white">Why it says {settingLabel}</h3>
                        <p className="mt-3 text-[15px] font-medium leading-6 text-white/[0.62]">
                            AnimalDex uses the visible scene and habitat cues in the capture to classify its setting as {settingLabel}.
                        </p>
                        <button type="button" onClick={() => setShowExplanation(false)} className="mt-5 w-full rounded-full bg-[#A7F432] px-4 py-3 text-xs font-bold text-black">Done</button>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function LevelProgress({totalXP, recentSource, wide = false}: {totalXP: number; recentSource?: string | null; wide?: boolean}) {
    const progress = levelPresentation(totalXP);
    return (
        <div className={`space-y-2.5 px-4 py-3.5 ${wide ? "lg:px-0 lg:py-0" : ""}`}>
            <div className="flex items-baseline gap-2.5">
                <span className="rounded-full border border-[#A7F432]/[0.24] bg-[#A7F432]/[0.12] px-[9px] py-1.5 text-[11px] font-extrabold text-[#A7F432]/95">{progress.level === 100 ? "Lvl 100 MAX" : `Lvl ${progress.level}`}</span>
                <span className="text-xs font-medium text-white">{progress.xp} XP</span>
                <span className="ml-auto text-[11px] font-semibold text-white/[0.42]">{progress.level === 100 ? "MAX" : `${progress.needed} XP to next`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#A7F432]/[0.82]" style={{width: `${progress.fraction * 100}%`}} /></div>
            {progress.level < 100 ? <p className="text-[11px] font-semibold text-white/[0.62]">{progress.progressXP}/{progress.span} XP toward Level {progress.level + 1}</p> : null}
            {recentSource ? <p className="text-[11px] font-semibold text-[#A7F432]/90">{recentSource}</p> : null}
        </div>
    );
}

function Artwork({slug, label, size}: {slug: string; label: string; size: number}) {
    return (
        <span
            role="img"
            aria-label={label}
            className="block shrink-0 bg-[rgb(179,184,194)]"
            style={{
                width: size,
                height: size,
                maskImage: `url(${getSpeciesArtworkRoute(slug)})`,
                WebkitMaskImage: `url(${getSpeciesArtworkRoute(slug)})`,
                maskPosition: "center",
                WebkitMaskPosition: "center",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskSize: "contain",
                WebkitMaskSize: "contain"
            }}
        />
    );
}

function SizeScale({speciesName, speciesSlug, score, wide = false}: {speciesName: string; speciesSlug: string; score: number; wide?: boolean}) {
    const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
    return (
        <div className={`mt-5 border-t border-white/[0.09] pt-3.5 ${wide ? "lg:mt-0 lg:border-t-0 lg:pt-0" : ""}`}>
            <p className={`px-4 text-xs font-medium text-white/[0.42] ${wide ? "lg:px-0 lg:text-sm" : ""}`}>Size scale</p>
            <div className={`mt-3.5 flex justify-end px-4 ${wide ? "lg:px-0" : ""}`}>
                <span className="rounded-full bg-[linear-gradient(to_right,rgba(167,244,50,.18),rgba(148,84,250,.16))] px-3 py-2 text-lg font-extrabold text-[#A7F432]">{clampedScore}/100</span>
            </div>
            <div className="mt-3.5 h-40 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="relative h-[150px] min-w-[560px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(255,255,255,.04),rgba(18,18,18,.92),rgba(148,84,250,.08))]">
                    <div className="absolute left-[18px] right-[18px] top-[86px]">
                        <div className="relative h-2.5 rounded-full bg-[linear-gradient(to_right,rgba(255,255,255,.10),rgba(148,84,250,.16),rgba(167,244,50,.10))]">
                            <div className="absolute inset-x-2 top-2 flex items-start justify-between">
                                {Array.from({length: 21}, (_, index) => <span key={index} className={`w-px bg-white ${index % 5 === 0 ? "h-4 opacity-[.18]" : "h-2.5 opacity-[.08]"}`} />)}
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] font-bold uppercase text-white/[0.42]"><span>Tiny</span><span>Pet</span><span>Giant</span></div>
                    </div>

                    {SIZE_SCALE_ANCHORS.map((anchor) => (
                        <div key={anchor.slug} className="absolute top-[90px] flex w-[60px] -translate-x-1/2 flex-col items-center gap-1.5" style={{left: `${anchor.position}%`}}>
                            <Artwork slug={anchor.slug} label={anchor.label} size={34} />
                            <span className="truncate text-[9px] font-bold text-white/[0.62]">{anchor.label}</span>
                        </div>
                    ))}

                    <div className="absolute top-[9px] flex max-w-[150px] -translate-x-1/2 flex-col items-center gap-1.5" style={{left: `clamp(70px, ${clampedScore}%, calc(100% - 70px))`}}>
                        <div className="flex items-center gap-2">
                            <Artwork slug={speciesSlug} label={speciesName} size={30} />
                            <span className="max-w-[108px] truncate text-[11px] font-extrabold text-white">{speciesName}</span>
                        </div>
                        <span className="text-[9px] font-bold text-white/[0.62]">Scale {clampedScore}</span>
                    </div>
                    <span className="absolute top-[41px] h-[66px] w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#A7F432] to-[#9454fa] shadow-[0_0_10px_rgba(167,244,50,.36)]" style={{left: `${clampedScore}%`}} />
                    <span className="absolute top-[101px] h-3 w-3 -translate-x-1/2 rounded-full bg-[#A7F432] shadow-[0_0_8px_rgba(167,244,50,.38)]" style={{left: `${clampedScore}%`}} />
                </div>
            </div>
        </div>
    );
}

export default function AnimalStatsPanel({
    speciesName,
    speciesSlug,
    baseStats,
    effectiveStats = baseStats,
    totalProgressionXP,
    recentProgressionSource,
    captureGrade,
    settingTag,
    conservationTier,
    layout = "compact"
}: {
    speciesName: string;
    speciesSlug: string;
    baseStats: SpeciesStats;
    effectiveStats?: SpeciesStats;
    totalProgressionXP?: number | null;
    recentProgressionSource?: string | null;
    captureGrade?: number | null;
    settingTag?: string | null;
    conservationTier?: string | null;
    layout?: "compact" | "wide";
}) {
    const tier = getBattleTier(effectiveStats);
    const wide = layout === "wide";
    const columnClass = wide
        ? "lg:flex lg:flex-col lg:gap-5 lg:rounded-[22px] lg:border lg:border-white/[0.08] lg:bg-white/[0.02] lg:p-6"
        : "";

    return (
        <section className={`-mx-5 font-sans ${wide ? "lg:mx-0 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-6" : ""}`}>
            <div className={columnClass}>
                <div className={`space-y-3 px-4 pb-2 ${wide ? "lg:px-0 lg:pb-0" : ""}`}>
                    <div className="flex items-center gap-1.5"><TierChip tier={tier} />{captureGrade != null ? <GradeChip grade={captureGrade} /> : null}</div>
                    <ClassificationChips settingTag={settingTag} conservationTier={conservationTier} baseRarity={baseStats.rarity} />
                </div>
                {totalProgressionXP != null ? <LevelProgress totalXP={totalProgressionXP} recentSource={recentProgressionSource} wide={wide} /> : null}
                {totalProgressionXP != null ? <div className={`h-px bg-white/[0.09] ${wide ? "lg:hidden" : ""}`} /> : null}
                <div className={`py-3.5 ${wide ? "lg:py-0" : ""}`}>
                    <h2 className={`px-4 text-[22px] font-bold leading-[1.25] text-white ${wide ? "lg:px-0 lg:text-2xl" : ""}`}>AnimalDex stats</h2>
                    <div className="mt-3">
                        <SpeciesRadarStats stats={effectiveStats} baseStats={baseStats} labels={STAT_LABELS} showsChartChrome={false} />
                    </div>
                </div>
            </div>
            <div className={columnClass}>
                <SizeScale speciesName={speciesName} speciesSlug={speciesSlug} score={baseStats.size} wide={wide} />
            </div>
        </section>
    );
}
