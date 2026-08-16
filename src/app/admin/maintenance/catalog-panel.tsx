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
    catalog_status: string | null;
    canonical_game_stats: Record<string, number> | null;
    species_subtitle_story: string | null;
    principle_name: string | null;
    principle_expression: string | null;
    short_motto: string | null;
    public_capture_count: number | null;
    aliases: Array<{alias_identity_key: string; notes: string | null; source: string | null}>;
    artwork: {slug: string | null; present: boolean};
};

const STATS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

export default function CatalogPanel({onClose}: {onClose: () => void}) {
    const [query, setQuery] = useState("");
    const [matches, setMatches] = useState<Match[]>([]);
    const [entry, setEntry] = useState<Entry | null>(null);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [stats, setStats] = useState<Record<string, number>>({});
    const [alias, setAlias] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

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
            shortMotto: loaded.short_motto ?? ""
        });
        setStats(Object.fromEntries(STATS.map((key) => [key, Number(loaded.canonical_game_stats?.[key] ?? 0)])));
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

    async function save(extra: Record<string, unknown> = {}) {
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
                    ...extra
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to save");
            hydrate(payload.entry);
            setAlias("");
            setNotice(`Saved: ${payload.applied.join(", ") || "no changes"}.`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to save");
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
                                <button type="button" onClick={() => setEntry(null)} className="ml-auto text-xs font-bold text-ink-400 hover:text-white">← back to search</button>
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
