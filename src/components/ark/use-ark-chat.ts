"use client";

/**
 * The shared Ark in the animal chat (Part 2, docs/ark-next.md; captures +
 * thrive, 2026-11-11): the line under a live step card, the line under the
 * reply that finished a step that worked, and (history) the arrival a step
 * brought before captures did.
 *
 * - `useArkStepOffer`: `/api/ark/step-offer` for this species, read when a
 *   step is live and again after a step worked: "If this works, your
 *   {species} will thrive", by state and band.
 * - `useArkStepResults`: for each reply that finished a worked step (its
 *   step id), `/api/ark/step-result`: the band it left the reader's animals
 *   in and the step's locked Ark Score points. A step that worked while the
 *   chat is open is read again for a couple of minutes (the outbox applies it
 *   once a minute); when it lands, the line plays in.
 * - `useArkArrivals`: which replies that finished a worked step brought one
 *   of the reader's animals aboard, under the old rule (the public snapshot,
 *   read with their session; never a capture's animal). History only: steps
 *   no longer bring animals.
 *
 * Nothing opens a window. Development: `?arkoffer=thrive|good|prime|later`
 * draws the step's line without a session; `?arkresult=1` answers every
 * worked step in the thread as done (`?arkresult=fresh`: and plays them in);
 * `?arkarrival=1` reads the fixture Ark and treats every worked step in the
 * thread as having brought one (`?arkarrival=fresh`: and plays them in).
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {emitArkArrival} from "@/lib/ark/arrival-bus";
import {decodeArkFounderSettings, decodeArkFounderStory, decodeArkStoryDraft, type ArkFounderStory, type ArkStoryDraft, type ArkStoryShareResult} from "@/lib/ark-founders";
import {noteArkArrivalsSeen} from "@/lib/ark-measure-client";
import {
    ARK_ARRIVAL_POLL_MS,
    arkAnimalIsSpecies,
    arkMatchArrivals,
    arkWorkedFinishers,
    decodeArkStepOffer,
    type ArkStepOffer
} from "@/lib/ark-world";
import {decodeArkStepResult, type ArkStepResult} from "@/lib/ark-thrive";

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
        const name = species.name ?? "Red Fox";
        const fixtures: Record<string, ArkStepOffer> = {
            thrive: {state: "thrive", species: name, livingBrought: 2, bandNow: "ordinary", bandIfWorked: "good"},
            good: {state: "thrive", species: name, livingBrought: 1, bandNow: "good", bandIfWorked: "prime"},
            prime: {state: "thrive", species: name, livingBrought: 2, bandNow: "prime", bandIfWorked: "prime"},
            later: {state: "thrive_later", species: name, livingBrought: 0, bandNow: "ordinary", bandIfWorked: "good"}
        };
        if (fixture && fixtures[fixture]) {
            setOffer({key, value: fixtures[fixture]});
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

// MARK: - What a step that worked did (captures + thrive)

async function readStepResult(stepId: string): Promise<ArkStepResult | null> {
    try {
        const response = await fetch(`/api/ark/step-result?step=${encodeURIComponent(stepId)}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {result?: unknown};
        return decodeArkStepResult(body.result);
    } catch {
        return null;
    }
}

/** Development's `?arkresult=1`: every worked step done, its animals thriving, in an order of bands that shows each. */
function fixtureStepResult(index: number, species: Species): ArkStepResult {
    const shapes: Array<Pick<ArkStepResult, "livingBrought" | "thriveBefore" | "thriveAfter" | "points">> = [
        {livingBrought: 1, thriveBefore: "ordinary", thriveAfter: "good", points: 10},
        {livingBrought: 2, thriveBefore: "good", thriveAfter: "prime", points: 30},
        {livingBrought: 0, thriveBefore: null, thriveAfter: null, points: 10}
    ];
    return {status: "done", species: species.name ?? "Red Fox", ...shapes[index % shapes.length]};
}

/**
 * One line under a worked step: what it did, whether it just landed, and (D6) the reader's animal of the
 * kind its founders' story would attach to, with the step it was (its id and its own words for the prefill).
 */
