"use client";

import {useState} from "react";
import SpeciesRadarStats from "@/app/[locale]/(composited)/animals/[slug]/species-radar-stats";
import {CaptureGradeExplanationSheet} from "@/app/[locale]/(authenticated)/app/_components/capture-grade-badge";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import {SIZE_SCALE_ANCHORS} from "@/data/size-scale-anchors";
import {type SpeciesStats} from "@/lib/battle-tier";
import {MAX_ANIMAL_LEVEL_XP, animalLevel, xpForAnimalLevel} from "@/lib/animal-level";
import type {CaptureGradeBreakdown} from "@/lib/capture-grade";
import {CAPTURE_WORDS_EN, fillCaptureWords, type CaptureWords} from "@/lib/capture-words";
import {statsClassificationChips, type StatsChip} from "@/lib/capture-card-chips";

/**
 * The Stats tab (iOS `ScanResultMediaScopedStatsBlock` and
 * `AnimalDexSizeScaleCard`): one row of facts in one outlined chip style
 * (GRADE with its breakdown, the setting, conservation, rarity) and no battle
 * tier letter (JRN-8, IOS-22); the bond's level on your own card; the stats
 * as one flush band; the size scale with every part on its own row (IOS-02).
 */

type StatsWords = CaptureWords["stats"];

const NEON = "#A7F432";

