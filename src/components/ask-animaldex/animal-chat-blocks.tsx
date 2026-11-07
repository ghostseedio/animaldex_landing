"use client";

/**
 * A reply's own pictures (the owner, 2026-11-07: "Messages seem to be lacking
 * visuals like showing ideas using symbols and ascii or including the trial
 * motion animation and even including images"). Two drawings the model may
 * choose, each the reply's one drawing:
 *
 *   - `animaldex-loop`: one of the animal's own Trial loops, its kind doing
 *     the real act, inline (no button: the step card and the Trials stay the
 *     offers);
 *   - `animaldex-image`: a picture AnimalDex already has: the animal's Power
 *     icon, or the species art of an animal it compares itself with. Nothing
 *     is generated, and the chat's avatar stays the species icon; these sit
 *     inside a reply, in the panel the text diagrams use.
 *
 * Both need the chat's animal, which the model never names: the chat supplies
 * it as `AnimalChatBlockContext`. Without it, or with nothing to show, a block
 * draws nothing (no raw JSON, no empty frame).
 *
 * The web port of `AnimalChatBlocks.swift` (AnimalDex, 2026-11-07).
 */

import {createContext, useContext, useEffect, useMemo, useState} from "react";
import TrialMotion from "@/components/trial-motion/trial-motion";
import {useTrialMotionCaptionLanguage} from "@/components/trial-motion/use-trial-motion-storyboard";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";
import {useAnimalPowerIcon} from "@/components/animal-detail/animal-powers/use-animal-power-icon";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {ASK_DIAGRAM_PANEL_STYLE} from "@/components/ask-animaldex/assistant-markdown";
import {parseAnimalPowerIcon} from "@/lib/animal-power-icon";
import type {AnimalTrial} from "@/lib/animal-trials";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {askIsSpeciesArt, askSpeciesArtSlug, type AskImageSpec, type AskLoopSpec} from "@/lib/ask-animaldex/visuals";

/** What a reply's pictures may show of the animal in this chat: supplied by the chat, never by the model. */
export type AnimalChatBlockContextValue = {
    /** The animal this chat is with. */
    speciesProfileId: string | null;
    /** Its name, for the loop's label ("Luna's kind doing it"). */
    animalName: string;
    /**
     * Its Trials, when the chat has already read them ("{name}'s Trials").
     * Null or left out: a loop in a reply reads them itself, once a species
     * for the page (`/api/app/animal-trials`, as the chat reads them).
     */
    trials?: AnimalTrial[] | null;
    /**
     * Its Power's icon (the svg), when the chat already has it; null when it
     * has none. Left out: read by `speciesProfileId`, as `AnimalPowerIcon` does.
     */
    powerIconSvg?: string | null;
};

export const AnimalChatBlockContext = createContext<AnimalChatBlockContextValue | null>(null);

/** The loop's width cap: the reply column's width up to this, at 16:9. */
const LOOP_MAX_WIDTH = 360;
const STAGE_RADIUS = {borderRadius: "var(--r-panel)"} as const;

// MARK: - The Trials a loop is drawn from

/** Read Trials by species and caption language, kept for the page's lifetime; a failed read is not kept. */
const trialsRead = new Map<string, AnimalTrial[]>();
const trialsReading = new Map<string, Promise<AnimalTrial[] | null>>();

function trialsKey(speciesProfileId: string, lang: string | null) {
    return `${speciesProfileId.toLowerCase()}|${lang ?? "en"}`;
}

function readTrials(speciesProfileId: string, lang: string | null): Promise<AnimalTrial[] | null> {
    const key = trialsKey(speciesProfileId, lang);
    const known = trialsRead.get(key);
    if (known) return Promise.resolve(known);
    const reading = trialsReading.get(key);
    if (reading) return reading;
    const promise = fetch(`/api/app/animal-trials?speciesProfileId=${encodeURIComponent(speciesProfileId)}${lang ? `&lang=${lang}` : ""}`, {
        headers: {Accept: "application/json"}
    })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: {trials?: AnimalTrial[]} | null) => {
            const trials = payload?.trials && Array.isArray(payload.trials) ? payload.trials : null;
            if (trials) trialsRead.set(key, trials);
            return trials;
        })
        .catch(() => null)
        .finally(() => trialsReading.delete(key));
    trialsReading.set(key, promise);
    return promise;
}

/** The chat's Trials when it has them, else the ones this loop read (null until then). */
function useChatTrials(context: AnimalChatBlockContextValue | null): AnimalTrial[] | null {
    const lang = useTrialMotionCaptionLanguage();
    const given = context?.trials;
    const reads = Array.isArray(given) ? null : context?.speciesProfileId ?? null;
    const key = reads ? trialsKey(reads, lang) : null;
    const [read, setRead] = useState<AnimalTrial[] | null>(() => (key ? trialsRead.get(key) ?? null : null));

    useEffect(() => {
        if (!key || !reads) {
            setRead(null);
            return undefined;
        }
        const known = trialsRead.get(key);
        if (known) {
            setRead(known);
            return undefined;
        }
        let current = true;
        setRead(null);
        void readTrials(reads, lang).then((trials) => {
            if (current) setRead(trials);
        });
        return () => {
            current = false;
        };
    }, [key, reads, lang]);

    return Array.isArray(given) ? given : read;
}

// MARK: - The loop

/**
 * The animal's kind doing it: one of its Trial loops, the reply column's
 * width up to 360 px at 16:9, its caption under it. Reduce Motion is the
 * loop's own (`TrialMotion` holds its poster frame), as in the step card.
 */
