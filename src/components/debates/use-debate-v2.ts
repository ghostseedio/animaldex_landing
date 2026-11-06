"use client";

/**
 * A debate's v2 actions as one thread shows them (docs/debates/V2.md; iOS
 * DebateSession, e15b474b and 390e5c2a): Ask more animals, "I solved it my
 * way", Ask the public (the asker) and Add one of your animals (anyone who
 * could vote). The server is the authority: each action says only what it
 * answered, and the debate as it is after goes to every surface showing it.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {
    DEBATE_MIN_SOLUTION,
    DEBATE_PUBLIC_TEXT_MAX,
    debateAskMoreCandidates,
    debateAskMoreRoom,
    debatePicksFor,
    type Debate,
    type DebateCandidate,
    type DebateSolution
} from "@/lib/debates";
import {debateProblemText} from "@/lib/debate-words";
import type {CompanionWords} from "@/lib/companion-bond";
import {
    askDebatePublic,
    extendDebate,
    fetchDebate,
    keepDebatePrivate,
    loadDebateCandidatesV2,
    loadOfferCandidates,
    noteDebateChanged,
    offerAnimalToDebate,
    postDebatePublic,
    solveDebate
} from "@/components/debates/use-debates";

/** Read about every 2 s while the anonymous draft is written; it gives up after a minute. */
const DRAFT_POLL_MS = 2000;
const DRAFT_POLLS = 30;

