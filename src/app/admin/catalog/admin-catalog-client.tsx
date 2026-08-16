"use client";

import Link from "next/link";
import {useCallback, useEffect, useState} from "react";
import BattleTierChip from "@/app/[locale]/(composited)/animals/battle-tier-chip";
import CatalogPanel from "@/app/admin/maintenance/catalog-panel";
import type {AnimalBattleTier} from "@/lib/battle-tier";

/**
 * The index as a browsable list: every catalog entry, what it resolves through,
 * what content it is still missing, where it publishes, and how many public
 * captures sit behind it — plus a scan for numbers that describe the same animal
 * twice.
 */

type LandingPage = {
    state: "own" | "shared" | "none";
    slug: string | null;
    path: string | null;
    hasPage: boolean;
    reason: string | null;
    hostedBy: {name: string; number: number | null; slug: string} | null;
};

type Artwork = {
    file: string | null;
    expectedPath: string;
    bucket: string;
    matchedVia: "exact" | "relative" | null;
};

type Entry = {
    speciesProfileId: string;
    number: number | null;
    displayName: string | null;
    animalName: string | null;
    scientificName: string | null;
    identityKey: string | null;
    slug: string | null;
    identityKind: string | null;
    identityKindLabel: string | null;
    identityResolutionMode: string | null;
    identityExplanation: string | null;
    identityEvidenceGuidance: string | null;
    parent: {number: number | null; name: string; kind: string | null} | null;
    catalogStatus: string | null;
    hasSubtitle: boolean;
    hasLesson: boolean;
    hasArtwork: boolean;
    artwork: Artwork;
    landingPage: LandingPage;
    tier: AnimalBattleTier | null;
    battlePower: number | null;
    publicCaptures: number;
    publicCapturesWithMedia: number;
    lastPublicCaptureAt: string | null;
};

type Summary = {indexed: number; unindexed: number; missingSubtitle: number; missingLesson: number};

type DuplicateMember = {
    speciesProfileId: string;
    number: number | null;
    displayName: string | null;
    scientificName: string | null;
    identityKey: string | null;
    identityKind: string | null;
    slug: string | null;
    publicCaptures: number;
};

type DuplicateGroup = {
    signal: string;
    label: string;
    verdict: string;
    key: string;
    members: DuplicateMember[];
};

const FILTERS = [
    {id: "indexed", label: "Indexed"},
    {id: "unindexed", label: "Unindexed"},
    {id: "missing-subtitle", label: "No subtitle"},
    {id: "missing-lesson", label: "No lesson"},
    {id: "missing-artwork", label: "No artwork of its own"},
    {id: "no-landing-page", label: "No page of its own"},
    {id: "all", label: "Everything"}
];

const SORTS = [
    {id: "number", label: "By number"},
    {id: "captures", label: "Most captured"},
    {id: "recent", label: "Recently captured"},
    {id: "name", label: "By name"}
];

/** Matches the app's chip tones, so a kind reads the same in both places. */
const KIND_TONE: Record<string, string> = {
    species: "bg-primary-500/15 text-primary-100",
    subspecies: "bg-primary-500/15 text-primary-100",
    genus: "bg-teal-400/15 text-teal-200",
    family: "bg-teal-400/15 text-teal-200",
    group: "bg-teal-400/15 text-teal-200",
    generic_parent: "bg-teal-400/15 text-teal-200",
    breed: "bg-sky-400/15 text-sky-200",
    variant: "bg-sky-400/15 text-sky-200",
    cross_breed: "bg-sky-400/15 text-sky-200",
    hybrid: "bg-sky-400/15 text-sky-200",
    domestic_parent: "bg-sky-400/15 text-sky-200",
    broad_fallback: "bg-amber-400/15 text-amber-200"
};

