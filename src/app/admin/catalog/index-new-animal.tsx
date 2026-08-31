"use client";

import {useState} from "react";
import type {NotifyRequest} from "@/app/admin/maintenance/notify-owner-dialog";

/**
 * Index an animal that is not in the catalog yet.
 *
 * Three things had to happen by hand before: check the animal is not already
 * here under another name or covered by a group entry, write a subtitle, a
 * behaviour principle and five calibrated stats in the catalog's voice, and then
 * tell whoever had already photographed it. Each step was skippable, and the
 * middle one is why entries sat unwritten.
 *
 * The check runs first and its blocking matches are not overridable from here:
 * a name collision means editing the existing entry, not minting a second. The
 * softer matches — same genus, a group entry that may already cover this animal
 * — are shown and left to the operator, because whether "Black Ant" covers
 * "Black Garden Ant" is a judgement rather than a rule.
 */

type Match = {
    speciesProfileId: string;
    number: number | null;
    displayName: string | null;
    scientificName: string | null;
    identityKind: string | null;
    catalogStatus: string | null;
    reason: string;
    blocking: boolean;
};

type Draft = {
    subtitle: string;
    subtitleStory: string;
    principleName: string;
    principleExpression: string;
    coreLesson: string;
    shortMotto: string;
    stats: Record<string, number> | null;
    tier: string | null;
};

const STATS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

const EMPTY: Draft = {
    subtitle: "", subtitleStory: "", principleName: "",
    principleExpression: "", coreLesson: "", shortMotto: "", stats: null, tier: null
};

type Props = {
    onClose: () => void;
    onIndexed: (message: string) => void;
    onNotify: (request: NotifyRequest) => void;
    onEditExisting: (speciesProfileId: string) => void;
};