export function useDebateV2(params: {
    debate: Debate;
    words: CompanionWords;
    locale?: string;
    /** The thread takes the server's copy. */
    apply: (debate: Debate) => void;
    /** Ask more animals went through: the thread runs the new turns. */
    onExtended: (debate: Debate) => void;
}) {
    const {debate, words, locale, apply, onExtended} = params;
    const latest = useRef(debate);
    latest.current = debate;
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const settle = useCallback((next: Debate) => {
        apply(next);
        noteDebateChanged(next);
    }, [apply]);
    const reload = useCallback(async () => {
        const {debate: fetched} = await fetchDebate(latest.current.id);
        if (fetched && mounted.current) settle(fetched);
        return fetched;
    }, [settle]);

    // MARK: Ask more animals (V2 section 3)

    const [morePicking, setMorePicking] = useState(false);
    const [moreRows, setMoreRows] = useState<DebateCandidate[]>([]);
    const [morePicked, setMorePicked] = useState<string[]>([]);
    const [moreLoading, setMoreLoading] = useState(false);
    const [bringing, setBringing] = useState(false);
    const [moreProblem, setMoreProblem] = useState<string | null>(null);

    const beginAskMore = useCallback(async () => {
        const current = latest.current;
        if (moreLoading || !current.hostCaptureId) return;
        setMorePicking(true);
        setMoreProblem(null);
        setMoreLoading(true);
        const excludeSpecies = current.participants.map((participant) => participant.speciesProfileId).filter((id): id is string => Boolean(id));
        const problem = current.report?.problem ?? current.problemPrivate ?? current.problemPublic ?? "";
        const result = await loadDebateCandidatesV2({hostCaptureId: current.hostCaptureId, problem, excludeSpecies});
        if (!mounted.current) return;
        setMoreLoading(false);
        const {rows, picked} = debateAskMoreCandidates(result.ok ? result.value : [], current);
        setMoreRows(rows);
        setMorePicked(picked);
        if (rows.length === 0) setMoreProblem(debateProblemText(result.ok ? null : result.code, words));
    }, [moreLoading, words]);

    const cancelAskMore = useCallback(() => {
        setMorePicking(false);
        setMoreRows([]);
        setMorePicked([]);
        setMoreProblem(null);
    }, []);

    const toggleMore = useCallback((id: string) => {
        const room = debateAskMoreRoom(latest.current);
        setMorePicked((current) => (current.includes(id)
            ? current.filter((item) => item !== id)
            : current.length < room ? [...current, id] : current));
    }, []);

    const bringMore = useCallback(async () => {
        if (bringing || morePicked.length === 0) return;
        setBringing(true);
        setMoreProblem(null);
        const result = await extendDebate(latest.current.id, debatePicksFor(moreRows, morePicked));
        if (!mounted.current) return;
        setBringing(false);
        if (!result.ok) {
            setMoreProblem(debateProblemText(result.code, words));
            return;
        }
        cancelAskMore();
        noteDebateChanged(result.value);
        onExtended(result.value);
    }, [bringing, morePicked, moreRows, words, cancelAskMore, onExtended]);

    // MARK: I solved it my way (V2 section 5)

    const [solving, setSolving] = useState(false);
    const [solveProblem, setSolveProblem] = useState<string | null>(null);

    const solve = useCallback(async (account: string) => {
        const text = account.trim();
        if (solving || text.length < DEBATE_MIN_SOLUTION) return;
        setSolving(true);
        setSolveProblem(null);
        const result = await solveDebate(latest.current.id, text, locale);
        if (!mounted.current) return;
        setSolving(false);
        if (!result.ok) {
            setSolveProblem(debateProblemText(result.code, words));
            return;
        }
        const solution: DebateSolution = result.value;
        settle({...latest.current, solution, canSolve: false});
        void reload();
    }, [solving, locale, words, settle, reload]);

    // MARK: Ask the public (V2 section 6)

    const [publicWorking, setPublicWorking] = useState(false);
    const [publicProblem, setPublicProblem] = useState<string | null>(null);
    const [publicDraft, setPublicDraft] = useState("");

    // The draft to read: the server's, until they change it.
    const reviewing = debate.askerIsMe && debate.askedPublic && debate.status === "approving";
    const serverDraft = debate.problemPublic ?? "";
    useEffect(() => {
        if (reviewing) setPublicDraft((current) => current || serverDraft.slice(0, DEBATE_PUBLIC_TEXT_MAX));
    }, [reviewing, serverDraft]);

    // Being made anonymous: read until the draft is in, or it went back to private.
    const drafting = debate.askerIsMe && debate.askedPublic && debate.status === "drafting";
    useEffect(() => {
        if (!drafting) return;
        let cancelled = false;
        void (async () => {
            for (let attempt = 0; attempt < DRAFT_POLLS && !cancelled; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, DRAFT_POLL_MS));
                if (cancelled) return;
                const {debate: fetched} = await fetchDebate(latest.current.id);
                if (cancelled || !fetched) continue;
                if (fetched.status !== "drafting") {
                    settle(fetched);
                    return;
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [drafting, settle]);

    const askPublic = useCallback(async () => {
        if (publicWorking) return;
        setPublicWorking(true);
        setPublicProblem(null);
        const result = await askDebatePublic(latest.current.id);
        if (!mounted.current) return;
        setPublicWorking(false);
        if (!result.ok) {
            setPublicProblem(debateProblemText(result.code, words));
            void reload();
            return;
        }
        setPublicDraft("");
        settle(result.value);
    }, [publicWorking, words, settle, reload]);

    const postPublic = useCallback(async () => {
        if (publicWorking) return;
        const text = (publicDraft.trim() || latest.current.problemPublic || "").trim().slice(0, DEBATE_PUBLIC_TEXT_MAX);
        if (text.length < 10) {
            setPublicProblem(debateProblemText("problem_too_short", words));
            return;
        }
        setPublicWorking(true);
        setPublicProblem(null);
        const result = await postDebatePublic(latest.current.id, text);
        if (!mounted.current) return;
        setPublicWorking(false);
        if (!result.ok) {
            setPublicProblem(debateProblemText(result.code, words));
            // Too personal to post: it went back to the private debate it was.
            void reload();
            return;
        }
        settle(result.value);
    }, [publicWorking, publicDraft, words, settle, reload]);

    const keepPrivate = useCallback(async () => {
        if (publicWorking) return;
        setPublicWorking(true);
        setPublicProblem(null);
        const result = await keepDebatePrivate(latest.current.id);
        if (!mounted.current) return;
        setPublicWorking(false);
        if (!result.ok) {
            setPublicProblem(debateProblemText(result.code, words));
            return;
        }
        setPublicDraft("");
        settle(result.value);
    }, [publicWorking, words, settle]);

    // MARK: Add one of your animals (V2 section 6)

    const [offerPicking, setOfferPicking] = useState(false);
    const [offerCandidates, setOfferCandidates] = useState<DebateCandidate[]>([]);
    const [offerLoading, setOfferLoading] = useState(false);
    const [offeringId, setOfferingId] = useState<string | null>(null);
    const [offerProblem, setOfferProblem] = useState<string | null>(null);

    const beginOffer = useCallback(async () => {
        if (offerLoading) return;
        setOfferPicking(true);
        setOfferProblem(null);
        setOfferLoading(true);
        const result = await loadOfferCandidates(latest.current.id);
        if (!mounted.current) return;
        setOfferLoading(false);
        const rows = result.ok ? result.value.filter((candidate) => candidate.captureId) : [];
        setOfferCandidates(rows);
        if (rows.length === 0) setOfferProblem(result.ok ? words.debate.offerAnimalNone : debateProblemText(result.code, words));
    }, [offerLoading, words]);

    const cancelOffer = useCallback(() => {
        setOfferPicking(false);
        setOfferCandidates([]);
        setOfferProblem(null);
    }, []);

    const offer = useCallback(async (candidate: DebateCandidate) => {
        if (offeringId || !candidate.captureId) return;
        setOfferingId(candidate.captureId);
        setOfferProblem(null);
        const result = await offerAnimalToDebate(latest.current.id, candidate.captureId, locale);
        if (!mounted.current) return;
        setOfferingId(null);
        if (!result.ok) {
            setOfferProblem(debateProblemText(result.code, words));
            void reload();
            return;
        }
        cancelOffer();
        settle(result.value);
    }, [offeringId, locale, words, cancelOffer, settle, reload]);

    return {
        askMore: {
            picking: morePicking,
            rows: moreRows,
            picked: morePicked,
            room: debateAskMoreRoom(debate),
            loading: moreLoading,
            bringing,
            problem: moreProblem,
            begin: beginAskMore,
            toggle: toggleMore,
            bring: bringMore,
            cancel: cancelAskMore
        },
        solve: {working: solving, problem: solveProblem, send: solve},
        askPublic: {
            working: publicWorking,
            problem: publicProblem,
            draft: publicDraft,
            setDraft: setPublicDraft,
            ask: askPublic,
            post: postPublic,
            keepPrivate
        },
        offer: {
            picking: offerPicking,
            candidates: offerCandidates,
            loading: offerLoading,
            offeringId,
            problem: offerProblem,
            begin: beginOffer,
            offer,
            cancel: cancelOffer
        }
    };
}

export type DebateV2Actions = ReturnType<typeof useDebateV2>;
