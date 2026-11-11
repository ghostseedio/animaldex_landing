"use client";

/**
 * The shared Ark in the animal chat (Part 2, docs/ark-next.md): the line
 * under a live step card, and the arrival a step that worked brings.
 *
 * - `useArkStepOffer`: `/api/ark/step-offer` for this species, read when a
 *   step is live and again after an arrival.
 * - `useArkArrivals`: which replies that finished a worked step brought one
 *   of the reader's animals aboard (the public snapshot, read with their
 *   session, so theirs come back `mine`; the server sets `arrived_at` to the
 *   step's `done_at`). A step that worked while the chat is open is read
 *   again for a couple of minutes (the outbox applies arrivals once a
 *   minute); when it lands, the thread's line plays in, the Ark panel flies
 *   to it, and the arrival counts as seen.
 *
 * Nothing opens a window. Development: `?arkoffer=new|pair_complete|milestone`
 * draws the line without a session; `?arkarrival=1` reads the fixture Ark
 * and treats every worked step in the thread as having brought one
 * (`?arkarrival=fresh`: and plays them in, as if they had just landed).
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {emitArkArrival} from "@/lib/ark/arrival-bus";
import {decodeArkFounderStory, decodeArkStoryDraft, type ArkFounderStory, type ArkStoryDraft, type ArkStoryShareResult} from "@/lib/ark-founders";
import {noteArkArrivalsSeen} from "@/lib/ark-measure-client";
import {
    ARK_ARRIVAL_POLL_MS,
    arkMatchArrivals,
    arkWorkedFinishers,
    decodeArkStepOffer,
    type ArkStepOffer,
    type ArkStepOfferState
} from "@/lib/ark-world";

type Species = {speciesProfileId: string | null; slug: string | null; name: string | null};

function devParam(name: string): string | null {
    if (process.env.NODE_ENV !== "development") return null;
    try {
        return new URLSearchParams(window.location.search).get(name);
    } catch {
        return null;
    }
}

async function readOffer(species: Species): Promise<ArkStepOffer | null> {
    const query = new URLSearchParams();
    if (species.speciesProfileId) query.set("species", species.speciesProfileId);
    if (species.slug) query.set("slug", species.slug);
    if (species.name) query.set("name", species.name);
    try {
        const response = await fetch(`/api/ark/step-offer?${query}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {offer?: unknown};
        return decodeArkStepOffer(body.offer);
    } catch {
        return null;
    }
}

/** The line's state for this species while a step is live; null until it reads (or when it cannot). */
export function useArkStepOffer({enabled, species, refreshKey = 0}: {enabled: boolean; species: Species; refreshKey?: number}): ArkStepOffer | null {
    const [offer, setOffer] = useState<{key: string; value: ArkStepOffer | null} | null>(null);
    const key = `${species.speciesProfileId ?? ""}|${species.slug ?? ""}`;
    useEffect(() => {
        if (!enabled || (!species.speciesProfileId && !species.slug)) return;
        const fixture = devParam("arkoffer");
        if (fixture === "new" || fixture === "pair_complete" || fixture === "milestone") {
            const state = fixture as ArkStepOfferState;
            setOffer({key, value: {state, species: species.name ?? "Red Fox", livingBrought: state === "new" ? 0 : state === "pair_complete" ? 1 : 2, aboard: 3}});
            return;
        }
        let cancelled = false;
        void readOffer(species).then((value) => {
            if (!cancelled) setOffer({key, value});
        });
        return () => {
            cancelled = true;
        };
        // `species` is read through its key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, key, refreshKey]);
    return enabled && offer?.key === key ? offer.value : null;
}

async function readSnapshot(): Promise<ArkSnapshot | null> {
    if (devParam("arkarrival")) return decodeArkSnapshot((await import("@/ark-scene/fixtures/snapshot.json")).default);
    try {
        const response = await fetch("/api/ark/voyage", {cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {snapshot?: unknown};
        return decodeArkSnapshot(body.snapshot);
    } catch {
        return null;
    }
}

type Message = Parameters<typeof arkWorkedFinishers>[0][number];

/** Development's `?arkarrival=1`: the fixture's own animal of this kind, else its first, made the reader's and dated to the step. */
function fixtureArrivals(finishers: ReturnType<typeof arkWorkedFinishers>, snapshot: ArkSnapshot, species: Species): Map<string, ArkAnimal> {
    const base = snapshot.animals.find((animal) => animal.model_slug === species.slug) ?? snapshot.animals[0];
    const matched = new Map<string, ArkAnimal>();
    if (!base) return matched;
    finishers.forEach((finisher, index) => {
        matched.set(finisher.id, {...base, id: `${base.id.slice(0, -4)}${String(9000 + index)}`, name: species.name ?? base.name, model_slug: species.slug ?? base.model_slug, mine: true, arrived_at: finisher.createdAt});
    });
    return matched;
}

/** A step finished longer ago than this is never played in as new. */
const RECENT_MS = 15 * 60_000;

export type ArkThreadArrival = {animal: ArkAnimal; fresh: boolean};

/**
 * The arrivals under the replies that finished a worked step, by that
 * reply's id. `onArrived` runs once for each one that lands while the chat
 * is open (after the snapshot says so), e.g. to read the step line again.
 */
export function useArkArrivals({enabled, species, messages, onArrived}: {
    enabled: boolean;
    species: Species;
    messages: readonly Message[];
    onArrived?: (animal: ArkAnimal) => void;
}): Map<string, ArkThreadArrival> {
    const finishers = useMemo(() => (enabled ? arkWorkedFinishers(messages) : []), [enabled, messages]);
    const finisherKey = finishers.map((finisher) => finisher.id).join(",");
    const [found, setFound] = useState<Map<string, ArkAnimal>>(() => new Map());
    const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
    /** The finishers there when the thread first read: anything later finished while it was open. */
    const known = useRef<Set<string> | null>(null);
    const celebrated = useRef(new Set<string>());
    const onArrivedRef = useRef(onArrived);
    onArrivedRef.current = onArrived;
    const speciesRef = useRef(species);
    speciesRef.current = species;
    const finishersRef = useRef(finishers);
    finishersRef.current = finishers;

    const speciesKey = `${species.speciesProfileId ?? ""}|${species.slug ?? ""}`;
    // A new chat (another animal): start over.
    useEffect(() => {
        known.current = null;
        celebrated.current = new Set();
        setFound(new Map());
        setFresh(new Set());
    }, [speciesKey]);

    const read = useCallback(async () => {
        const current = finishersRef.current;
        if (current.length === 0) return;
        const snapshot = await readSnapshot();
        if (!snapshot) return;
        const matched = devParam("arkarrival") ? fixtureArrivals(current, snapshot, speciesRef.current) : arkMatchArrivals(current, snapshot.animals, speciesRef.current);
        setFound(matched);
        const landed: ArkAnimal[] = [];
        const devFresh = devParam("arkarrival") === "fresh";
        const recent = new Set(current.filter((finisher) => Date.now() - Date.parse(finisher.createdAt) < RECENT_MS).map((finisher) => finisher.id));
        matched.forEach((animal, finisherId) => {
            if (celebrated.current.has(finisherId)) return;
            // Only a step that worked while this chat was open, just now (an older one read late is shown, not played).
            if (!devFresh && (!known.current || known.current.has(finisherId) || !recent.has(finisherId))) return;
            celebrated.current.add(finisherId);
            landed.push(animal);
        });
        if (landed.length === 0) return;
        setFresh((current) => new Set([...Array.from(current), ...Array.from(matched.entries()).filter(([, animal]) => landed.includes(animal)).map(([id]) => id)]));
        noteArkArrivalsSeen(landed, "chat_panel");
        for (const animal of landed) {
            emitArkArrival({animal, slug: speciesRef.current.slug, speciesProfileId: speciesRef.current.speciesProfileId});
            onArrivedRef.current?.(animal);
        }
    }, []);

    useEffect(() => {
        if (!enabled || finishers.length === 0) {
            if (known.current === null && enabled && messages.length > 0) known.current = new Set();
            return;
        }
        if (known.current === null) {
            // The thread as it opened: these are shown, never celebrated.
            known.current = new Set(finishers.map((finisher) => finisher.id));
            void read();
            return;
        }
        const waiting = finishers.some((finisher) => !known.current?.has(finisher.id) && !celebrated.current.has(finisher.id));
        if (!waiting) return;
        // A step worked just now: the outbox brings it aboard within the minute.
        const timers = ARK_ARRIVAL_POLL_MS.map((delay) => window.setTimeout(() => void read(), delay));
        return () => timers.forEach((timer) => window.clearTimeout(timer));
        // The finishers are read through their key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, finisherKey, read]);

    return useMemo(() => {
        const arrivals = new Map<string, ArkThreadArrival>();
        found.forEach((animal, finisherId) => arrivals.set(finisherId, {animal, fresh: fresh.has(finisherId)}));
        return arrivals;
    }, [found, fresh]);
}

// MARK: - Founders: the share line under an arrival (founders contract, section 4)

export type ArkFounderSharePhase = "loading" | "hidden" | "collapsed" | "editing" | "shared" | "removed";

export type ArkFounderShareState = {
    phase: ArkFounderSharePhase;
    /** The editor's words: what they did (prefilled with the step) and the problem line (never prefilled). */
    step: string;
    problem: string;
    story: ArkFounderStory | null;
    busy: boolean;
    /** The last failure, said inline: other words (`not_public`), or try again. */
    error: "not_public" | "could_not_check" | null;
};

const NOT_NOW_KEY = "ark.founderShare.notNow.";

function rememberNotNow(animalId: string) {
    try {
        window.localStorage.setItem(`${NOT_NOW_KEY}${animalId}`, "1");
    } catch {
        // No storage (a private window): it asks again next time.
    }
}

function saidNotNow(animalId: string): boolean {
    try {
        return window.localStorage.getItem(`${NOT_NOW_KEY}${animalId}`) === "1";
    } catch {
        return false;
    }
}

async function readDraft(animalId: string, species: string | null): Promise<ArkStoryDraft | null> {
    const fixture = devParam("arkfounder");
    if (fixture) {
        const {fixtureArkStoryDraft} = await import("@/lib/ark-founders-fixture");
        const draft = fixtureArkStoryDraft(animalId, species);
        return fixture === "shared" ? {...draft, story: {step: draft.step ?? "", problem: "I kept putting off the hard conversation with my brother", shared_at: new Date().toISOString()}} : draft;
    }
    try {
        const response = await fetch(`/api/ark/founder-story?animal=${encodeURIComponent(animalId)}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {draft?: unknown};
        return decodeArkStoryDraft(body.draft);
    } catch {
        return null;
    }
}

async function postStory(animalId: string, step: string, problem: string): Promise<ArkStoryShareResult> {
    const fixture = devParam("arkfounder");
    if (fixture) {
        // Development: nothing is sent; `?arkfounder=notpublic` answers as the screen saying no.
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        if (fixture === "notpublic") return {ok: false, problem: "not_public"};
        return {ok: true, story: {step: step.trim(), problem: problem.trim() || null, shared_at: new Date().toISOString()}};
    }
    try {
        const response = await fetch("/api/ark/founder-story", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify(problem.trim() ? {animal_id: animalId, step, problem} : {animal_id: animalId, step}),
            cache: "no-store"
        });
        const body = await response.json().catch(() => null) as {ok?: unknown; story?: unknown; problem?: unknown} | null;
        if (response.ok && body?.ok === true) {
            const story = decodeArkFounderStory(body.story);
            return story ? {ok: true, story} : {ok: false, problem: "unavailable"};
        }
        return {ok: false, problem: body?.problem === "not_public" ? "not_public" : body?.problem === "could_not_check" ? "could_not_check" : "unavailable"};
    } catch {
        return {ok: false, problem: "could_not_check"};
    }
}

async function deleteStory(animalId: string): Promise<boolean> {
    if (devParam("arkfounder")) return true;
    try {
        const response = await fetch(`/api/ark/founder-story?animal=${encodeURIComponent(animalId)}`, {method: "DELETE", cache: "no-store"});
        const body = await response.json().catch(() => null) as {ok?: unknown} | null;
        return response.ok && body?.ok === true;
    } catch {
        return false;
    }
}

/**
 * The share line's state for one arrival of the reader's: read once
 * (`voyage_founder_story_draft_v1` as the reader), shown only when the
 * server says it may be shared. Nothing is sent without a tap. Development:
 * `?arkfounder=1` (a prefilled step, nothing sent), `=shared`, `=notpublic`.
 */
export function useArkFounderShare({animalId, species, enabled}: {animalId: string | null; species: string | null; enabled: boolean}) {
    const [state, setState] = useState<ArkFounderShareState>({phase: "loading", step: "", problem: "", story: null, busy: false, error: null});
    const stateRef = useRef(state);
    stateRef.current = state;
    /** Where "Not now" goes back to from the editor. */
    const before = useRef<ArkFounderSharePhase>("collapsed");

    useEffect(() => {
        if (!enabled || !animalId || !/^[0-9a-f-]{36}$/i.test(animalId)) {
            setState((current) => ({...current, phase: "hidden"}));
            return;
        }
        let cancelled = false;
        void readDraft(animalId, species).then((draft) => {
            if (cancelled) return;
            if (!draft || !draft.can_share) {
                setState((current) => ({...current, phase: "hidden"}));
                return;
            }
            if (draft.story) {
                setState({phase: "shared", step: draft.story.step, problem: draft.story.problem ?? "", story: draft.story, busy: false, error: null});
                return;
            }
            setState({phase: saidNotNow(animalId) ? "hidden" : "collapsed", step: draft.step ?? "", problem: "", story: null, busy: false, error: null});
        });
        return () => {
            cancelled = true;
        };
        // `species` only names the fixture's animal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animalId, enabled]);

    const share = useCallback(async () => {
        const words = stateRef.current;
        if (!animalId || words.busy) return;
        // Too short to share (an empty prefill): open the editor instead of sending.
        if (words.step.replace(/\s+/g, " ").trim().length < 3) {
            setState((current) => ({...current, phase: "editing"}));
            return;
        }
        setState((current) => ({...current, busy: true, error: null}));
        const result = await postStory(animalId, words.step, words.problem);
        setState((current) => {
            if (result.ok) return {...current, busy: false, error: null, phase: "shared", story: result.story, step: result.story.step, problem: result.story.problem ?? ""};
            // The screen said no: the editor stays (or opens) so other words can be tried.
            if (result.problem === "not_public") return {...current, busy: false, error: "not_public", phase: "editing"};
            return {...current, busy: false, error: "could_not_check"};
        });
    }, [animalId]);

    const edit = useCallback(() => {
        setState((current) => {
            before.current = current.phase === "shared" ? "shared" : "collapsed";
            return {...current, phase: "editing", error: null, ...(current.story ? {step: current.story.step, problem: current.story.problem ?? ""} : {})};
        });
    }, []);

    const notNow = useCallback(() => {
        setState((current) => {
            if (current.phase === "editing" && before.current === "shared") return {...current, phase: "shared", error: null};
            if (animalId) rememberNotNow(animalId);
            return {...current, phase: "hidden", error: null};
        });
    }, [animalId]);

    const remove = useCallback(async () => {
        if (!animalId) return;
        setState((current) => ({...current, busy: true, error: null}));
        const removed = await deleteStory(animalId);
        setState((current) => (removed ? {...current, busy: false, phase: "removed", story: null} : {...current, busy: false, error: "could_not_check"}));
    }, [animalId]);

    const setStep = useCallback((step: string) => setState((current) => ({...current, step, error: null})), []);
    const setProblem = useCallback((problem: string) => setState((current) => ({...current, problem, error: null})), []);

    return {state, share, edit, notNow, remove, setStep, setProblem};
}
