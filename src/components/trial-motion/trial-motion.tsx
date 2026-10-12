"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import vocabulary from "@/lib/trial-motion/vocabulary.json";
import type {TrialMotionScene} from "@/lib/trial-motion/engine";
import {loadTrialMotionRuntime} from "@/lib/trial-motion/runtime";
import {registerTrialLoop} from "@/lib/trial-motion/scheduler";
import {
    parseTrialStoryboard,
    trialMotionAccessibilityLabel,
    trialMotionBeatIndexAt,
    trialMotionCaptions,
    trialMotionPosterTime,
    type TrialStoryboard
} from "@/lib/trial-motion/storyboard";

/**
 * A Trial Loop: the short looping drawing of what a Trial asks you to do,
 * painted from the Trial's storyboard (spec: `AnimalDex/docs/trial-motion`).
 *
 * The 16:9 stage is reserved from the first paint. A server component can pass
 * `posterMarkup` (from `trial-motion/poster-server`) so the finished-state frame
 * is in the HTML; otherwise the poster paints as soon as the runtime chunk
 * arrives, which happens only when the stage nears the viewport.
 *
 * It animates only while on screen, while the tab is visible, and when it is
 * one of the two most visible loops on the page. With Reduce Motion it stays on
 * the poster frame. No storyboard: renders nothing, so the Trial reads exactly
 * as it did before.
 *
 * `full` puts the numbered caption steps under the stage, the active one lit.
 * `compact` (cards) is the stage with "STEP n OF m" and the active caption
 * beside it, stacked under it when the row is narrow.
 */

/** Lime as text steps down to a readable green on the light theme; as a fill it stays lime. */
const NEON_TEXT = "rgb(var(--c-primary-text-400))";
const NEON_FILL = "rgb(var(--c-primary-400))";
const C = vocabulary.colors;
const STAGE_BACKGROUND = `radial-gradient(120% 90% at 50% 100%, ${C.stageBottom} 0%, ${C.stageMid} 60%, ${C.stageTop} 100%)`;

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    return reduced;
}

export default function TrialMotion({
    storyboard,
    variant = "full",
    posterMarkup = null,
    freezeAt = null,
    compactLayout = "auto",
    className = ""
}: {
    /** The raw `motion_storyboard` value, or one already parsed. Null renders nothing. */
    storyboard: TrialStoryboard | unknown;
    variant?: "full" | "compact";
    /** Server-rendered poster frame (inner SVG markup). */
    posterMarkup?: string | null;
    /** Draw this one frame (seconds) and never animate: stills and visual QA. */
    freezeAt?: number | null;
    /**
     * Compact only. `auto` stacks the step under the stage when the row is under
     * 360px; `row` always keeps it beside (a fixed-height card with no room to stack).
     */
    compactLayout?: "auto" | "row";
    className?: string;
}) {
    const parsed = useMemo(() => parseTrialStoryboard(storyboard), [storyboard]);
    if (!parsed) return null;
    return <TrialMotionStage storyboard={parsed} variant={variant} posterMarkup={posterMarkup} freezeAt={freezeAt} compactLayout={compactLayout} className={className} />;
}

