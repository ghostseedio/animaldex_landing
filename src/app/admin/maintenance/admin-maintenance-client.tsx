"use client";

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";
import CaptureGradePanel from "@/app/admin/maintenance/capture-grade-panel";
import CaptureIndexPanel from "@/app/admin/maintenance/capture-index-panel";

type Post = {
    id: string;
    status: string;
    captureMode: "photo" | "video";
    title: string | null;
    createdAt: string;
    updatedAt: string;
    animalName: string | null;
    scientificName: string | null;
    confidence: number | null;
    captureGrade: number | null;
    animalDexNumber: number | null;
    /** False when the analysis holds no species_profile_id, indexed or not. */
    indexLinked: boolean;
    /** Set when the number was reached through an identity key rather than a link. */
    indexVia: string | null;
    identityResolutionMode: string | null;
    identityKey: string | null;
    analysisCompletedAt: string | null;
    analysisError: string | null;
    modelVersion: string | null;
    imageUrl: string;
    /** Set when this capture was merged into another; its photos live there now. */
    mergedIntoCaptureId: string | null;
    user: {id: string; displayName: string | null; username: string | null; avatarUrl: string | null};
};

function relativeDate(value: string | null) {
    if (!value) return "Never";
    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat("en", {numeric: "auto"});
    if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30) return formatter.format(days, "day");
    return new Intl.DateTimeFormat("en", {dateStyle: "medium"}).format(new Date(value));
}

/** Relative reads well in a list; exact is what an operator needs when two captures are seconds apart. */
function exactDate(value: string | null) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "medium"}).format(new Date(value));
}

