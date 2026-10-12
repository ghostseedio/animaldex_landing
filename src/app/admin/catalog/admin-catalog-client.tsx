"use client";

import Link from "next/link";
import {useCallback, useEffect, useState} from "react";
import BattleTierChip from "@/app/[locale]/(composited)/animals/battle-tier-chip";
import CatalogPanel from "@/app/admin/maintenance/catalog-panel";
import NotifyOwnerDialog, {type NotifyRequest} from "@/app/admin/maintenance/notify-owner-dialog";
import IndexNewAnimal from "@/app/admin/catalog/index-new-animal";
import type {AnimalBattleTier} from "@/lib/battle-tier";
import {AdminPage, Alert, Badge, Button, buttonVariants, Card, CardContent, CardHeader, cn, EmptyState, fieldClass, LoadingRow, PageHeader, RefreshButton, Section, Skeleton, Spinner, Stat, StatGrid, StatGridSkeleton, Table, TableSkeleton, TD, TH} from "@/components/admin/ui";

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
        <Badge tone={on ? "good" : "bad"} title={on ? `${label} present` : `${label} missing`}>
            {label}
        </Badge>
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
                <Badge tone="warn">Shares a page</Badge>
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
            <Badge tone="bad">No page</Badge>
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
    const [indexingNew, setIndexingNew] = useState(false);
    const [notifyRequest, setNotifyRequest] = useState<NotifyRequest | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [folding, setFolding] = useState<string | null>(null);

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

    /**
     * Hand a breed's number back to the animal it is a breed of. The preview
     * comes from the server rather than being guessed here, because the cost
     * that matters — members who hold both and so lose a dex entry — is only
     * knowable by looking.
     */
    async function fold(speciesProfileId: string) {
        setFolding(speciesProfileId);
        setError(null);
        setNotice(null);
        try {
            const preview = await fetch("/api/admin/catalog/fold", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({speciesProfileId})
            });
            const previewBody = await preview.json();

            if (!previewBody.needsConfirmation) {
                throw new Error(previewBody.error || "Unable to fold this entry");
            }

            const {entry, parent, captures, members, membersLosingAnEntry} = previewBody.preview;
            const warning = membersLosingAnEntry
                ? `\n\n${membersLosingAnEntry} member(s) hold both and will end up with one entry where they had two.`
                : "";

            if (!window.confirm(
                `Give #${entry.number} back and count ${entry.displayName} as ${parent.displayName} #${parent.number}?\n\n`
                + `${captures} capture(s) across ${members} member(s) keep their identification and start counting as #${parent.number}.`
                + `${warning}\n\nThe entry itself stays; only its number is released.`
            )) return;

            const applied = await fetch("/api/admin/catalog/fold", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({speciesProfileId, confirm: true})
            });
            const appliedBody = await applied.json();
            if (!applied.ok || !appliedBody.ok) throw new Error(appliedBody.error || "Unable to fold this entry");

            setNotice(`#${appliedBody.released} released — ${entry.displayName} now counts as ${parent.displayName} #${parent.number}. ${appliedBody.recomputed} capture(s) recomputed.`);
            await load();
            await scan();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to fold this entry");
        } finally {
            setFolding(null);
        }
    }

    const pageCount = total != null ? Math.max(1, Math.ceil(total / 50)) : 1;

    const groupCard = (group: DuplicateGroup) => (
        <Card key={`${group.signal}:${group.key}`} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone={group.verdict === "duplicate" ? "bad" : "warn"}>
                    {group.label}
                </Badge>
                <span className="font-mono text-xs text-ink-400">{group.key}</span>
            </div>
            <ul className="mt-3 divide-y divide-line-300/60 border-y border-line-300/60">
                {group.members.map((member) => (
                    <li key={member.speciesProfileId} className="flex flex-wrap items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                            <span className="font-mono text-sm tabular-nums text-primary-100">{member.number != null ? `#${member.number}` : "—"}</span>
                            <span className="ml-2 text-sm font-bold text-white">{member.displayName}</span>
                            <span className="ml-2 text-xs text-ink-500">{member.identityKind}</span>
                            <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-500">{member.identityKey}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                            <span className="text-xs tabular-nums text-ink-400">{member.publicCaptures.toLocaleString()} public</span>
                            {member.slug && (
                                <a href={`/animals/${member.slug}`} target="_blank" rel="noreferrer"
                                   className="px-1 text-xs font-bold text-ink-400 hover:text-white">page ↗</a>
                            )}
                            {member.number != null && ["breed", "variant", "subspecies"].includes(member.identityKind ?? "") && (
                                <Button size="sm" onClick={() => void fold(member.speciesProfileId)}
                                        loading={folding === member.speciesProfileId}
                                        disabled={folding !== null}
                                        title="Release this number and count these captures as the parent animal"
                                        className="border-amber-400/40 text-amber-200 hover:border-amber-300">
                                    {folding === member.speciesProfileId ? "Folding…" : "Fold into parent"}
                                </Button>
                            )}
                            <Button size="sm"
                                    onClick={() => setEditing({speciesProfileId: member.speciesProfileId} as Entry)}>Edit</Button>
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    );

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Catalog"
                title="Index management"
                description="Every AnimalDex entry, what captures resolve through, and what each one is still missing."
                actions={(
                    <>
                        <RefreshButton loading={loading} onClick={() => void load()} />
                        <Link href="/admin/indexing" className={buttonVariants({size: "sm"})}>
                            Cron progress
                        </Link>
                        <Link href="/admin/maintenance" className={buttonVariants({size: "sm"})}>
                            Post maintenance →
                        </Link>
                        <Button variant="primary" size="sm" onClick={() => setIndexingNew(true)}>
                            Index a new animal
                        </Button>
                    </>
                )}
            />

            {summary ? (
                <StatGrid className="mt-6">
                    {[
                        ["Indexed animals", summary.indexed],
                        ["Unindexed profiles", summary.unindexed],
                        ["Indexed, no subtitle", summary.missingSubtitle],
                        ["Indexed, no lesson", summary.missingLesson]
                    ].map(([label, value]) => (
                        <Stat key={String(label)} label={label} value={Number(value).toLocaleString()} />
                    ))}
                </StatGrid>
            ) : loading ? (
                <StatGridSkeleton className="mt-6" />
            ) : null}

            <Card className="mt-6">
                <CardHeader
                    title="Duplicate check"
                    description={(
                        <>
                            Two numbers for one animal split its captures between them. This groups indexed entries
                            that share an identity key, a slug, a name, or a scientific name — the last of which is
                            usually a family (a breed beside its parent) rather than a mistake.
                        </>
                    )}
                    action={(
                        <Button size="sm" onClick={() => void scan()} loading={scanning}>
                            {scanning ? "Scanning…" : duplicates ? "Scan again" : "Scan the index"}
                        </Button>
                    )}
                />

                {(scanError || duplicates || scanning) && (
                    <CardContent className="space-y-4">
                        {scanError && <Alert tone="bad">{scanError}</Alert>}

                        {scanning && !duplicates && <LoadingRow className="px-0 py-2">Scanning the index…</LoadingRow>}

                        {duplicates && (
                            <>
                                <p className="text-sm text-ink-400">
                                    Scanned <span className="tabular-nums">{duplicates.scanned.toLocaleString()}</span> indexed entries ·{" "}
                                    <span className="font-bold tabular-nums text-white">{duplicates.duplicates.length}</span> likely duplicate
                                    {duplicates.duplicates.length === 1 ? "" : "s"} ·{" "}
                                    <span className="font-bold tabular-nums text-white">{duplicates.related.length}</span> related group
                                    {duplicates.related.length === 1 ? "" : "s"}
                                </p>

                                {!duplicates.duplicates.length && !duplicates.related.length && (
                                    <EmptyState title="Nothing shares an identity." className="py-8" />
                                )}

                                {duplicates.duplicates.length > 0 && (
                                    <div className="grid gap-3 xl:grid-cols-2">{duplicates.duplicates.map(groupCard)}</div>
                                )}

                                {duplicates.related.length > 0 && (
                                    <details className="border-t border-line-300 pt-3">
                                        <summary className="cursor-pointer text-[11px] font-black uppercase tracking-[.12em] text-ink-400 hover:text-white">
                                            Related entries ({duplicates.related.length})
                                        </summary>
                                        <div className="mt-3 grid gap-3 xl:grid-cols-2">{duplicates.related.map(groupCard)}</div>
                                    </details>
                                )}
                            </>
                        )}
                    </CardContent>
                )}
            </Card>

            <Section title="Entries">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input value={query} onChange={(event) => {setQuery(event.target.value); setPage(0);}}
                           placeholder="Search by number, name, scientific name or identity key…"
                           aria-label="Search the catalog"
                           className={cn(fieldClass, "min-w-0")} />
                    <select value={filter} onChange={(event) => {setFilter(event.target.value); setPage(0);}}
                            aria-label="Filter"
                            className={cn(fieldClass, "lg:w-auto")}>
                        {FILTERS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <select value={sort} onChange={(event) => {setSort(event.target.value); setPage(0);}}
                            aria-label="Sort"
                            className={cn(fieldClass, "lg:w-auto")}>
                        {SORTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                </div>

                {error && <Alert tone="bad" className="mt-4">{error}</Alert>}
                {notice && <Alert tone="good" className="mt-4">{notice}</Alert>}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm tabular-nums text-ink-400">
                        {total != null ? `${total.toLocaleString()} entries` : <Skeleton className="h-3 w-20" />}
                        {loading && total != null ? <Spinner size={12} /> : null}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button size="sm" aria-label="Previous page" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}>←</Button>
                        <span className="text-sm tabular-nums text-ink-400">Page {page + 1} of {pageCount}</span>
                        <Button size="sm" aria-label="Next page" onClick={() => setPage((current) => current + 1)} disabled={page + 1 >= pageCount || loading}>→</Button>
                    </div>
                </div>

                <Card className={cn("mt-3", loading && entries.length > 0 && "opacity-70 transition-opacity")}>
                    {loading && !entries.length ? (
                        <TableSkeleton rows={8} columns={9} />
                    ) : (
                        <Table minWidth={1312} className="text-sm">
                            <thead>
                                <tr>
                                    <TH>#</TH>
                                    <TH>Animal</TH>
                                    <TH>Identity key</TH>
                                    <TH>Identity level</TH>
                                    <TH>Tier</TH>
                                    <TH>Landing page</TH>
                                    <TH numeric>Public captures</TH>
                                    <TH>Content</TH>
                                    <TH />
                                </tr>
                            </thead>
                            <tbody>
                                {!entries.length && !loading && (
                                    <tr><td colSpan={9} className="p-4"><EmptyState title="No entries match." className="border-0" /></td></tr>
                                )}
                                {entries.map((entry) => (
                                    <tr key={entry.speciesProfileId} className="hover:bg-white/[.02]">
                                        <TD className="font-mono tabular-nums text-primary-100">
                                            {entry.number != null ? `#${entry.number}` : "—"}
                                        </TD>
                                        <TD>
                                            <span className="block text-sm font-bold text-white">{entry.displayName}</span>
                                            <span className="block text-xs italic text-ink-400">{entry.scientificName || "No scientific name"}</span>
                                        </TD>
                                        <TD>
                                            <span className="block font-mono text-xs text-ink-300">{entry.identityKey}</span>
                                            {entry.slug && entry.slug !== entry.identityKey && (
                                                <span className="block font-mono text-[11px] text-ink-500">/{entry.slug}</span>
                                            )}
                                        </TD>
                                        <TD>
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[.08em] ${KIND_TONE[entry.identityKind ?? ""] ?? "bg-white/5 text-ink-400"}`}
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
                                        </TD>
                                        <TD>
                                            {entry.tier
                                                ? <span title={`Battle power ${entry.battlePower}`}><BattleTierChip tier={entry.tier} compact /></span>
                                                : <span className="text-xs text-ink-500">no stats</span>}
                                        </TD>
                                        <TD><LandingPageCell page={entry.landingPage} /></TD>
                                        <TD numeric>
                                            <span className="font-display text-lg text-white">{entry.publicCaptures.toLocaleString()}</span>
                                            {entry.publicCapturesWithMedia > 0 && (
                                                <span className="block text-[11px] text-ink-500">{entry.publicCapturesWithMedia} with photo</span>
                                            )}
                                        </TD>
                                        <TD>
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
                                        </TD>
                                        <TD className="text-right">
                                            <Button size="sm" onClick={() => setEditing(entry)}>Edit</Button>
                                        </TD>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card>
            </Section>

            {indexingNew && (
                <IndexNewAnimal
                    onClose={() => { setIndexingNew(false); void load(); }}
                    onIndexed={(message) => setNotice(message)}
                    onNotify={(request) => setNotifyRequest(request)}
                    onEditExisting={(speciesProfileId) => {
                        setIndexingNew(false);
                        setEditing({speciesProfileId} as Entry);
                    }}
                />
            )}
            {notifyRequest && (
                <NotifyOwnerDialog
                    request={notifyRequest}
                    onClose={() => setNotifyRequest(null)}
                    onSent={(message) => setNotice(message)}
                />
            )}
            {editing && (
                <CatalogPanel
                    initialSpeciesProfileId={editing.speciesProfileId}
                    onClose={() => { setEditing(null); void load(); }}
                />
            )}
        </AdminPage>
    );
}
