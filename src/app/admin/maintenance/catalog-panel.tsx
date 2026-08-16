"use client";

import {useEffect, useState} from "react";

/**
 * Fill in what an AnimalDex number implies: subtitle, core lesson, stats,
 * aliases, artwork. Previously a hand-written migration per animal.
 */

type Match = {
    species_profile_id: string;
    animaldex_number: number | null;
    display_name: string | null;
    scientific_name: string | null;
    normalized_identity_key: string | null;
    species_subtitle: string | null;
    core_lesson: string | null;
};

type Entry = Match & {
    landing_page_slug: string | null;
    identity_kind: string | null;
    identity_resolution_mode: string | null;
    identity_explanation: string | null;
    identity_evidence_guidance: string | null;
    catalog_status: string | null;
    canonical_game_stats: Record<string, number> | null;
    species_subtitle_story: string | null;
    principle_name: string | null;
    principle_expression: string | null;
    short_motto: string | null;
    public_capture_count: number | null;
    aliases: Array<{alias_identity_key: string; notes: string | null; source: string | null}>;
    artwork: {
        slug: string | null;
        present: boolean;
        file: string | null;
        expectedPath: string | null;
        matchedVia: "exact" | "relative" | null;
        url: string | null;
    };
};

const STATS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

/**
 * What each identity level claims, in the terms the decision is actually made
 * in. The app tints and labels only these; anything else shows no chip at all.
 */
const IDENTITY_KINDS: Array<{id: string; label: string; hint: string}> = [
    {id: "species", label: "Species", hint: "A single species, named and certain."},
    {id: "subspecies", label: "Subspecies", hint: "A named subspecies of an indexed species."},
    {id: "genus", label: "Genus", hint: "The genus is certain, the species is not."},
    {id: "family", label: "Family", hint: "Identified no further than the family."},
    {id: "group", label: "Group", hint: "A group of species people name as one animal — \"black ant\", \"seagull\"."},
    {id: "breed", label: "Breed", hint: "A breed of a domestic animal, e.g. Pekin Duck."},
    {id: "variant", label: "Variant", hint: "A colour or coat form rather than a breed."},
    {id: "cross_breed", label: "Cross breed", hint: "A deliberate cross, e.g. Flowerhorn Cichlid."},
    {id: "hybrid", label: "Hybrid", hint: "A hybrid of two species."},
    {id: "domestic_parent", label: "Domestic parent", hint: "The domestic species every breed of it folds into — Domestic Cat, Cow."},
    {id: "generic_parent", label: "Generic parent", hint: "A catch-all entry that specific species will later be split out of."},
    {id: "broad_fallback", label: "Broad fallback", hint: "Identified only in the broadest terms; the last resort."}
];

const RESOLUTION_MODES: Array<{id: string; label: string; hint: string}> = [
    {id: "terminal", label: "Terminal", hint: "As specific as this animal gets. No retake will sharpen it."},
    {id: "refinable", label: "Refinable", hint: "A closer capture could resolve it further; the app says so."}
];

type PanelProps = {
    onClose: () => void;
    /** Opens straight into an entry, for the catalog list's Edit button. */
    initialSpeciesProfileId?: string;
};