function levelPresentation(totalXP: number) {
    const xp = Math.max(0, Math.round(totalXP));
    const level = animalLevel(xp);
    const currentThreshold = xpForAnimalLevel(level);
    const nextThreshold = level >= 100 ? MAX_ANIMAL_LEVEL_XP : xpForAnimalLevel(level + 1);
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

/** iOS `AnimalDexInfoChip`: an outlined capsule, the value tinted only where it carries meaning. */
function InfoChip({chip, onClick, hint}: {chip: StatsChip; onClick?: () => void; hint?: string}) {
    const body = (
        <>
            {chip.label ? <span className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-white/[0.62]">{chip.label}</span> : null}
            <span className="text-xs font-extrabold uppercase tabular-nums" style={{color: chip.tint ?? "#FFFFFF"}}>{chip.value}</span>
            {chip.showsInfo ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white/[0.62]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" strokeLinecap="round" /><circle cx="12" cy="8" r=".7" fill="currentColor" /></svg>
            ) : null}
        </>
    );
    const className = "inline-flex min-h-[30px] shrink-0 items-center gap-[5px] rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5";
    return onClick ? (
        <button type="button" onClick={onClick} title={hint} className={`${className} transition hover:bg-white/[0.08]`}>{body}</button>
    ) : (
        <span className={className}>{body}</span>
    );
}

function ClassificationChips({
    chips,
    gradeBreakdown,
    settingIntro,
    words
}: {
    chips: StatsChip[];
    gradeBreakdown?: CaptureGradeBreakdown | null;
    settingIntro: string | null;
    words: StatsWords;
}) {
    const [showsGrade, setShowsGrade] = useState(false);
    const [showsSetting, setShowsSetting] = useState(false);
    const settingChip = chips.find((chip) => chip.kind === "setting") ?? null;

    return (
        <>
            <div className="flex flex-wrap gap-2" aria-label="Capture classification">
                {chips.map((chip) => (
                    <InfoChip
                        key={chip.kind}
                        chip={chip}
                        hint={chip.kind === "grade" ? words.gradeHint : undefined}
                        onClick={chip.kind === "grade" && gradeBreakdown
                            ? () => setShowsGrade(true)
                            : chip.kind === "setting" && settingIntro
                                ? () => setShowsSetting(true)
                                : undefined}
                    />
                ))}
            </div>
            {showsGrade && gradeBreakdown ? <CaptureGradeExplanationSheet breakdown={gradeBreakdown} onClose={() => setShowsGrade(false)} /> : null}
            {showsSetting && settingChip && settingIntro ? (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#090909]/75 p-4" role="dialog" aria-modal="true" aria-label={fillCaptureWords(words.whyItSays, {setting: settingChip.value})}>
                    <button type="button" aria-label={words.done} className="absolute inset-0" onClick={() => setShowsSetting(false)} />
                    <div className="relative z-10 w-full max-w-sm border border-white/10 bg-[#1f1f1f] light:bg-surface-900 p-5">
                        <h3 className="text-[17px] font-semibold text-white">{fillCaptureWords(words.whyItSays, {setting: settingChip.title})}</h3>
                        <p className="mt-3 text-[15px] font-medium leading-6 text-white/[0.62]">{settingIntro}</p>
                        <button type="button" onClick={() => setShowsSetting(false)} className="mt-5 w-full rounded-full bg-primary-400 px-4 py-3 text-xs font-bold text-black">{words.done}</button>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function LevelProgress({totalXP, recentSource, wide = false, words}: {totalXP: number; recentSource?: string | null; wide?: boolean; words: StatsWords}) {
    const progress = levelPresentation(totalXP);
    return (
        <div className={`space-y-2.5 px-4 py-3.5 ${wide ? "lg:px-0 lg:py-0" : ""}`}>
            <div className="flex items-baseline gap-2.5">
                <span className="rounded-full border border-primary-400/[0.24] bg-primary-400/[0.12] px-[9px] py-1.5 text-[11px] font-extrabold text-primary-400/95">{progress.level === 100 ? words.levelMax : fillCaptureWords(words.level, {n: progress.level})}</span>
                <span className="text-xs font-medium text-white">{fillCaptureWords(words.xp, {n: progress.xp})}</span>
                <span className="ml-auto text-[11px] font-semibold text-white/[0.42]">{progress.level === 100 ? words.max : fillCaptureWords(words.xpToNext, {n: progress.needed})}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-primary-400/[0.82]" style={{width: `${progress.fraction * 100}%`}} /></div>
            {progress.level < 100 ? <p className="text-[11px] font-semibold text-white/[0.62]">{fillCaptureWords(words.xpToward, {progress: progress.progressXP, span: progress.span, next: progress.level + 1})}</p> : null}
            {recentSource ? <p className="text-[11px] font-semibold text-primary-400/90">{recentSource}</p> : null}
        </div>
    );
}

/**
 * Your own card: the bond's level, the one every card of this animal shows
 * (iOS `bondLevelRow`), with "Your bond" opening the Bond tab.
 */
function BondLevel({chip, onOpen, wide = false, words}: {chip: string; onOpen?: (() => void) | null; wide?: boolean; words: StatsWords}) {
    const body = (
        <>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke={NEON} strokeWidth="2.6" strokeLinecap="round"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>
            <span className="text-xs font-semibold text-white">{chip}</span>
            {onOpen ? (
                <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-white/[0.42]">
                    {words.yourBond}
                    <span aria-hidden="true" className="text-[11px] font-bold">›</span>
                </span>
            ) : null}
        </>
    );
    const className = `flex w-full items-center gap-2 px-4 py-3.5 text-left ${wide ? "lg:px-0 lg:py-0" : ""}`;
    return onOpen ? <button type="button" onClick={onOpen} className={`${className} transition hover:bg-white/[0.03]`}>{body}</button> : <div className={className}>{body}</div>;
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

/** The ruler's rows, top to bottom (iOS `AnimalDexBodyScaleRuler`): nothing drawn over anything else. */
const RULER_HEIGHT = 176;
const MARKER_CENTER_Y = 24;
const LINE_TOP = 48;
const TRACK_CENTER_Y = 100;
const ANCHOR_CENTER_Y = 146;
/** Half an anchor's width: the first and last sit whole inside the strip. */
const ANCHOR_INSET = 34;
const MARKER_INSET = 80;

function SizeScale({speciesName, speciesSlug, score, wide = false, words}: {speciesName: string; speciesSlug: string; score: number; wide?: boolean; words: StatsWords}) {
    const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
    return (
        <div className={`mt-5 border-t border-white/[0.09] pt-3.5 ${wide ? "lg:mt-0 lg:border-t-0 lg:pt-0" : ""}`}>
            <p className={`px-4 text-xs font-medium text-white/[0.42] ${wide ? "lg:px-0 lg:text-sm" : ""}`}>{words.sizeScale}</p>
            <div className={`mt-3.5 flex justify-end px-4 ${wide ? "lg:px-0" : ""}`}>
                <span className="rounded-full bg-primary-400/[0.14] px-3 py-2 text-[17px] font-extrabold tabular-nums text-primary-400">{clampedScore}/100</span>
            </div>
            <div className="mt-3.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{height: RULER_HEIGHT}}>
                <div className="relative min-w-[560px] border border-white/[0.07] light:bg-none light:bg-surface-800 bg-[linear-gradient(135deg,rgba(255,255,255,.04),rgba(24,24,24,.92),rgba(24,24,24,.92))]" style={{height: RULER_HEIGHT}}>
                    {/* The track; the anchors below already say tiny to giant. */}
                    <div className="absolute left-[18px] right-[18px] -translate-y-1/2" style={{top: TRACK_CENTER_Y}}>
                        <div className="relative h-2.5 rounded-full bg-[linear-gradient(to_right,rgba(255,255,255,.10),rgba(255,255,255,.14),rgba(167,244,50,.12))]">
                            <div className="absolute inset-x-2 top-2 flex items-start justify-between">
                                {Array.from({length: 21}, (_, index) => <span key={index} className={`w-px bg-white ${index % 5 === 0 ? "h-4 opacity-[.18]" : "h-2.5 opacity-[.08]"}`} />)}
                            </div>
                        </div>
                    </div>

                    {SIZE_SCALE_ANCHORS.map((anchor) => (
                        <div
                            key={anchor.slug}
                            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
                            style={{width: ANCHOR_INSET * 2, top: ANCHOR_CENTER_Y, left: `clamp(${ANCHOR_INSET}px, ${anchor.position}%, calc(100% - ${ANCHOR_INSET}px))`}}
                        >
                            <Artwork slug={anchor.slug} label={anchor.label} size={34} />
                            <span className="max-w-full truncate text-[9px] font-bold text-white/[0.62]">{anchor.label}</span>
                        </div>
                    ))}

                    {/* The animal and its score side by side, so the line down never runs through the score. */}
                    <div
                        className="absolute flex max-w-[160px] -translate-x-1/2 -translate-y-1/2 items-center gap-2"
                        style={{top: MARKER_CENTER_Y, left: `clamp(${MARKER_INSET}px, ${clampedScore}%, calc(100% - ${MARKER_INSET}px))`}}
                    >
                        <Artwork slug={speciesSlug} label={speciesName} size={30} />
                        <span className="flex min-w-0 flex-col">
                            <span className="truncate text-xs font-bold text-white">{speciesName}</span>
                            <span className="text-[10px] font-semibold tabular-nums text-white/[0.62]">{fillCaptureWords(words.scaleScore, {n: clampedScore})}</span>
                        </span>
                    </div>
                    <span className="absolute w-[3px] -translate-x-1/2 rounded-full bg-primary-400 shadow-[0_0_10px_rgba(167,244,50,.36)]" style={{left: `${clampedScore}%`, top: LINE_TOP, height: TRACK_CENTER_Y - LINE_TOP}} />
                    <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-400 shadow-[0_0_8px_rgba(167,244,50,.38)]" style={{left: `${clampedScore}%`, top: TRACK_CENTER_Y}} />
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
    gradeBreakdown = null,
    settingTag,
    humanContext = null,
    conservationTier,
    bondChip = null,
    onBondLevel = null,
    layout = "compact",
    words = CAPTURE_WORDS_EN.stats
}: {
    speciesName: string;
    speciesSlug: string;
    baseStats: SpeciesStats;
    effectiveStats?: SpeciesStats;
    totalProgressionXP?: number | null;
    recentProgressionSource?: string | null;
    captureGrade?: number | null;
    /** The photo grade's breakdown, opened from the GRADE chip. */
    gradeBreakdown?: CaptureGradeBreakdown | null;
    settingTag?: string | null;
    /** A free-ranging domestic animal tagged Wild reads "Free-ranging", uncoloured. */
    humanContext?: string | null;
    conservationTier?: string | null;
    /** Your own card: the bond's stage ("Working together") in place of the card's level. */
    bondChip?: string | null;
    /** Opens the Bond tab from the bond's line. */
    onBondLevel?: (() => void) | null;
    layout?: "compact" | "wide";
    words?: StatsWords;
}) {
    const wide = layout === "wide";
    const columnClass = wide
        ? "lg:flex lg:flex-col lg:gap-5 lg:  lg:border lg:border-white/[0.08] lg:bg-white/[0.02] lg:p-6"
        : "";
    const {chips, settingIntro} = statsClassificationChips({
        captureGrade: captureGrade ?? null,
        settingTag: settingTag ?? null,
        humanContext,
        conservationTier: conservationTier ?? null,
        rarity: baseStats.rarity,
        words
    });
    const statLabels: Record<keyof SpeciesStats, string> = {
        dominance: words.dominance,
        speed: words.speed,
        size: words.size,
        intelligence: words.intelligence,
        rarity: words.rarity
    };

    return (
        <section className={`-mx-5 font-sans ${wide ? "lg:mx-0 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-6" : ""}`}>
            <div className={columnClass}>
                {chips.length ? (
                    <div className={`px-4 pb-2 ${wide ? "lg:px-0 lg:pb-0" : ""}`}>
                        <ClassificationChips chips={chips} gradeBreakdown={gradeBreakdown} settingIntro={settingIntro} words={words} />
                    </div>
                ) : null}
                {bondChip
                    ? <BondLevel chip={bondChip} onOpen={onBondLevel} wide={wide} words={words} />
                    : totalProgressionXP != null ? <LevelProgress totalXP={totalProgressionXP} recentSource={recentProgressionSource} wide={wide} words={words} /> : null}
                {bondChip || totalProgressionXP != null ? <div className={`h-px bg-white/[0.09] ${wide ? "lg:hidden" : ""}`} /> : null}
                <div className={`py-3.5 ${wide ? "lg:py-0" : ""}`}>
                    <h2 className={`px-4 text-[22px] font-bold leading-[1.25] text-white ${wide ? "lg:px-0 lg:text-2xl" : ""}`}>{words.statsTitle}</h2>
                    <div className="mt-3">
                        <SpeciesRadarStats stats={effectiveStats} baseStats={baseStats} labels={statLabels} showsChartChrome={false} />
                    </div>
                </div>
            </div>
            <div className={columnClass}>
                <SizeScale speciesName={speciesName} speciesSlug={speciesSlug} score={baseStats.size} wide={wide} words={words} />
            </div>
        </section>
    );
}

