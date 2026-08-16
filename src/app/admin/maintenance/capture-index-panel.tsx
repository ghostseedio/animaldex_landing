"use client";

import {useEffect, useState} from "react";

/**
 * Move a capture onto a chosen AnimalDex number.
 *
 * The correction an operator reaches for when the model was confidently wrong —
 * a European blackbird on an Ontario lawn — where re-running the analysis would
 * only reproduce the same answer from the same frame.
 */

type CatalogMatch = {
    species_profile_id: string;
    animaldex_number: number | null;
    display_name: string | null;
    scientific_name: string | null;
    normalized_identity_key: string | null;
    identity_kind: string | null;
    catalog_status: string | null;
};

type Props = {
    /** One or many: the same move applied to a whole selection. */
    captureIds: string[];
    animalName: string | null;
    currentNumber: number | null;
    /** Shown before applying, when the selection itself is the problem. */
    warning?: string | null;
    onClose: () => void;
    onApplied: (summary: {animalDexNumber: number | null; displayName: string | null; applied: number}) => void;
};

export default function CaptureIndexPanel({captureIds, animalName, currentNumber, warning, onClose, onApplied}: Props) {
    const [query, setQuery] = useState("");
    const [matches, setMatches] = useState<CatalogMatch[]>([]);
    const [chosen, setChosen] = useState<CatalogMatch | null>(null);
    const [searching, setSearching] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        const term = query.trim();
        if (term.length < 2) {
            setMatches([]);
            return;
        }

        // Debounced: the catalog is 3,600 rows and the operator types a name.
        const timer = setTimeout(async () => {
            setSearching(true);
            setError(null);
            try {
                const response = await fetch(`/api/admin/maintenance/capture-identity?q=${encodeURIComponent(term)}`, {cache: "no-store"});
                const payload = await response.json();
                if (!response.ok || !payload.ok) throw new Error(payload.error || "Catalog search failed");
                setMatches(payload.matches);
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Catalog search failed");
            } finally {
                setSearching(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [query]);

    async function apply() {
        if (!chosen) return;
        setApplying(true);
        setError(null);
        setNotice(null);

        // Sequential, and one capture's refusal does not abandon the rest: with a
        // burst of the same animal the interesting outcome is which ones moved.
        const moved: string[] = [];
        const refused: string[] = [];
        const siblings: string[] = [];
        let summary: {animalDexNumber: number | null; displayName: string | null} | null = null;

        for (const captureId of captureIds) {
            try {
                const response = await fetch("/api/admin/maintenance/capture-identity", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({captureId, speciesProfileId: chosen.species_profile_id})
                });
                const payload = await response.json();

                if (!response.ok || !payload.ok) {
                    refused.push(`${captureId.slice(0, 8)}: ${payload.error ?? "failed"}`);
                    continue;
                }

                moved.push(captureId);
                if (payload.siblingCaptureId) siblings.push(payload.siblingCaptureId);
                summary = {animalDexNumber: payload.animalDexNumber, displayName: payload.displayName};
            } catch (caught) {
                refused.push(`${captureId.slice(0, 8)}: ${caught instanceof Error ? caught.message : "failed"}`);
            }
        }

        if (moved.length) {
            setNotice(`Moved ${moved.length} of ${captureIds.length} to #${summary?.animalDexNumber ?? "—"} ${summary?.displayName ?? ""}.`);
            onApplied({...(summary ?? {animalDexNumber: null, displayName: null}), applied: moved.length});
        }

        if (siblings.length) {
            setNotice((current) => `${current ?? ""} This owner now holds more than one capture on that entry — merge them so the collection shows one card.`.trim());
        }

        if (refused.length) {
            setError(`${refused.length} could not move — ${refused.join(" · ")}`);
        }

        setApplying(false);
    }

    return (
        <div role="dialog" aria-modal="true" aria-label={`Set index for ${captureIds.length > 1 ? `${captureIds.length} captures` : animalName || captureIds[0]}`}
             className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-8"
             onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line-300 bg-canvas-950 shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-line-300 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[.16em] text-primary-200">Set AnimalDex index</p>
                        <h2 className="truncate font-display text-2xl text-white">
                            {captureIds.length > 1 ? `${captureIds.length} captures` : animalName || "Unidentified capture"}
                        </h2>
                        <p className="truncate font-mono text-[11px] text-ink-500">
                            {captureIds.length > 1
                                ? "All of them move to the entry you pick"
                                : `${captureIds[0]}${currentNumber != null ? ` · currently #${currentNumber}` : " · currently unindexed"}`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close index picker"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-300 text-xl text-white hover:border-primary-300">×</button>
                </div>

                <div className="space-y-4 p-5">
                    {warning && <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm leading-5 text-amber-200">{warning}</p>}
                    {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
                    {notice && <p className="rounded-xl border border-primary-400/20 bg-primary-500/10 p-3 text-sm text-primary-100">{notice}</p>}

                    <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus
                           placeholder="Search the catalog by number, name or identity key…"
                           className="w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white outline-none focus:border-primary-300" />

                    <div className="max-h-72 overflow-y-auto rounded-xl border border-line-300">
                        {searching && <p className="p-3 text-sm text-ink-400">Searching…</p>}
                        {!searching && !matches.length && <p className="p-3 text-sm text-ink-400">
                            {query.trim().length < 2 ? "Type at least two characters." : "No catalog entries match."}
                        </p>}
                        {matches.map((match) => (
                            <button key={match.species_profile_id} type="button" onClick={() => setChosen(match)}
                                    className={`flex w-full items-center justify-between gap-3 border-b border-line-300 px-3 py-2 text-left last:border-b-0 ${chosen?.species_profile_id === match.species_profile_id ? "bg-primary-500/15" : ""}`}>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold text-white">{match.display_name || match.normalized_identity_key}</span>
                                    <span className="block truncate text-xs italic text-ink-400">{match.scientific_name || "No scientific name"}</span>
                                </span>
                                <span className="shrink-0 text-right">
                                    <span className="block font-mono text-sm text-primary-100">
                                        {match.animaldex_number != null ? `#${match.animaldex_number}` : "unindexed"}
                                    </span>
                                    <span className="block text-[10px] uppercase text-ink-500">{match.identity_kind || "species"}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {chosen && chosen.animaldex_number == null && (
                        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">
                            That entry holds no AnimalDex number, so the capture will point at an unindexed profile and
                            will not show a number in the app.
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => void apply()} disabled={!chosen || applying}
                                className="rounded-xl bg-primary-500 px-5 py-3 text-sm font-black text-canvas-950 disabled:opacity-40">
                            {applying
                                ? "Moving…"
                                : chosen
                                    ? `Move ${captureIds.length > 1 ? `${captureIds.length} captures` : "capture"} to ${chosen.animaldex_number != null ? `#${chosen.animaldex_number}` : chosen.display_name}`
                                    : "Pick an entry"}
                        </button>
                        <p className="text-xs text-ink-500">
                            Rewrites this capture&apos;s identity and recomputes its game stats and the owner&apos;s totals.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