export default function CatalogPanel({onClose, initialSpeciesProfileId}: PanelProps) {
    const [query, setQuery] = useState("");
    const [matches, setMatches] = useState<Match[]>([]);
    const [entry, setEntry] = useState<Entry | null>(null);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [stats, setStats] = useState<Record<string, number>>({});
    const [alias, setAlias] = useState("");
    const [numberDraft, setNumberDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        if (initialSpeciesProfileId) void open(initialSpeciesProfileId);
        // Opening the given entry is a mount-time action; `open` is stable enough
        // for that and re-running on its identity would refetch on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSpeciesProfileId]);

    useEffect(() => {
        const term = query.trim();
        if (term.length < 2) { setMatches([]); return; }

        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/admin/maintenance/catalog?q=${encodeURIComponent(term)}`, {cache: "no-store"});
                const payload = await response.json();
                if (!response.ok || !payload.ok) throw new Error(payload.error || "Catalog search failed");
                setMatches(payload.matches);
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Catalog search failed");
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [query]);

    function hydrate(loaded: Entry) {
        setEntry(loaded);
        setDraft({
            subtitle: loaded.species_subtitle ?? "",
            subtitleStory: loaded.species_subtitle_story ?? "",
            principleName: loaded.principle_name ?? "",
            coreLesson: loaded.core_lesson ?? "",
            principleExpression: loaded.principle_expression ?? "",
            shortMotto: loaded.short_motto ?? "",
            identityKind: loaded.identity_kind ?? "",
            identityResolutionMode: loaded.identity_resolution_mode ?? "",
            identityExplanation: loaded.identity_explanation ?? "",
            identityEvidenceGuidance: loaded.identity_evidence_guidance ?? "",
            landingPageSlug: loaded.landing_page_slug ?? ""
        });
        setStats(Object.fromEntries(STATS.map((key) => [key, Number(loaded.canonical_game_stats?.[key] ?? 0)])));
    }

    /**
     * Identity fields are sent only when they changed. Entries carry kinds the
     * app no longer renders, and echoing one back on an unrelated subtitle edit
     * would fail validation for a value the operator never touched.
     */
    function changedIdentityFields(loaded: Entry) {
        const changes: Record<string, string | null> = {};
        const pairs: Array<[string, string, string | null]> = [
            ["identityKind", "identityKind", loaded.identity_kind],
            ["identityResolutionMode", "identityResolutionMode", loaded.identity_resolution_mode],
            ["identityExplanation", "identityExplanation", loaded.identity_explanation],
            ["identityEvidenceGuidance", "identityEvidenceGuidance", loaded.identity_evidence_guidance]
        ];

        for (const [draftKey, bodyKey, current] of pairs) {
            const next = (draft[draftKey] ?? "").trim();
            if (next !== (current ?? "").trim()) changes[bodyKey] = next || null;
        }

        return changes;
    }

    async function open(speciesProfileId: string) {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch(`/api/admin/maintenance/catalog?speciesProfileId=${speciesProfileId}`, {cache: "no-store"});
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load that entry");
            hydrate(payload.entry);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load that entry");
        } finally {
            setBusy(false);
        }
    }

    /** Two-step because it can strand captures; the API refuses the first attempt. */
    async function releaseNumber() {
        if (!entry) return;
        const first = await save({setNumber: null}, true);

        if (first?.needsConfirmation) {
            if (!window.confirm(`${first.error}\n\nRelease it anyway?`)) return;
            await save({setNumber: null, confirmNumberChange: true});
        }
    }

    async function save(extra: Record<string, unknown> = {}, quiet = false) {
        if (!entry) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/maintenance/catalog", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    speciesProfileId: entry.species_profile_id,
                    subtitle: draft.subtitle,
                    subtitleStory: draft.subtitleStory,
                    principleName: draft.principleName,
                    coreLesson: draft.coreLesson,
                    principleExpression: draft.principleExpression,
                    shortMotto: draft.shortMotto,
                    stats,
                    ...changedIdentityFields(entry),
                    ...extra
                })
            });
            const payload = await response.json();

            if (!response.ok || !payload.ok) {
                // A refusal the caller expects to handle, rather than an error.
                if (quiet && payload.needsConfirmation) return payload;
                throw new Error(payload.error || "Unable to save");
            }

            hydrate(payload.entry);
            setAlias("");
            setNumberDraft("");
            setNotice(`Saved: ${payload.applied.join(", ") || "no changes"}.`);
            return payload;
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to save");
            return null;
        } finally {
            setBusy(false);
        }
    }

    const field = (id: string, label: string, rows = 2) => (
        <label className="block">
            <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">{label}</span>
            <textarea value={draft[id] ?? ""} rows={rows}
                      onChange={(event) => setDraft((current) => ({...current, [id]: event.target.value}))}
                      className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300" />
        </label>
    );

    return (
        <div role="dialog" aria-modal="true" aria-label="Catalog entry editor"
             className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-8"
             onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line-300 bg-canvas-950 shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-line-300 px-5 py-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[.16em] text-primary-200">Index management</p>
                        <h2 className="font-display text-2xl text-white">Catalog entries</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close catalog editor"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-line-300 text-xl text-white hover:border-primary-300">×</button>
                </div>

                <div className="space-y-4 p-5">
                    {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
                    {notice && <p className="rounded-xl border border-primary-400/20 bg-primary-500/10 p-3 text-sm text-primary-100">{notice}</p>}

                    <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus
                           placeholder="Search by AnimalDex number, name or identity key…"
                           className="w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white outline-none focus:border-primary-300" />

                    {!entry && (
                        <div className="max-h-72 overflow-y-auto rounded-xl border border-line-300">
                            {!matches.length && <p className="p-3 text-sm text-ink-400">
                                {query.trim().length < 2 ? "Type at least two characters." : "No entries match."}
                            </p>}
                            {matches.map((match) => (
                                <button key={match.species_profile_id} type="button" onClick={() => void open(match.species_profile_id)}
                                        className="flex w-full items-center justify-between gap-3 border-b border-line-300 px-3 py-2 text-left last:border-b-0 hover:bg-white/[.03]">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-white">{match.display_name}</span>
                                        <span className="block truncate text-xs text-ink-400">
                                            {match.species_subtitle ? "subtitle ✓" : "no subtitle"} · {match.core_lesson ? "lesson ✓" : "no lesson"}
                                        </span>
                                    </span>
                                    <span className="shrink-0 font-mono text-sm text-primary-100">
                                        {match.animaldex_number != null ? `#${match.animaldex_number}` : "unindexed"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {entry && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-300 bg-surface-900 p-4">
                                <span className="font-mono text-lg text-primary-100">
                                    {entry.animaldex_number != null ? `#${entry.animaldex_number}` : "unindexed"}
                                </span>
                                <span className="font-display text-xl text-white">{entry.display_name}</span>
                                <span className="text-sm italic text-ink-400">{entry.scientific_name}</span>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${entry.artwork.present ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>
                                    {entry.artwork.present ? "artwork ✓" : "artwork missing"}
                                </span>
                                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-ink-400">{entry.catalog_status}</span>
                                {!initialSpeciesProfileId && <button type="button" onClick={() => setEntry(null)} className="ml-auto text-xs font-bold text-ink-400 hover:text-white">← back to search</button>}
                            </div>

                            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">AnimalDex number</p>
                                <p className="mt-1 text-xs leading-5 text-ink-500">
                                    Releasing a number frees it for the next animal indexed. Captures pointing here lose
                                    their index until they are moved, so the panel asks again when any exist.
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <input type="number" min={1} value={numberDraft}
                                           onChange={(event) => setNumberDraft(event.target.value)}
                                           placeholder="e.g. 1008"
                                           className="w-32 rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white" />
                                    <button type="button" onClick={() => void save({setNumber: Number(numberDraft)})}
                                            disabled={busy || !numberDraft.trim()}
                                            className="rounded-xl border border-line-300 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Set number</button>
                                    <button type="button" onClick={() => void save({setNumber: "next"})} disabled={busy}
                                            className="rounded-xl border border-line-300 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Use next free</button>
                                    {entry.animaldex_number != null && (
                                        <button type="button" onClick={() => void releaseNumber()} disabled={busy}
                                                className="rounded-xl border border-red-400/40 px-3 py-2 text-sm font-black text-red-200 disabled:opacity-40">
                                            Release #{entry.animaldex_number}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Identity level</p>
                                <p className="mt-1 text-xs leading-5 text-ink-500">
                                    The chip on the capture card, and the sentence behind its ⓘ. Leave the explanation
                                    empty and the app writes its own; fill it in and it uses yours instead, which is
                                    where an entry says why it stops at group level.
                                </p>

                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Kind</span>
                                        <select value={draft.identityKind ?? ""}
                                                onChange={(event) => setDraft((current) => ({...current, identityKind: event.target.value}))}
                                                className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white">
                                            <option value="">No chip shown</option>
                                            {IDENTITY_KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
                                            {/* An older kind the app no longer renders still needs to round-trip. */}
                                            {entry.identity_kind && !IDENTITY_KINDS.some((kind) => kind.id === entry.identity_kind) && (
                                                <option value={entry.identity_kind}>{entry.identity_kind} (unrendered)</option>
                                            )}
                                        </select>
                                        <span className="mt-1 block text-xs leading-5 text-ink-500">
                                            {IDENTITY_KINDS.find((kind) => kind.id === draft.identityKind)?.hint
                                                ?? "No identity chip appears on captures of this animal."}
                                        </span>
                                    </label>

                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Resolution</span>
                                        <select value={draft.identityResolutionMode ?? ""}
                                                onChange={(event) => setDraft((current) => ({...current, identityResolutionMode: event.target.value}))}
                                                className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white">
                                            <option value="">Unset — inferred from the kind</option>
                                            {RESOLUTION_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                                        </select>
                                        <span className="mt-1 block text-xs leading-5 text-ink-500">
                                            {RESOLUTION_MODES.find((mode) => mode.id === draft.identityResolutionMode)?.hint
                                                ?? "Group and genus default to refinable; everything else to terminal."}
                                        </span>
                                    </label>
                                </div>

                                <div className="mt-3 space-y-3">
                                    {field("identityExplanation", "Chip explanation", 3)}
                                    {field("identityEvidenceGuidance", "Capture guidance", 2)}
                                </div>
                            </div>

                            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Landing page</p>
                                <p className="mt-1 text-xs leading-5 text-ink-500">
                                    The slug this entry publishes at. Entries whose identity key is an alias of another
                                    animal fold into that animal&apos;s page instead; giving this one its own slug splits them.
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm text-ink-500">/animals/</span>
                                    <input value={draft.landingPageSlug ?? ""}
                                           onChange={(event) => setDraft((current) => ({...current, landingPageSlug: event.target.value}))}
                                           placeholder={entry.normalized_identity_key?.replace(/_/g, "-") ?? "slug"}
                                           className="min-w-0 flex-1 rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 font-mono text-sm text-white outline-none focus:border-primary-300" />
                                    <button type="button" onClick={() => void save({landingPageSlug: draft.landingPageSlug || null})}
                                            disabled={busy || (draft.landingPageSlug ?? "") === (entry.landing_page_slug ?? "")}
                                            className="rounded-xl border border-line-300 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
                                        Save slug
                                    </button>
                                    {entry.landing_page_slug && (
                                        <a href={`/animals/${entry.landing_page_slug}`} target="_blank" rel="noreferrer"
                                           className="rounded-xl border border-primary-400/40 px-3 py-2 text-sm font-bold text-primary-100">View page ↗</a>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Artwork</p>
                                {entry.artwork.matchedVia === "exact" && (
                                    <p className="mt-2 text-sm text-primary-100">
                                        Own illustration at <span className="font-mono text-xs">{entry.artwork.expectedPath}</span>
                                    </p>
                                )}
                                {entry.artwork.matchedVia === "relative" && (
                                    <p className="mt-2 text-sm text-amber-200">
                                        Borrowing <span className="font-mono text-xs">{entry.artwork.file}</span> — nothing exists at{" "}
                                        <span className="font-mono text-xs">{entry.artwork.expectedPath}</span>, so a relative&apos;s
                                        picture is standing in.
                                    </p>
                                )}
                                {!entry.artwork.present && (
                                    <p className="mt-2 text-sm text-red-200">
                                        Nothing in the bucket. Upload a .webp to{" "}
                                        <span className="font-mono text-xs">{entry.artwork.expectedPath ?? "an artwork slug"}</span>.
                                    </p>
                                )}
                                {entry.artwork.url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={entry.artwork.url} alt="" className="mt-3 h-24 w-24 rounded-xl bg-canvas-900 object-contain" />
                                )}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-3 rounded-xl border border-line-300 bg-surface-900 p-4">
                                    {field("subtitle", "Subtitle")}
                                    {field("subtitleStory", "Subtitle story", 3)}
                                </div>
                                <div className="space-y-3 rounded-xl border border-line-300 bg-surface-900 p-4">
                                    {field("principleName", "Principle name", 1)}
                                    {field("coreLesson", "Core lesson", 3)}
                                    {field("shortMotto", "Short motto", 1)}
                                </div>
                            </div>

                            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Canonical stats</p>
                                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                    {STATS.map((key) => (
                                        <label key={key} className="block">
                                            <span className="text-xs capitalize text-ink-400">{key}</span>
                                            <input type="number" min={0} max={100} value={stats[key] ?? 0}
                                                   onChange={(event) => setStats((current) => ({...current, [key]: Number(event.target.value)}))}
                                                   className="mt-1 w-full rounded-lg border border-line-300 bg-canvas-900 px-2 py-2 text-sm text-white" />
                                        </label>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-ink-500">Calibrate against neighbouring numbers; size also sets size_scale_score.</p>
                            </div>

                            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Aliases</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {!entry.aliases.length && <span className="text-sm text-ink-400">No aliases.</span>}
                                    {entry.aliases.map((row) => (
                                        <span key={row.alias_identity_key} className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-ink-100">
                                            <span className="font-mono">{row.alias_identity_key}</span>
                                            <button type="button" onClick={() => void save({removeAlias: row.alias_identity_key})}
                                                    className="text-ink-400 hover:text-red-200" aria-label={`Remove ${row.alias_identity_key}`}>×</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <input value={alias} onChange={(event) => setAlias(event.target.value)}
                                           placeholder="another name for this animal, e.g. nutria"
                                           className="min-w-0 flex-1 rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300" />
                                    <button type="button" onClick={() => void save({addAlias: alias})} disabled={!alias.trim() || busy}
                                            className="rounded-xl border border-line-300 px-4 text-sm font-bold text-white disabled:opacity-40">Add</button>
                                </div>
                            </div>

                            <button type="button" onClick={() => void save()} disabled={busy}
                                    className="rounded-xl bg-primary-500 px-5 py-3 text-sm font-black text-canvas-950 disabled:opacity-40">
                                {busy ? "Saving…" : "Save entry"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