function TrialMotionStage({
    storyboard,
    variant,
    posterMarkup,
    freezeAt,
    compactLayout,
    className
}: {
    storyboard: TrialStoryboard;
    variant: "full" | "compact";
    posterMarkup: string | null;
    freezeAt: number | null;
    compactLayout: "auto" | "row";
    className: string;
}) {
    const captions = useMemo(() => trialMotionCaptions(storyboard), [storyboard]);
    const label = useMemo(() => trialMotionAccessibilityLabel(captions), [captions]);
    const poster = trialMotionPosterTime(storyboard);
    const [activeBeat, setActiveBeat] = useState(() => trialMotionBeatIndexAt(storyboard, poster));
    const [scene, setScene] = useState<TrialMotionScene | null>(null);
    const [isNear, setIsNear] = useState(false);
    const [mayRun, setMayRun] = useState(false);
    const prefersReducedMotion = usePrefersReducedMotion();
    const frozen = freezeAt != null;
    // A frozen stage behaves like Reduce Motion, on its own frame.
    const reducedMotion = prefersReducedMotion || frozen;
    const stageRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    /** Where the loop is, kept across pauses so it resumes rather than restarts. */
    const clockRef = useRef(poster);

    // Fetch the runtime only once the stage is close to the viewport.
    useEffect(() => {
        const element = stageRef.current;
        if (!element) return undefined;
        if (typeof IntersectionObserver === "undefined") {
            setIsNear(true);
            return undefined;
        }
        const observer = new IntersectionObserver((records) => {
            if (records.some((record) => record.isIntersecting)) {
                setIsNear(true);
                observer.disconnect();
            }
        }, {rootMargin: "300px 0px"});
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Build the live stage, painted at the poster frame.
    useEffect(() => {
        if (!isNear) return undefined;
        let cancelled = false;
        loadTrialMotionRuntime()
            .then(({engine, glyphs}) => {
                const svg = svgRef.current;
                if (cancelled || !svg) return;
                while (svg.firstChild) svg.removeChild(svg.firstChild);
                try {
                    const built = engine.createTrialMotionScene(engine.domMotionDoc, svg, storyboard, vocabulary, glyphs);
                    clockRef.current = built.poster;
                    setScene(built);
                } catch {
                    // A storyboard the parser let through but the renderer cannot
                    // draw keeps the server poster, or the empty stage.
                    while (svg.firstChild) svg.removeChild(svg.firstChild);
                }
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [isNear, storyboard]);

    // Page-wide: on screen, tab visible, and one of the two most visible loops.
    useEffect(() => {
        const element = stageRef.current;
        if (!element || !scene || reducedMotion) return undefined;
        return registerTrialLoop(element, setMayRun);
    }, [reducedMotion, scene]);

    // Reduce Motion: the poster, and its caption, only.
    useEffect(() => {
        if (!scene || !reducedMotion) return;
        const still = freezeAt ?? scene.poster;
        clockRef.current = still;
        scene.draw(still);
        setActiveBeat(scene.beatIndexAt(still));
    }, [freezeAt, reducedMotion, scene]);

    useEffect(() => {
        if (!scene || !mayRun || reducedMotion) return undefined;
        let frame = 0;
        let previous: number | null = null;
        let beat = -1;
        const tick = (now: number) => {
            if (previous != null) clockRef.current = (clockRef.current + (now - previous) / 1000) % scene.loop;
            previous = now;
            scene.draw(clockRef.current);
            const next = scene.beatIndexAt(clockRef.current);
            if (next !== beat) {
                beat = next;
                setActiveBeat(next);
            }
            frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, [mayRun, reducedMotion, scene]);

    const viewBox = `0 0 ${vocabulary.stage.width} ${vocabulary.stage.height}`;

    const stage = (
        <div
            ref={stageRef}
            role="img"
            aria-label={label}
            className="relative w-full overflow-hidden"
            style={{aspectRatio: "16 / 9", background: STAGE_BACKGROUND}}
        >
            {posterMarkup && !scene ? (
                <svg
                    aria-hidden="true"
                    viewBox={viewBox}
                    className="absolute inset-0 h-full w-full"
                    dangerouslySetInnerHTML={{__html: posterMarkup}}
                />
            ) : null}
            <svg ref={svgRef} aria-hidden="true" viewBox={viewBox} className="absolute inset-0 h-full w-full" />
        </div>
    );

    if (variant === "compact") {
        // The stage with the active step beside it (Android `TrialMotionStyle.Compact`).
        // The row is a size container: under 360px of row it stacks the step under
        // the stage. The step is visible text only; the stage's label already reads
        // every caption, so it is hidden from assistive tech. It renders on the
        // server at the poster's step, so nothing shifts when the loop starts.
        return (
            <figure className={`w-full [container-type:inline-size] ${className}`}>
                <div
                    className={compactLayout === "row"
                        ? "flex flex-row items-center gap-3"
                        : "flex flex-col gap-2.5 [@container(min-width:360px)]:flex-row [@container(min-width:360px)]:items-center [@container(min-width:360px)]:gap-3"}
                >
                    <div className={compactLayout === "row" ? "w-[55%] max-w-[420px] shrink-0" : "w-full max-w-[420px] shrink-0 [@container(min-width:360px)]:w-[55%]"}>{stage}</div>
                    <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] tabular-nums" style={{color: "rgb(var(--c-white) / 0.45)"}}>
                            Step {activeBeat + 1} of {captions.length}
                        </p>
                        <p className="line-clamp-3 text-[13px] font-semibold leading-[18px] text-white">{captions[activeBeat]}</p>
                    </div>
                </div>
            </figure>
        );
    }

    return (
        // Capped so a wide sheet never blows the figure up or pushes the steps
        // below the fold; left-aligned with the content, 100% width under the cap.
        <figure className={`flex w-full max-w-[560px] flex-col ${className}`}>
            {stage}
            <ol aria-hidden="true" className="mt-3 flex flex-col gap-1.5">
                {captions.map((caption, index) => {
                    const active = index === activeBeat;
                    return (
                        <li key={`${index}-${caption}`} className="flex items-start gap-2.5">
                            <span
                                className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[10px] font-black tabular-nums transition-colors duration-300"
                                style={active
                                    ? {backgroundColor: NEON_FILL, color: C.dark}
                                    : {backgroundColor: "rgb(var(--c-white) / 0.08)", color: "rgb(var(--c-white) / 0.45)"}}
                            >
                                {index + 1}
                            </span>
                            <span
                                className="text-sm leading-5 transition-colors duration-300"
                                style={{color: active ? NEON_TEXT : "rgb(var(--c-white) / 0.5)", fontWeight: active ? 700 : 500}}
                            >
                                {caption}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </figure>
    );
}
