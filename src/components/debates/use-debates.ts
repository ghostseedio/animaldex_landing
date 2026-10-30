"use client";

/**
 * Debates in the browser (docs/debates/SPEC.md): the calls behind the sheet,
 * the vote buttons, "Try {name}'s way", the roster switch and healing, and
 * one debate kept in step between the places showing it (the chat, the
 * Debates page, Discover, the card). The server is the authority: these only
 * say what it answered.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {
    debateProblemCode,
    decodeDebate,
    decodeDebateCandidates,
    decodeDebateWayChoice,
    decodeDebates,
    decodeHeartsResult,
    type Debate,
    type DebateCandidate,
    type DebateProblemCode,
    type DebateVisibility,
    type DebateWayChoice,
    type HeartsResult
} from "@/lib/debates";

export type DebateCallResult<T> = {ok: true; value: T} | {ok: false; code: DebateProblemCode};

async function post(url: string, body: Record<string, unknown>): Promise<{ok: true; payload: Record<string, unknown>} | {ok: false; code: DebateProblemCode}> {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok || payload?.ok !== true) return {ok: false, code: debateProblemCode(payload?.code ?? (response.status === 401 ? "not_authenticated" : null))};
        return {ok: true, payload};
    } catch {
        return {ok: false, code: "debate_unavailable"};
    }
}

const debatesCall = (body: Record<string, unknown>) => post("/api/app/debates", body);

export async function loadDebateCandidates(params: {hostCaptureId: string; visibility: DebateVisibility; problem: string}): Promise<DebateCallResult<DebateCandidate[]>> {
    const result = await debatesCall({action: "candidates", ...params});
    return result.ok ? {ok: true, value: decodeDebateCandidates(result.payload.candidates)} : result;
}

export async function createDebate(params: {hostCaptureId: string; visibility: DebateVisibility; problem: string; captureIds: string[]}): Promise<DebateCallResult<Debate>> {
    const result = await debatesCall({action: "create", ...params});
    if (!result.ok) return result;
    const debate = decodeDebate(result.payload.debate);
    return debate ? {ok: true, value: debate} : {ok: false, code: "debate_unavailable"};
}

export async function approvePublicDebate(debateId: string, problemPublic: string): Promise<DebateCallResult<Debate | null>> {
    const result = await debatesCall({action: "approve", debateId, problemPublic});
    return result.ok ? {ok: true, value: decodeDebate(result.payload.debate)} : result;
}

export async function voteOnDebate(debateId: string, participantId: string): Promise<DebateCallResult<number | null>> {
    const result = await debatesCall({action: "vote", debateId, participantId});
    return result.ok ? {ok: true, value: typeof result.payload.votes === "number" ? result.payload.votes : null} : result;
}

export async function chooseDebateWay(debateId: string, participantId: string): Promise<DebateCallResult<DebateWayChoice>> {
    const result = await debatesCall({action: "choose", debateId, participantId});
    if (!result.ok) return result;
    const choice = decodeDebateWayChoice(result.payload.choice);
    return choice ? {ok: true, value: choice} : {ok: false, code: "debate_unavailable"};
}

export async function setDebateRoster(optedIn: boolean): Promise<DebateCallResult<boolean>> {
    const result = await debatesCall({action: "roster", optedIn});
    return result.ok ? {ok: true, value: result.payload.optedIn === true} : result;
}

export async function healHeart(captureId: string): Promise<DebateCallResult<HeartsResult>> {
    const result = await post("/api/app/hearts", {captureId});
    if (!result.ok) return result;
    const healed = decodeHeartsResult(result.payload);
    return healed ? {ok: true, value: healed} : {ok: false, code: "debate_unavailable"};
}

export async function fetchDebate(debateId: string): Promise<{enabled: boolean; debate: Debate | null}> {
    try {
        const response = await fetch(`/api/app/debates?id=${encodeURIComponent(debateId)}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
        return {enabled: payload?.enabled !== false, debate: decodeDebate(payload?.debate)};
    } catch {
        return {enabled: true, debate: null};
    }
}

// MARK: - One debate, everywhere it shows

const DEBATE_EVENT = "animaldex:debate";

/** Tells every surface showing this debate what it is now. */
export function noteDebateChanged(debate: Debate) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<Debate>(DEBATE_EVENT, {detail: debate}));
}

/** Follows `noteDebateChanged` (for one debate, or every one). */
export function useDebateUpdates(debateId: string | null, onChange: (debate: Debate) => void) {
    const callback = useRef(onChange);
    callback.current = onChange;
    useEffect(() => {
        const listener = (event: Event) => {
            const debate = (event as CustomEvent<Debate>).detail;
            if (!debate || (debateId && debate.id !== debateId)) return;
            callback.current(debate);
        };
        window.addEventListener(DEBATE_EVENT, listener);
        return () => window.removeEventListener(DEBATE_EVENT, listener);
    }, [debateId]);
}

export type MyDebatesState = {
    /** The server's switch: everything debate-shaped hides while it is off. */
    enabled: boolean;
    debates: Debate[];
    /** Whether the reader's animals may join public debates; null when unknown. */
    optedIn: boolean | null;
    loaded: boolean;
};

/**
 * The reader's debates (all of them, or one card's), with the switch and
 * their roster opt-in. Off and empty until the server says otherwise.
 */
export function useMyDebates(params: {captureId?: string | null; active?: boolean} = {}) {
    const active = params.active !== false;
    const captureId = params.captureId ?? null;
    const [state, setState] = useState<MyDebatesState>({enabled: false, debates: [], optedIn: null, loaded: false});
    const load = useCallback(async () => {
        if (!active) return;
        try {
            const query = captureId ? `?captureId=${encodeURIComponent(captureId)}` : "";
            const response = await fetch(`/api/app/debates${query}`, {headers: {Accept: "application/json"}, cache: "no-store"});
            const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
            setState({
                enabled: payload?.enabled === true,
                debates: decodeDebates(payload?.debates),
                optedIn: typeof payload?.optedIn === "boolean" ? payload.optedIn : null,
                loaded: true
            });
        } catch {
            setState((current) => ({...current, loaded: true}));
        }
    }, [active, captureId]);
    useEffect(() => {
        setState({enabled: false, debates: [], optedIn: null, loaded: false});
        void load();
    }, [load]);
    useDebateUpdates(null, useCallback((debate: Debate) => {
        setState((current) => {
            const known = current.debates.some((item) => item.id === debate.id);
            const inScope = !captureId || debate.participants.some((participant) => participant.captureId === captureId);
            if (!known && !inScope) return current;
            return {
                ...current,
                debates: known
                    ? current.debates.map((item) => (item.id === debate.id
                        ? {...item, ...debate, participants: debate.participants.length > 0 ? debate.participants : item.participants}
                        : item))
                    : [debate, ...current.debates]
            };
        });
    }, [captureId]));
    const setOptedIn = useCallback((optedIn: boolean | null) => setState((current) => ({...current, optedIn})), []);
    return {...state, reload: load, setOptedIn};
}