function Tick({on, label}: {on: boolean; label: string}) {
    return (
        <span title={on ? `${label} present` : `${label} missing`}
              className={`inline-block rounded-full px-2 py-1 text-[10px] font-black uppercase ${on ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>
            {label}
        </span>
    );
}

function LandingPageCell({page}: {page: LandingPage}) {
    if (page.state === "own" && page.path) {
        return (
            <a href={page.path} target="_blank" rel="noreferrer" className="block max-w-[16rem] truncate font-mono text-xs text-primary-100 hover:underline">
                {page.path}
            </a>
        );
    }

    if (page.state === "shared") {
        return (
            <div className="max-w-[16rem]">
                <span className="inline-block rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-black uppercase text-amber-200">Shares a page</span>
                {page.path && (
                    <a href={page.path} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[11px] text-ink-400 hover:underline">
                        {page.path}
                    </a>
                )}
                <span className="mt-1 block text-[11px] leading-4 text-ink-500">{page.reason}</span>
            </div>
        );
    }

    return (
        <div className="max-w-[16rem]">
            <span className="inline-block rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-200">No page</span>
            <span className="mt-1 block text-[11px] leading-4 text-ink-500">{page.reason}</span>
        </div>
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
    const [duplicates, setDuplicates] = useState<{duplicates: DuplicateGroup[]; related: DuplicateGroup[]; scanned: number} | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

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

    const scan = useCallback(async () => {
        setScanning(true);
        setScanError(null);
        try {
            const response = await fetch("/api/admin/catalog/duplicates", {cache: "no-store"});
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to scan the catalog");
            setDuplicates(payload);
        } catch (caught) {
            setScanError(caught instanceof Error ? caught.message : "Unable to scan the catalog");
        } finally {
            setScanning(false);
        }
    }, []);

    const pageCount = total != null ? Math.max(1, Math.ceil(total / 50)) : 1;

    const groupCard = (group: DuplicateGroup) => (
        <div key={`${group.signal}:${group.key}`} className="rounded-2xl border border-line-300 bg-surface-900 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${group.verdict === "duplicate" ? "bg-red-500/15 text-red-200" : "bg-amber-400/15 text-amber-200"}`}>
                    {group.label}
                </span>
                <span className="font-mono text-xs text-ink-400">{group.key}</span>
            </div>
            <ul className="mt-3 space-y-2">
                {group.members.map((member) => (
                    <li key={member.speciesProfileId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-300/60 px-3 py-2">
                        <span className="min-w-0">
                            <span className="font-mono text-sm text-primary-100">{member.number != null ? `#${member.number}` : "—"}</span>
                            <span className="ml-2 text-sm font-bold text-white">{member.displayName}</span>
                            <span className="ml-2 text-xs text-ink-500">{member.identityKind}</span>
                            <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-500">{member.identityKey}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                            <span className="text-xs text-ink-400">{member.publicCaptures.toLocaleString()} public</span>
                            {member.slug && (
                                <a href={`/animals/${member.slug}`} target="_blank" rel="noreferrer"
                                   className="text-xs font-bold text-ink-400 hover:text-white">page ↗</a>
                            )}
                            <button type="button"
                                    onClick={() => setEditing({speciesProfileId: member.speciesProfileId} as Entry)}
                                    className="rounded-lg border border-primary-400/40 px-2.5 py-1.5 text-xs font-black text-primary-100">Edit</button>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );

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

                <section className="mt-6 rounded-2xl border border-line-300 bg-surface-900 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Duplicate check</p>
                            <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-400">
                                Two numbers for one animal split its captures between them. This groups indexed entries
                                that share an identity key, a slug, a name, or a scientific name — the last of which is
                                usually a family (a breed beside its parent) rather than a mistake.
                            </p>
                        </div>
                        <button type="button" onClick={() => void scan()} disabled={scanning}
                                className="rounded-xl border border-primary-400/40 px-4 py-2.5 text-sm font-black text-primary-100 disabled:opacity-40">
                            {scanning ? "Scanning…" : duplicates ? "Scan again" : "Scan the index"}
                        </button>
                    </div>

                    {scanError && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{scanError}</p>}

                    {duplicates && (
                        <div className="mt-4 space-y-4">
                            <p className="text-sm text-ink-400">
                                Scanned {duplicates.scanned.toLocaleString()} indexed entries ·{" "}
                                <span className="font-bold text-white">{duplicates.duplicates.length}</span> likely duplicate
                                {duplicates.duplicates.length === 1 ? "" : "s"} ·{" "}
                                <span className="font-bold text-white">{duplicates.related.length}</span> related group
                                {duplicates.related.length === 1 ? "" : "s"}
                            </p>

                            {!duplicates.duplicates.length && !duplicates.related.length && (
                                <p className="text-sm text-ink-400">Nothing shares an identity.</p>
                            )}

                            {duplicates.duplicates.length > 0 && (
                                <div className="grid gap-3 xl:grid-cols-2">{duplicates.duplicates.map(groupCard)}</div>
                            )}

                            {duplicates.related.length > 0 && (
                                <details className="rounded-2xl border border-line-300/60 p-3">
                                    <summary className="cursor-pointer text-sm font-bold text-ink-300">
                                        Related entries ({duplicates.related.length})
                                    </summary>
                                    <div className="mt-3 grid gap-3 xl:grid-cols-2">{duplicates.related.map(groupCard)}</div>
                                </details>
                            )}
                        </div>
                    )}
                </section>

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
                    <table className="w-full min-w-[82rem] text-left text-sm">
                        <thead>
                            <tr className="border-b border-line-300 text-[11px] font-black uppercase tracking-[.14em] text-ink-500">
                                <th className="p-3">#</th>
                                <th className="p-3">Animal</th>
                                <th className="p-3">Identity key</th>
                                <th className="p-3">Identity level</th>
                                <th className="p-3">Tier</th>
                                <th className="p-3">Landing page</th>
                                <th className="p-3 text-right">Public captures</th>
                                <th className="p-3">Content</th>
                                <th className="p-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {!entries.length && !loading && (
                                <tr><td colSpan={9} className="p-10 text-center text-ink-400">No entries match.</td></tr>
                            )}
                            {entries.map((entry) => (
                                <tr key={entry.speciesProfileId} className="border-b border-line-300/60 last:border-0 align-top">
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
                                    <td className="p-3">
                                        <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-black uppercase ${KIND_TONE[entry.identityKind ?? ""] ?? "bg-white/5 text-ink-400"}`}
                                              title={entry.identityExplanation ?? undefined}>
                                            {entry.identityKindLabel ?? entry.identityKind ?? "no chip"}
                                        </span>
                                        {entry.parent && (
                                            <span className="mt-1 block text-[11px] leading-4 text-ink-400">
                                                a form of {entry.parent.number != null ? `#${entry.parent.number} ` : ""}{entry.parent.name}
                                            </span>
                                        )}
                                        <span className="mt-1 block text-[11px] text-ink-500">
                                            status {entry.catalogStatus ?? "unset"}
                                            {entry.identityResolutionMode ? ` · ${entry.identityResolutionMode}` : ""}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {entry.tier
                                            ? <span title={`Battle power ${entry.battlePower}`}><BattleTierChip tier={entry.tier} compact /></span>
                                            : <span className="text-xs text-ink-500">no stats</span>}
                                    </td>
                                    <td className="p-3"><LandingPageCell page={entry.landingPage} /></td>
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
                                            <Tick on={entry.artwork.matchedVia === "exact"} label="art" />
                                        </div>
                                        {entry.artwork.matchedVia !== "exact" && (
                                            <span className="mt-1 block max-w-[15rem] text-[11px] leading-4 text-ink-500">
                                                {entry.artwork.matchedVia === "relative"
                                                    ? <>borrowing <span className="font-mono">{entry.artwork.file}</span>; upload <span className="font-mono">{entry.artwork.expectedPath}</span></>
                                                    : <>upload <span className="font-mono">{entry.artwork.expectedPath}</span></>}
                                            </span>
                                        )}
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
