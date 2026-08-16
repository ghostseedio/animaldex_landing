"use client";

import Link from "next/link";
import {useCallback, useEffect, useState} from "react";
import CatalogPanel from "@/app/admin/maintenance/catalog-panel";

/**
 * The index as a browsable list: every catalog entry, what it resolves through,
 * what content it is still missing, and how many public captures sit behind it.
 */

type Entry = {
    speciesProfileId: string;
    number: number | null;
    displayName: string | null;
    animalName: string | null;
    scientificName: string | null;
    identityKey: string | null;
    slug: string | null;
    identityKind: string | null;
    catalogStatus: string | null;
    hasSubtitle: boolean;
    hasLesson: boolean;
    hasArtwork: boolean;
    publicCaptures: number;
    publicCapturesWithMedia: number;
    lastPublicCaptureAt: string | null;
};

type Summary = {indexed: number; unindexed: number; missingSubtitle: number; missingLesson: number};

const FILTERS = [
    {id: "indexed", label: "Indexed"},
    {id: "unindexed", label: "Unindexed"},
    {id: "missing-subtitle", label: "No subtitle"},
    {id: "missing-lesson", label: "No lesson"},
    {id: "missing-artwork", label: "No artwork"},
    {id: "all", label: "Everything"}
];

const SORTS = [
    {id: "number", label: "By number"},
    {id: "captures", label: "Most captured"},
    {id: "recent", label: "Recently captured"},
    {id: "name", label: "By name"}
];

function Tick({on, label}: {on: boolean; label: string}) {
    return (
        <span title={on ? `${label} present` : `${label} missing`}
              className={`inline-block rounded-full px-2 py-1 text-[10px] font-black uppercase ${on ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>
            {label}
        </span>
    );
}

export default function AdminCatalogClient() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [total, setTotal] = useState<number | null>(null);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("indexed");
    const [sort, setSort] = useState("number");
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<Entry | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                q: query.trim(),
                filter,
                sort,
                page: String(page),
                summary: summary ? "0" : "1"
            });
            const response = await fetch(`/api/admin/catalog?${params}`, {cache: "no-store"});
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load the catalog");
            setEntries(payload.entries);
            setTotal(payload.total);
            if (payload.summary) setSummary(payload.summary);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load the catalog");
        } finally {
            setLoading(false);
        }
        // `summary` is read only to decide whether to ask for it again, so it is
        // deliberately not a dependency: including it would refetch on arrival.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, filter, sort, page]);

    useEffect(() => { void load(); }, [load]);

    const pageCount = total != null ? Math.max(1, Math.ceil(total / 50)) : 1;

    return (
        <main className="min-h-screen p-4 sm:p-7">
            <div className="mx-auto max-w-[110rem]">
                <header className="flex flex-col justify-between gap-5 border-b border-line-300 pb-6 lg:flex-row lg:items-end">
                    <div>
                        <Link href="/admin" className="text-sm text-ink-400 hover:text-white">← Admin</Link>
                        <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-primary-200">Catalog</p>
                        <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Index management</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
                            Every AnimalDex entry, what captures resolve through, and what each one is still missing.
                        </p>
                    </div>
                    <Link href="/admin/maintenance" className="w-fit rounded-xl border border-line-300 px-4 py-2.5 text-sm font-bold text-white hover:border-primary-300">
                        Post maintenance →
                    </Link>
                </header>

                {summary && (
                    <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                        {[
                            ["Indexed animals", summary.indexed],
                            ["Unindexed profiles", summary.unindexed],
                            ["Indexed, no subtitle", summary.missingSubtitle],
                            ["Indexed, no lesson", summary.missingLesson]
                        ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-2xl border border-line-300 bg-surface-900 p-4">
                                <p className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">{label}</p>
                                <p className="mt-1 font-display text-2xl text-white">{Number(value).toLocaleString()}</p>
                            </div>
                        ))}
                    </section>
                )}

                <section className="mt-6 grid gap-3 rounded-2xl border border-line-300 bg-surface-900 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input value={query} onChange={(event) => {setQuery(event.target.value); setPage(0);}}
                           placeholder="Search by number, name, scientific name or identity key…"
                           className="min-w-0 rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white outline-none focus:border-primary-300" />
                    <select value={filter} onChange={(event) => {setFilter(event.target.value); setPage(0);}}
                            className="rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white">
                        {FILTERS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <select value={sort} onChange={(event) => {setSort(event.target.value); setPage(0);}}
                            className="rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white">
                        {SORTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                </section>

                {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-400">
                        {total != null ? `${total.toLocaleString()} entries` : "…"}{loading ? " · loading" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}
                                className="rounded-xl border border-line-300 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">←</button>
                        <span className="text-sm text-ink-400">Page {page + 1} of {pageCount}</span>
                        <button onClick={() => setPage((current) => current + 1)} disabled={page + 1 >= pageCount || loading}
                                className="rounded-xl border border-line-300 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">→</button>
                    </div>
                </div>

                <section className="mt-3 overflow-x-auto rounded-2xl border border-line-300 bg-surface-900">
                    <table className="w-full min-w-[64rem] text-left text-sm">
                        <thead>
                            <tr className="border-b border-line-300 text-[11px] font-black uppercase tracking-[.14em] text-ink-500">
                                <th className="p-3">#</th>
                                <th className="p-3">Animal</th>
                                <th className="p-3">Identity key</th>
                                <th className="p-3">Kind</th>
                                <th className="p-3 text-right">Public captures</th>
                                <th className="p-3">Content</th>
                                <th className="p-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {!entries.length && !loading && (
                                <tr><td colSpan={7} className="p-10 text-center text-ink-400">No entries match.</td></tr>
                            )}
                            {entries.map((entry) => (
                                <tr key={entry.speciesProfileId} className="border-b border-line-300/60 last:border-0">
                                    <td className="p-3 font-mono text-primary-100">
                                        {entry.number != null ? `#${entry.number}` : "—"}
                                    </td>
                                    <td className="p-3">
                                        <span className="block font-bold text-white">{entry.displayName}</span>
                                        <span className="block text-xs italic text-ink-400">{entry.scientificName || "No scientific name"}</span>
                                    </td>
                                    <td className="p-3">
                                        <span className="block font-mono text-xs text-ink-300">{entry.identityKey}</span>
                                        {entry.slug && entry.slug !== entry.identityKey && (
                                            <span className="block font-mono text-[11px] text-ink-500">/{entry.slug}</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-xs text-ink-400">
                                        {entry.identityKind || "species"}
                                        <span className="block text-[11px] text-ink-500">{entry.catalogStatus}</span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className="font-display text-lg text-white">{entry.publicCaptures.toLocaleString()}</span>
                                        {entry.publicCapturesWithMedia > 0 && (
                                            <span className="block text-[11px] text-ink-500">{entry.publicCapturesWithMedia} with photo</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                            <Tick on={entry.hasSubtitle} label="subtitle" />
                                            <Tick on={entry.hasLesson} label="lesson" />
                                            <Tick on={entry.hasArtwork} label="art" />
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => setEditing(entry)}
                                                className="rounded-xl border border-primary-400/40 px-3 py-2 text-xs font-black text-primary-100">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>

            {editing && (
                <CatalogPanel
                    initialSpeciesProfileId={editing.speciesProfileId}
                    onClose={() => { setEditing(null); void load(); }}
                />
            )}
        </main>
    );
}