export function AnimalChatLoopBlock({spec}: {spec: AskLoopSpec}) {
    const context = useContext(AnimalChatBlockContext);
    const trials = useChatTrials(context);
    const trial = trials?.find((entry) => entry.frequency === spec.frequency) ?? null;
    if (!context || !trial?.motionStoryboard) return null;

    const name = context.animalName.trim();
    const who = name ? `${name}'s kind doing it` : "Its kind doing it";
    const label = spec.caption ? `${who}: ${trial.title}. ${spec.caption}` : `${who}: ${trial.title}`;
    return (
        <div
            role="img"
            aria-label={label}
            className="flex w-full flex-col gap-2"
            style={ASK_DIAGRAM_PANEL_STYLE}
            data-testid={`chat-loop-${trial.frequency}`}
        >
            <div aria-hidden="true" className="w-full overflow-hidden" style={{...STAGE_RADIUS, maxWidth: LOOP_MAX_WIDTH}}>
                <TrialMotion storyboard={trial.motionStoryboard} captions={trial.motionCaptions ?? null} variant="stage" />
            </div>
            {spec.caption ? (
                <p aria-hidden="true" className="text-[11px] font-medium leading-4 text-ink-400">{spec.caption}</p>
            ) : null}
        </div>
    );
}

// MARK: - The image

/** The animal's Power icon or another species' art; anything else was never decoded. */
export function AnimalChatImageBlock({spec}: {spec: AskImageSpec}) {
    return spec.of === "power"
        ? <PowerImage caption={spec.caption} />
        : <SpeciesImage name={spec.name} caption={spec.caption} />;
}

/**
 * Its Power's icon at 64 px in the soft neon circle the Power-earned moment
 * uses, the caption beside it. No icon (yet, or ever): nothing, rather than
 * an empty circle.
 */
function PowerImage({caption}: {caption: string | null}) {
    const context = useContext(AnimalChatBlockContext);
    const given = context?.powerIconSvg;
    // Read by species only when the chat did not hand the svg down.
    const fetched = useAnimalPowerIcon(context && given === undefined ? context.speciesProfileId : null);
    const svg = given === undefined ? fetched : given;
    const shapes = useMemo(() => parseAnimalPowerIcon(svg), [svg]);
    if (!context || !shapes || !svg) return null;

    return (
        <div
            role="img"
            aria-label={caption ? `Its Power's icon. ${caption}` : "Its Power's icon"}
            className="flex w-full items-center gap-3.5"
            style={ASK_DIAGRAM_PANEL_STYLE}
            data-testid="chat-image-power"
        >
            <span
                aria-hidden="true"
                className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[1.5px] border-primary-400/55 bg-primary-400/[0.14] text-primary-300"
            >
                <AnimalPowerIcon svg={svg} size={34} gap={0} />
            </span>
            {caption ? (
                <p aria-hidden="true" className="min-w-0 text-[15px] font-semibold leading-[21px] text-ink-300">{caption}</p>
            ) : null}
        </div>
    );
}

/** Art proven to be a species' own (loaded, and not the route's stand-in), by slug, for the page's lifetime. */
const artChecked = new Map<string, boolean>();

/**
 * The species' art URL once it has loaded and is real art; null before, and
 * for a species the artwork route has nothing for. Loaded off screen first,
 * so a missing picture never shows as a frame or a stand-in.
 */
function useSpeciesArt(slug: string | null): string | null {
    const url = slug ? getSpeciesImageRoute(slug) : null;
    const [ok, setOk] = useState<boolean>(() => (slug ? artChecked.get(slug) === true : false));

    useEffect(() => {
        if (!slug || !url) {
            setOk(false);
            return undefined;
        }
        const known = artChecked.get(slug);
        if (known !== undefined) {
            setOk(known);
            return undefined;
        }
        let current = true;
        setOk(false);
        const probe = new window.Image();
        probe.onload = () => {
            const isArt = askIsSpeciesArt(probe.naturalWidth, probe.naturalHeight);
            artChecked.set(slug, isArt);
            if (current) setOk(isArt);
        };
        // A failed load is not remembered, so the next reply can try again.
        probe.onerror = () => undefined;
        probe.src = url;
        return () => {
            current = false;
        };
    }, [slug, url]);

    return ok ? url : null;
}

/**
 * Another animal's species art at 72 px, the art the chat's avatars use, its
 * name under it in micro text and the caption beside it.
 */
function SpeciesImage({name, caption}: {name: string; caption: string | null}) {
    const context = useContext(AnimalChatBlockContext);
    const art = useSpeciesArt(context ? askSpeciesArtSlug(name) : null);
    if (!context || !art) return null;

    return (
        <div
            role="img"
            aria-label={caption ? `${name}. ${caption}` : name}
            className="flex w-full items-center gap-3.5"
            style={ASK_DIAGRAM_PANEL_STYLE}
            data-testid="chat-image-species"
        >
            <div aria-hidden="true" className="flex w-24 shrink-0 flex-col items-center gap-1.5">
                <AskAnimalFace url={art} size={72} />
                <p className="line-clamp-2 w-full text-center text-[11px] font-medium leading-4 text-ink-300">{name}</p>
            </div>
            {caption ? (
                <p aria-hidden="true" className="min-w-0 text-[15px] font-semibold leading-[21px] text-ink-300">{caption}</p>
            ) : null}
        </div>
    );
}