export default function AdminMaintenanceClient() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [mode, setMode] = useState("all");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [running, setRunning] = useState<Set<string>>(new Set());
    const [viewingPost, setViewingPost] = useState<Post | null>(null);
    const [gradingPost, setGradingPost] = useState<Post | null>(null);
    const [indexingPosts, setIndexingPosts] = useState<Post[] | null>(null);
    const [merging, setMerging] = useState(false);
    const [gradeById, setGradeById] = useState<Record<string, number>>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadPosts(nextStatus = status) {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/maintenance/posts?limit=100&status=${encodeURIComponent(nextStatus)}`, {cache: "no-store"});
            if (response.status === 401) { setAuthorized(false); return; }
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load posts");
            setPosts(body.posts);
            setAuthorized(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load posts");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void loadPosts(); }, []);
    useEffect(() => {
        if (!viewingPost) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setViewingPost(null);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [viewingPost]);

    async function login(event: FormEvent) {
        event.preventDefault();
        setError(null);
        const response = await fetch("/api/admin/support/login", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password})
        });
        const body = await response.json();
        if (!response.ok || !body.ok) { setError(body.error || "Unable to sign in"); return; }
        setPassword("");
        await loadPosts();
    }

    async function refreshPost(post: Post) {
        setRunning((current) => new Set(current).add(post.id));
        setError(null);
        try {
            const response = await fetch("/api/admin/maintenance/refresh", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({captureId: post.id})
            });
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Refresh failed");
            setNotice(`${post.animalName || "Post"}: ${body.message}.`);
        } catch (caught) {
            setError(`${post.animalName || post.id}: ${caught instanceof Error ? caught.message : "Refresh failed"}`);
        } finally {
            setRunning((current) => { const next = new Set(current); next.delete(post.id); return next; });
        }
    }

    /**
     * Merge is deliberately two hand-picked captures rather than the bulk
     * selection: it is not reversible from here, and which one survives matters.
     */
    async function mergeSelected() {
        const targets = selectedPosts;
        if (targets.length < 2 || selectedOwners.size > 1) return;
        // The older capture is the parent: it holds the collection history the
        // newer duplicate should fold into.
        const ordered = [...targets].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
        const [parent, ...children] = ordered;

        if (!window.confirm(`Merge ${children.length} capture(s) into "${parent.animalName || parent.id}" (${exactDate(parent.createdAt)})?\n\nTheir photos move onto the oldest capture, which keeps its identity — merging does not re-identify anything. This cannot be undone from here.`)) {
            return;
        }

        setMerging(true);
        setError(null);
        setNotice(null);

        const merged: string[] = [];
        const failed: string[] = [];

        for (const child of children) {
            try {
                const response = await fetch("/api/admin/maintenance/merge", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({childCaptureId: child.id, parentCaptureId: parent.id})
                });
                const body = await response.json();
                if (!response.ok || !body.ok) throw new Error(body.error || "Merge failed");
                merged.push(child.id);
            } catch (caught) {
                failed.push(`${child.id.slice(0, 8)}: ${caught instanceof Error ? caught.message : "failed"}`);
            }
        }

        if (merged.length) setNotice(`Merged ${merged.length} capture(s) into ${parent.animalName || parent.id}. Identity unchanged — use Set index to move them onto the right entry.`);
        if (failed.length) setError(`${failed.length} could not merge — ${failed.join(" · ")}`);

        setSelected(new Set());
        await loadPosts(status);
        setMerging(false);
    }

    async function refreshSelected() {
        const targets = filtered.filter((post) => selected.has(post.id) && post.captureMode === "photo").slice(0, 10);
        setNotice(null);
        for (const post of targets) await refreshPost(post);
        setSelected(new Set());
        await loadPosts(status);
        setNotice(`Finished ${targets.length} selected refresh${targets.length === 1 ? "" : "es"}.`);
    }

    const selectedPosts = useMemo(() => posts.filter((post) => selected.has(post.id)), [posts, selected]);
    // Merge is per owner: the database refuses to fold one person's capture into
    // another's, and it should — each of them owns their own photo.
    const selectedOwners = useMemo(() => new Set(selectedPosts.map((post) => post.user.id)), [selectedPosts]);
    const mergeBlockedReason = selectedPosts.length < 2
        ? "Select at least two captures to merge"
        : selectedOwners.size > 1
            ? `Those captures span ${selectedOwners.size} owners — merge only works within one person's collection`
            : null;

    const filtered = useMemo(() => posts.filter((post) => {
        if (mode !== "all" && post.captureMode !== mode) return false;
        const needle = query.trim().toLowerCase();
        return !needle || [post.id, post.title, post.animalName, post.scientificName, post.user.displayName, post.user.username]
            .some((value) => String(value ?? "").toLowerCase().includes(needle));
    }), [posts, query, mode]);

    if (authorized === false) {
        return <main className="grid min-h-screen place-items-center px-4"><form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex admin</p><h1 className="mt-2 font-display text-3xl text-white">Maintenance</h1><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300" /><button className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-black text-canvas-950">Sign in</button>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}</form></main>;
    }

    return (
        <main className="min-h-screen p-4 sm:p-7">
            <div className="mx-auto max-w-[100rem]">
                <header className="flex flex-col justify-between gap-5 border-b border-line-300 pb-6 lg:flex-row lg:items-end">
                    <div><Link href="/admin" className="text-sm text-ink-400 hover:text-white">← Admin</Link><p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-primary-200">Capture operations</p><h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Post maintenance</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">Review recent user posts and re-run the production admin analysis without charging the user.</p></div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/admin/catalog" className="w-fit rounded-xl border border-primary-400/40 px-4 py-2.5 text-sm font-black text-primary-100">Manage index entries</Link>
                        <button onClick={() => void loadPosts(status)} disabled={loading} className="w-fit rounded-xl border border-line-300 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? "Loading…" : "Reload posts"}</button>
                    </div>
                </header>

                <section className="mt-6 grid gap-3 rounded-2xl border border-line-300 bg-surface-900 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search animal, owner, or capture ID…" className="min-w-0 rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white outline-none focus:border-primary-300" />
                    <select value={status} onChange={(event) => {setStatus(event.target.value); void loadPosts(event.target.value);}} className="rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white"><option value="all">All statuses</option><option value="ready">Ready</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="processing">Processing</option></select>
                    <select value={mode} onChange={(event) => setMode(event.target.value)} className="rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white"><option value="all">All media</option><option value="photo">Photos</option><option value="video">Videos</option></select>
                </section>

                {(error || notice) && <div className={`mt-4 rounded-xl border p-3 text-sm ${error ? "border-red-400/20 bg-red-500/10 text-red-200" : "border-primary-400/20 bg-primary-500/10 text-primary-100"}`}>{error || notice}</div>}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-400">
                        {filtered.length} recent post{filtered.length === 1 ? "" : "s"} · {selected.size} selected
                        {mergeBlockedReason && selected.size > 0 && <span className="block text-xs text-amber-200">{mergeBlockedReason}</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setIndexingPosts(selectedPosts)} disabled={!selectedPosts.length} title="Move every selected capture onto one catalog entry" className="rounded-xl border border-primary-400/40 px-4 py-2.5 text-sm font-black text-primary-100 disabled:border-line-300 disabled:text-ink-500">Set index for {selectedPosts.length || ""} selected</button>
                        <button onClick={() => void mergeSelected()} disabled={Boolean(mergeBlockedReason) || merging} title={mergeBlockedReason ?? "Fold the newer captures into the oldest one"} className="rounded-xl border border-violet-400/40 px-4 py-2.5 text-sm font-black text-violet-200 disabled:border-line-300 disabled:text-ink-500">{merging ? "Merging…" : `Merge ${selectedPosts.length > 1 ? selectedPosts.length : ""} selected`}</button>
                        <button onClick={() => void refreshSelected()} disabled={!selected.size || running.size > 0} className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-black text-canvas-950 disabled:cursor-not-allowed disabled:opacity-40">Refresh selected ({Math.min(selected.size, 10)})</button>
                    </div>
                </div>

                <section className="mt-3 overflow-hidden rounded-2xl border border-line-300 bg-surface-900">
                    {loading && !posts.length ? <div className="py-24 text-center text-ink-400">Loading user posts…</div> : !filtered.length ? <div className="py-24 text-center text-ink-400">No posts match these filters.</div> : filtered.map((post) => {
                        const isRunning = running.has(post.id);
                        const canRefresh = post.captureMode === "photo";
                        return <article key={post.id} className="grid grid-cols-[auto_72px_minmax(0,1fr)] items-center gap-3 border-b border-line-300 p-3 last:border-0 sm:grid-cols-[auto_88px_minmax(0,1fr)_auto] sm:gap-4 sm:p-4">
                            <input type="checkbox" aria-label={`Select ${post.animalName || post.id}`} checked={selected.has(post.id)} disabled={!canRefresh} onChange={(event) => setSelected((current) => {const next = new Set(current); event.target.checked ? next.add(post.id) : next.delete(post.id); return next;})} className="h-4 w-4 accent-primary-500" />
                            <button type="button" onClick={() => setViewingPost(post)} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-line-300 bg-canvas-900 text-left transition hover:border-primary-300 sm:h-20 sm:w-20" aria-label={`View full-size ${post.animalName || "capture"} photo`}>
                                <img src={post.imageUrl} alt={post.animalName ? `${post.animalName} user capture` : "User capture"} className="h-full w-full object-cover transition group-hover:scale-105" />
                                <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100">Expand</span>
                            </button>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-white">{post.animalName || post.title || "Unidentified capture"}</h2><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${post.status === "ready" ? "bg-primary-500/15 text-primary-100" : post.status === "failed" ? "bg-red-500/15 text-red-200" : "bg-amber-500/15 text-amber-200"}`}>{post.status}</span><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-ink-400">{post.captureMode}</span>{post.mergedIntoCaptureId && <span className="rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-black uppercase text-violet-200">merged</span>}</div>
                                <p className="mt-1 truncate text-sm text-ink-400">{post.scientificName || "No scientific name"} · {post.user.displayName || post.user.username || "Unknown user"}{post.user.username ? ` (@${post.user.username})` : ""}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                                    <span title={post.animalDexNumber != null && post.indexVia ? `Resolved through ${post.indexVia}` : undefined} className={`rounded-full px-2 py-1 ${post.animalDexNumber != null ? "bg-primary-500/15 text-primary-100" : "bg-white/5 text-ink-500"}`}>{post.animalDexNumber != null ? `#${post.animalDexNumber}${post.indexVia ? "*" : ""}` : "unindexed"}</span>
                                    {!post.indexLinked && (post.identityResolutionMode === "refinable"
                                        ? <span title="Stopped at a parent identity and is waiting on a breed before it links to the catalog" className="rounded-full bg-white/5 px-2 py-1 text-ink-400">refinable</span>
                                        : <span title="The analysis holds no species profile, so this capture is missing from the owner's collection index" className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-200">not linked</span>)}
                                    <span className={`rounded-full px-2 py-1 ${post.captureGrade == null ? "bg-white/5 text-ink-500" : post.captureGrade >= 8 ? "bg-primary-500/15 text-primary-100" : post.captureGrade >= 5 ? "bg-amber-500/15 text-amber-200" : "bg-red-500/15 text-red-200"}`}>{post.captureGrade == null ? "no grade" : `grade ${post.captureGrade}`}</span>
                                    {post.identityKey && <span className="truncate rounded-full bg-white/5 px-2 py-1 font-mono text-ink-400">{post.identityKey}</span>}
                                </div>
                                <p className="mt-2 truncate font-mono text-[11px] text-ink-500">{post.id}</p>
                                <p className="mt-1 text-xs text-ink-500" title={`Posted ${exactDate(post.createdAt)}`}>Posted {exactDate(post.createdAt)} ({relativeDate(post.createdAt)}) · Analysis {relativeDate(post.analysisCompletedAt)}{post.modelVersion ? ` · ${post.modelVersion}` : ""}</p>
                                {post.mergedIntoCaptureId && <p className="mt-2 text-xs text-violet-200">
                                    Merged into <span className="font-mono">{post.mergedIntoCaptureId}</span> — its photos moved there, so the thumbnail above is the merged card&apos;s.
                                </p>}
                                {post.analysisError && <p className="mt-2 line-clamp-2 text-xs text-red-300">{post.analysisError}</p>}
                            </div>
                            <div className="col-span-3 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
                            <button onClick={() => setIndexingPosts([post])} title="Move this capture onto a chosen AnimalDex number" className="rounded-xl border border-line-300 px-4 py-2.5 text-sm font-black text-white hover:border-primary-300">Set index</button>
                            <button onClick={() => setGradingPost(post)} title="Adjust the analysis this capture is graded from" className="rounded-xl border border-line-300 px-4 py-2.5 text-sm font-black text-white hover:border-primary-300">{gradeById[post.id] != null ? `Grade ${gradeById[post.id]}` : "Fix grade"}</button>
                            <button onClick={() => void refreshPost(post)} disabled={!canRefresh || isRunning || running.size > 0} title={!canRefresh ? "Video refresh requires frame extraction in the iOS admin script" : "Re-run analysis"} className="rounded-xl border border-primary-400/40 px-4 py-2.5 text-sm font-black text-primary-100 disabled:border-line-300 disabled:text-ink-500">{isRunning ? "Refreshing…" : canRefresh ? "Refresh analysis" : "Script required"}</button>
                            </div>
                        </article>;
                    })}
                </section>
                <p className="mt-4 text-xs leading-5 text-ink-500">Bulk refresh runs sequentially and is capped at 10 posts per batch to protect model rate limits. Video captures remain available in this view but require the frame-extracting admin script.</p>
            </div>
            {indexingPosts && (
                <CaptureIndexPanel
                    captureIds={indexingPosts.map((post) => post.id)}
                    animalName={indexingPosts[0]?.animalName ?? null}
                    warning={(() => {
                        // One capture per species per owner: a second one from the
                        // same person is refused, and merging is the right fix.
                        const owners = indexingPosts.map((post) => post.user.id);
                        const duplicated = owners.length - new Set(owners).size;
                        return duplicated > 0
                            ? `${duplicated} of these belong to an owner who already has another capture in this selection. Only one capture per person can hold a given index, so merge each person's duplicates first — the rest will be refused.`
                            : null;
                    })()}
                    currentNumber={indexingPosts[0]?.animalDexNumber ?? null}
                    onClose={() => setIndexingPosts(null)}
                    onApplied={(summary) => {
                        setNotice(`${summary.applied} capture(s) moved to #${summary.animalDexNumber ?? "—"} ${summary.displayName ?? ""}.`);
                        setSelected(new Set());
                        void loadPosts(status);
                    }}
                />
            )}
            {gradingPost && (
                <CaptureGradePanel
                    captureId={gradingPost.id}
                    animalName={gradingPost.animalName}
                    imageUrl={gradingPost.imageUrl}
                    onClose={() => setGradingPost(null)}
                    onSaved={(grade) => {
                        setGradeById((current) => ({...current, [gradingPost.id]: grade}));
                        setNotice(`${gradingPost.animalName || "Capture"}: grade saved as ${grade}.`);
                    }}
                />
            )}
            {viewingPost && (
                <div role="dialog" aria-modal="true" aria-label={`${viewingPost.animalName || "Capture"} full-size image`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingPost(null); }}>
                    <div className="flex max-h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-line-300 bg-canvas-950 shadow-2xl">
                        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line-300 px-4 py-3 sm:px-5">
                            <div className="min-w-0"><h2 className="truncate font-display text-xl text-white">{viewingPost.animalName || viewingPost.title || "User capture"}</h2><p className="truncate text-xs text-ink-400">{viewingPost.scientificName || viewingPost.user.displayName || viewingPost.id}</p></div>
                            <button type="button" onClick={() => setViewingPost(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-300 text-xl text-white hover:border-primary-300" aria-label="Close full-size image">×</button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto bg-black">
                            <img src={viewingPost.imageUrl} alt={viewingPost.animalName ? `Full-size ${viewingPost.animalName} user capture` : "Full-size user capture"} className="mx-auto h-auto max-h-[calc(100dvh-9rem)] max-w-full object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