export type ArkThreadStepResult = {result: ArkStepResult; fresh: boolean; animal: ArkAnimal | null; stepId: string | null; stepText: string | null};

/**
 * The reader's own animal of this kind that a step's story attaches to (D6): their living arrived one that
 * came aboard first (the same one every read; born young are their family line, not theirs to tell).
 */
function storyAnimal(snapshot: ArkSnapshot | null, species: Species): ArkAnimal | null {
    if (!snapshot) return null;
    const mine = snapshot.animals.filter((animal) => animal.mine && animal.origin !== "born" && !animal.id.startsWith("visitor:") && arkAnimalIsSpecies(animal, species));
    return mine.sort((a, b) => a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id))[0] ?? null;
}

/** Development's `?arkresult=1`: the fixture Ark's animal of this kind (else its first), made the reader's. */
async function fixtureStoryAnimal(species: Species): Promise<ArkAnimal | null> {
    const snapshot = decodeArkSnapshot((await import("@/ark-scene/fixtures/snapshot.json")).default);
    const base = snapshot?.animals.find((animal) => animal.model_slug === species.slug) ?? snapshot?.animals[0];
    return base ? {...base, name: species.name ?? base.name, model_slug: species.slug ?? base.model_slug, mine: true, origin: "arrived", source: "capture"} : null;
}

/**
 * The line under each reply that finished a worked step, by that reply's id:
 * what the step did for the reader's animals of this kind. Read once when the
 * thread opens; a step that worked while it is open is read again until it is
 * done (`ARK_ARRIVAL_POLL_MS`), and then plays in (`fresh`). `onDone` runs
 * once for each that lands while the chat is open (to read the step's line again).
 */