export default function IndexNewAnimal({onClose, onIndexed, onNotify, onEditExisting}: Props) {
    const [displayName, setDisplayName] = useState("");
    const [scientificName, setScientificName] = useState("");
    const [matches, setMatches] = useState<Match[] | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [stats, setStats] = useState<Record<string, number>>({});
    const [busy, setBusy] = useState<null | "check" | "draft" | "save">(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const blocking = matches?.filter((match) => match.blocking) ?? [];
    const advisory = matches?.filter((match) => !match.blocking) ?? [];

    async function call<T>(url: string, init: RequestInit): Promise<T> {
        const response = await fetch(url, init);
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Request failed");
        return payload as T;
    }

    async function runCheck() {
        setBusy("check");
        setError(null);
        setNotice(null);
        try {
            const payload = await call<{matches: Match[]}>("/api/admin/catalog/check", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({displayName, scientificName})
            });
            setMatches(payload.matches);
            if (!payload.matches.some((match) => match.blocking)) {
                setNotice("Nothing already holds this animal. Draft the entry, or write it yourself.");
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Check failed");
        } finally {
            setBusy(null);
        }
    }

    async function runDraft() {
        setBusy("draft");
        setError(null);
        try {
            const payload = await call<{draft: Draft}>("/api/admin/catalog/draft", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({displayName, scientificName})
            });
            setDraft(payload.draft);
            if (payload.draft.stats) setStats(payload.draft.stats);
            setNotice(payload.draft.tier
                ? `Drafted. These stats put it in tier ${payload.draft.tier} — check that reads right before saving.`
                : "Drafted. Read it before saving; nothing has been written yet.");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Draft failed");
        } finally {
            setBusy(null);
        }
    }

    async function save() {
        setBusy("save");
        setError(null);
        try {
            const payload = await call<{entry: Record<string, unknown>; applied: string[]}>(
                "/api/admin/maintenance/catalog", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        create: true,
                        newDisplayName: displayName,
                        newIdentityKey: displayName,
                        newScientificName: scientificName,
                        identityKind: "species",
                        identityResolutionMode: "terminal",
                        setNumber: "next",
                        stats: Object.keys(stats).length ? stats : undefined,
                        subtitle: draft.subtitle,
                        subtitleStory: draft.subtitleStory,
                        principleName: draft.principleName,
                        principleExpression: draft.principleExpression,
                        coreLesson: draft.coreLesson,
                        shortMotto: draft.shortMotto
                    })
                });

            const entry = payload.entry ?? {};
            const number = entry.animaldex_number;
            const speciesProfileId = String(entry.species_profile_id ?? "");
            onIndexed(`${displayName} indexed as #${number}.`);

            // Anyone who already photographed it now holds a collected card, so
            // they are the people this is news for.
            if (speciesProfileId) {
                try {
                    const owners = await call<{owners: Array<{userId: string; label: string; captureId: string}>}>(
                        `/api/admin/catalog/owners?speciesProfileId=${speciesProfileId}`, {cache: "no-store"});

                    if (owners.owners.length) {
                        onNotify({
                            templateId: "indexed",
                            recipients: owners.owners.map((owner) => ({
                                userId: owner.userId,
                                label: owner.label,
                                captureId: owner.captureId
                            })),
                            animalName: displayName,
                            note: `${owners.owners.length} member${owners.owners.length === 1 ? " has" : "s have"} already captured this animal. Each message links to their own capture.`
                        });
                    } else {
                        setNotice(`Indexed as #${number}. Nobody has captured this animal yet, so there is nobody to tell.`);
                    }
                } catch {
                    setNotice(`Indexed as #${number}, but the capture owners could not be read.`);
                }
            }

            setMatches(null);
            setDraft(EMPTY);
            setStats({});
            setDisplayName("");
            setScientificName("");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to index this animal");
        } finally {
            setBusy(null);
        }
    }

    const field = (key: keyof Draft, label: string, rows = 2) => (
        <label className="block">
            <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">{label}</span>
            <textarea value={String(draft[key] ?? "")} rows={rows}
                      onChange={(event) => setDraft((current) => ({...current, [key]: event.target.value}))}
                      className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300" />
        </label>
    );

    return (
        <div role="dialog" aria-modal="true" aria-label="Index a new animal"
             className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-8"
             onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-line-300 bg-canvas-950 shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-line-300 px-5 py-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[.16em] text-primary-200">Catalog</p>
                        <h2 className="font-display text-2xl text-white">Index a new animal</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-line-300 text-xl text-white hover:border-primary-300">×</button>
                </div>

                <div className="space-y-4 p-5">
                    {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
                    {notice && <p className="rounded-xl border border-primary-400/20 bg-primary-500/10 p-3 text-sm text-primary-100">{notice}</p>}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Animal name</span>
                            <input value={displayName} onChange={(event) => {setDisplayName(event.target.value); setMatches(null);}}
                                   placeholder="Asian Koel"
                                   className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Scientific name</span>
                            <input value={scientificName} onChange={(event) => {setScientificName(event.target.value); setMatches(null);}}
                                   placeholder="Eudynamys scolopaceus"
                                   className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300" />
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void runCheck()} disabled={!displayName.trim() || busy !== null}
                                className="rounded-xl border border-line-300 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                            {busy === "check" ? "Checking…" : "1. Check the catalog"}
                        </button>
                        <button type="button" onClick={() => void runDraft()} disabled={!matches || blocking.length > 0 || busy !== null}
                                className="rounded-xl border border-line-300 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                            {busy === "draft" ? "Drafting…" : "2. Draft with AI"}
                        </button>
                    </div>

                    {blocking.length > 0 && (
                        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
                            <p className="text-sm font-bold text-red-200">This animal is already in the catalog.</p>
                            <ul className="mt-2 space-y-2">
                                {blocking.map((match) => (
                                    <li key={match.speciesProfileId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                        <span className="text-white">
                                            <span className="font-mono text-primary-100">{match.number != null ? `#${match.number}` : "unindexed"}</span>
                                            {" "}{match.displayName} <span className="text-ink-400">— {match.reason}</span>
                                        </span>
                                        <button type="button" onClick={() => onEditExisting(match.speciesProfileId)}
                                                className="rounded-lg border border-primary-400/40 px-3 py-1.5 text-xs font-black text-primary-100">
                                            Edit that entry
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {advisory.length > 0 && (
                        <details className="rounded-xl border border-line-300 p-3">
                            <summary className="cursor-pointer text-sm font-bold text-ink-300">
                                Worth a look before indexing ({advisory.length})
                            </summary>
                            <ul className="mt-2 space-y-1">
                                {advisory.map((match) => (
                                    <li key={match.speciesProfileId} className="text-xs text-ink-400">
                                        <span className="font-mono text-primary-100">#{match.number}</span>{" "}
                                        {match.displayName} <span className="text-ink-500">({match.identityKind}) — {match.reason}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {matches && blocking.length === 0 && (
                        <div className="space-y-3 rounded-xl border border-line-300 bg-surface-900 p-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-3">
                                    {field("subtitle", "Subtitle")}
                                    {field("subtitleStory", "Subtitle story", 3)}
                                </div>
                                <div className="space-y-3">
                                    {field("principleName", "Principle name", 1)}
                                    {field("coreLesson", "Core lesson", 3)}
                                    {field("shortMotto", "Short motto", 1)}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Canonical stats</p>
                                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                    {STATS.map((key) => (
                                        <label key={key} className="block">
                                            <span className="text-xs capitalize text-ink-400">{key}</span>
                                            <input type="number" min={0} max={100} value={stats[key] ?? ""}
                                                   onChange={(event) => setStats((current) => ({...current, [key]: Number(event.target.value)}))}
                                                   className="mt-1 w-full rounded-lg border border-line-300 bg-canvas-900 px-2 py-2 text-sm text-white" />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button type="button" onClick={() => void save()}
                                    disabled={busy !== null || !displayName.trim() || !draft.subtitle.trim()}
                                    className="rounded-xl bg-primary-400 px-5 py-3 text-sm font-black text-canvas-950 disabled:opacity-40">
                                {busy === "save" ? "Indexing…" : "3. Index it and take the next number"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