export function useArkStepResults({enabled, species, messages, onDone}: {
    enabled: boolean;
    species: Species;
    messages: readonly Message[];
    onDone?: () => void;
}): Map<string, ArkThreadStepResult> {
    const finishers = useMemo(() => (enabled ? arkWorkedFinishers(messages).filter((finisher) => finisher.stepId) : []), [enabled, messages]);
    const finisherKey = finishers.map((finisher) => `${finisher.id}:${finisher.stepId}`).join(",");
    const [found, setFound] = useState<Map<string, ArkStepResult>>(() => new Map());
    const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
    /** D6: the reader's animal of this kind, read with the results (the snapshot, as the reader). */
    const [animal, setAnimal] = useState<ArkAnimal | null>(null);
    const known = useRef<Set<string> | null>(null);
    const landed = useRef(new Set<string>());
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;
    const finishersRef = useRef(finishers);
    finishersRef.current = finishers;
    const speciesRef = useRef(species);
    speciesRef.current = species;
    const speciesKey = `${species.speciesProfileId ?? ""}|${species.slug ?? ""}`;
    useEffect(() => {
        known.current = null;
        landed.current = new Set();
        setFound(new Map());
        setFresh(new Set());
        setAnimal(null);
    }, [speciesKey]);

    const read = useCallback(async (only?: ReadonlySet<string>) => {
        const current = finishersRef.current.filter((finisher) => !only || only.has(finisher.id));
        if (current.length === 0) return;
        const devFixture = devParam("arkresult");
        const answers = await Promise.all(current.map(async (finisher, index) => [finisher.id, devFixture ? fixtureStepResult(index, speciesRef.current) : await readStepResult(finisher.stepId as string)] as const));
        setFound((before) => {
            const next = new Map(before);
            for (const [id, result] of answers) if (result) next.set(id, result);
            return next;
        });
        // D6: one of theirs aboard, for the founders' story moment under the newest step's line.
        if (answers.some(([, result]) => result?.status === "done" && result.livingBrought > 0)) {
            const own = devFixture ? await fixtureStoryAnimal(speciesRef.current) : storyAnimal(await readSnapshot(), speciesRef.current);
            if (own) setAnimal(own);
        }
        const recent = new Set(current.filter((finisher) => Date.now() - Date.parse(finisher.createdAt) < RECENT_MS).map((finisher) => finisher.id));
        const playIn: string[] = [];
        for (const [id, result] of answers) {
            if (result?.status !== "done" || landed.current.has(id)) continue;
            landed.current.add(id);
            // Only a step that worked while this chat was open, just now (an older one read late is shown, not played).
            if (devFixture === "fresh" || (known.current && !known.current.has(id) && recent.has(id))) playIn.push(id);
        }
        if (playIn.length === 0) return;
        setFresh((before) => new Set([...Array.from(before), ...playIn]));
        onDoneRef.current?.();
    }, []);

    useEffect(() => {
        if (!enabled || finishers.length === 0) {
            if (known.current === null && enabled && messages.length > 0) known.current = new Set();
            return;
        }
        if (known.current === null) {
            // The thread as it opened: these are shown, never played in.
            known.current = new Set(finishers.map((finisher) => finisher.id));
            void read();
            return;
        }
        const waiting = new Set(finishers.filter((finisher) => !known.current?.has(finisher.id) && !landed.current.has(finisher.id)).map((finisher) => finisher.id));
        if (waiting.size === 0) return;
        // A step worked just now: the outbox applies it within the minute.
        const timers = ARK_ARRIVAL_POLL_MS.map((delay) => window.setTimeout(() => void read(waiting), delay));
        return () => timers.forEach((timer) => window.clearTimeout(timer));
        // The finishers are read through their key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, finisherKey, read]);

    return useMemo(() => {
        const results = new Map<string, ArkThreadStepResult>();
        const steps = new Map(finishers.map((finisher) => [finisher.id, finisher]));
        found.forEach((result, finisherId) => {
            if (result.status !== "done") return;
            const finisher = steps.get(finisherId);
            results.set(finisherId, {
                result,
                fresh: fresh.has(finisherId),
                animal: result.livingBrought > 0 ? animal : null,
                stepId: finisher?.stepId ?? null,
                stepText: finisher?.stepText ?? null
            });
        });
        return results;
        // The finishers are read through their key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [found, fresh, animal, finisherKey]);
}

// MARK: - Founders: one calm moment under an arrival (founders contract, section 4)

/**
 * `name`: "Show your name on the Ark? I'm 18 or over" (only when the server
 * says to ask); then the story: `collapsed` (Share / Edit / Not now),
 * `editing` (in place), `shared`, or `removed`. One line, in this order.
 */
export type ArkFounderSharePhase = "loading" | "hidden" | "name" | "collapsed" | "editing" | "shared" | "removed";

export type ArkFounderShareState = {
    phase: ArkFounderSharePhase;
    /** The editor's words: what they did (prefilled with the step) and the problem line (never prefilled). */
    step: string;
    problem: string;
    story: ArkFounderStory | null;
    busy: boolean;
    /** The name question was asked in this line: the story question is then the shorter one. */
    nameAsked: boolean;
    /** They said yes to the name here: "Your name shows on the Ark". */
    nameShown: boolean;
    /** A share still needs the one-tap 18+ confirmation: its button reads "I'm 18 or over, share". */
    needsAdult: boolean;
    /** The last failure, said inline: other words (`not_public`), 18+ first (`needs_adult`), or try again. */
    error: "not_public" | "could_not_check" | "needs_adult" | null;
};

const NOT_NOW_KEY = "ark.founderShare.notNow.";
const NAME_NOT_NOW_KEY = "ark.founderName.notNow.";

function remember(key: string) {
    try {
        window.localStorage.setItem(key, "1");
    } catch {
        // No storage (a private window): it asks again next time.
    }
}

function remembered(key: string): boolean {
    try {
        return window.localStorage.getItem(key) === "1";
    } catch {
        return false;
    }
}

async function readDraft(animalId: string, species: string | null, stepId: string | null, stepText: string | null): Promise<ArkStoryDraft | null> {
    const fixture = devParam("arkfounder");
    if (fixture) {
        const {fixtureArkStoryDraft} = await import("@/lib/ark-founders-fixture");
        const draft = fixtureArkStoryDraft(animalId, species, stepText);
        if (fixture === "shared") return {...draft, story: {step: draft.step ?? "", problem: "I kept putting off the hard conversation with my brother", shared_at: new Date().toISOString()}};
        // `name`: no stored adult year and no answer yet (most people): the name question first, the 18+ tap needed to share.
        if (fixture === "name") return {...draft, ask_name: true, needs_adult_confirm: true};
        // `adult`: they said "Not now" to the name: sharing still needs the 18+ tap.
        if (fixture === "adult" || fixture === "needsadult") return {...draft, needs_adult_confirm: true};
        return draft;
    }
    try {
        // D6: the step this moment sits under, so the server prefills with it (an older server reads the animal alone).
        const query = new URLSearchParams({animal: animalId, ...(stepId ? {step: stepId} : {})});
        const response = await fetch(`/api/ark/founder-story?${query}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {draft?: unknown};
        return decodeArkStoryDraft(body.draft);
    } catch {
        return null;
    }
}

async function postStory(animalId: string, step: string, problem: string, confirmAdult: boolean): Promise<ArkStoryShareResult> {
    const fixture = devParam("arkfounder");
    if (fixture) {
        // Development: nothing is sent; `?arkfounder=notpublic` answers as the screen saying no, `=needsadult` as the 18+ tap missing.
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        if (fixture === "notpublic") return {ok: false, problem: "not_public"};
        if (fixture === "needsadult" && !confirmAdult) return {ok: false, problem: "needs_adult"};
        return {ok: true, story: {step: step.trim(), problem: problem.trim() || null, shared_at: new Date().toISOString()}};
    }
    try {
        const response = await fetch("/api/ark/founder-story", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify({animal_id: animalId, step, ...(problem.trim() ? {problem} : {}), ...(confirmAdult ? {confirm_adult: true} : {})}),
            cache: "no-store"
        });
        const body = await response.json().catch(() => null) as {ok?: unknown; story?: unknown; problem?: unknown} | null;
        if (response.ok && body?.ok === true) {
            const story = decodeArkFounderStory(body.story);
            return story ? {ok: true, story} : {ok: false, problem: "unavailable"};
        }
        const problemCode = body?.problem;
        return {ok: false, problem: problemCode === "not_public" || problemCode === "could_not_check" || problemCode === "needs_adult" ? problemCode : "unavailable"};
    } catch {
        return {ok: false, problem: "could_not_check"};
    }
}

/** "Yes, show my name": the setter with the one-tap 18+ confirmation. */
async function showName(): Promise<"ok" | "under_18" | "failed"> {
    if (devParam("arkfounder")) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        return "ok";
    }
    try {
        const response = await fetch("/api/ark/founder-settings", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify({show: true, confirm_adult: true}),
            cache: "no-store"
        });
        const body = await response.json().catch(() => null) as {settings?: unknown; error?: unknown} | null;
        if (response.ok && decodeArkFounderSettings(body?.settings)) return "ok";
        return body?.error === "under_18" ? "under_18" : "failed";
    } catch {
        return "failed";
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
 * The line's state for one of the reader's animals: read once
 * (`voyage_founder_story_draft_v1` as the reader), shown only when the server
 * says it may be shared. D6 (owner, 2026-11-11): it sits under the thrive
 * line of the step that worked (`stepId`), prefilled with that step's own
 * words (the server's, else `stepText`), never the problem; the story attaches
 * to the reader's animal of the step's kind (`animalId`). The name question first when the server says to
 * ask it; either answer moves the same line on to the story. Nothing is sent
 * without a tap. Development: `?arkfounder=1` (a prefilled step, nothing
 * sent), `=name` (the name question first), `=adult` (sharing needs the 18+
 * tap), `=needsadult` (the server asks for it), `=shared`, `=notpublic`.
 */
export function useArkFounderShare({animalId, species, enabled, stepId = null, stepText = null}: {animalId: string | null; species: string | null; enabled: boolean; stepId?: string | null; stepText?: string | null}) {
    const [state, setState] = useState<ArkFounderShareState>({phase: "loading", step: "", problem: "", story: null, busy: false, nameAsked: false, nameShown: false, needsAdult: false, error: null});
    const stateRef = useRef(state);
    stateRef.current = state;
    /** Where "Not now" goes back to from the editor. */
    const before = useRef<ArkFounderSharePhase>("collapsed");
    /** Where the story starts once the name question is answered. */
    const storyPhase = useRef<ArkFounderSharePhase>("collapsed");

    useEffect(() => {
        if (!enabled || !animalId || !/^[0-9a-f-]{36}$/i.test(animalId)) {
            setState((current) => ({...current, phase: "hidden"}));
            return;
        }
        let cancelled = false;
        void readDraft(animalId, species, stepId, stepText).then((draft) => {
            if (cancelled) return;
            if (!draft || !draft.can_share) {
                setState((current) => ({...current, phase: "hidden"}));
                return;
            }
            const story = draft.story;
            storyPhase.current = story ? "shared" : remembered(`${NOT_NOW_KEY}${animalId}`) ? "hidden" : "collapsed";
            const askName = draft.ask_name && !remembered(`${NAME_NOT_NOW_KEY}${animalId}`);
            setState({
                phase: askName ? "name" : storyPhase.current,
                step: story?.step ?? draft.step ?? stepText ?? "",
                problem: story?.problem ?? "",
                story,
                busy: false,
                nameAsked: askName,
                nameShown: false,
                needsAdult: draft.needs_adult_confirm,
                error: null
            });
        });
        return () => {
            cancelled = true;
        };
        // `species` only names the fixture's animal; `stepText` is the prefill's fallback for the same step.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animalId, enabled, stepId]);

    /** "Yes, show my name" (with the 18+ confirmation it states), then on to the story in the same line. */
    const nameYes = useCallback(async () => {
        if (!animalId || stateRef.current.busy) return;
        setState((current) => ({...current, busy: true, error: null}));
        const result = await showName();
        setState((current) => {
            if (result === "ok") return {...current, busy: false, phase: storyPhase.current, nameShown: true, needsAdult: false};
            // A stored teen year: they stay a Voyager; nothing more to ask.
            if (result === "under_18") return {...current, busy: false, phase: "hidden"};
            return {...current, busy: false, error: "could_not_check"};
        });
    }, [animalId]);

    /** "Not now" to the name: nothing is sent, they stay Voyager, and this arrival never asks again. */
    const nameNotNow = useCallback(() => {
        if (animalId) remember(`${NAME_NOT_NOW_KEY}${animalId}`);
        setState((current) => ({...current, phase: storyPhase.current, error: null}));
    }, [animalId]);

    const share = useCallback(async () => {
        const words = stateRef.current;
        if (!animalId || words.busy) return;
        // Too short to share (an empty prefill): open the editor instead of sending.
        if (words.step.replace(/\s+/g, " ").trim().length < 3) {
            setState((current) => ({...current, phase: "editing"}));
            return;
        }
        setState((current) => ({...current, busy: true, error: null}));
        // The button read "I'm 18 or over, share" when the confirmation is needed: tapping it is the confirmation.
        const result = await postStory(animalId, words.step, words.problem, words.needsAdult);
        setState((current) => {
            if (result.ok) return {...current, busy: false, error: null, needsAdult: false, phase: "shared", story: result.story, step: result.story.step, problem: result.story.problem ?? ""};
            // The screen said no: the editor stays (or opens) so other words can be tried.
            if (result.problem === "not_public") return {...current, busy: false, error: "not_public", phase: "editing"};
            if (result.problem === "needs_adult") return {...current, busy: false, error: "needs_adult", needsAdult: true};
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
            if (animalId) remember(`${NOT_NOW_KEY}${animalId}`);
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

    return {state, nameYes, nameNotNow, share, edit, notNow, remove, setStep, setProblem};
}
