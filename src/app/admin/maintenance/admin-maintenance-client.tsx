"use client";

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";
import CaptureGradePanel from "@/app/admin/maintenance/capture-grade-panel";
import NotifyOwnerDialog, {type NotifyRequest} from "@/app/admin/maintenance/notify-owner-dialog";
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
    authenticityStatus: string | null;
    captureValidity: string | null;
    identityKey: string | null;
    analysisCompletedAt: string | null;
    analysisError: string | null;
    modelVersion: string | null;
    imageUrl: string;
    /** Set when this capture was merged into another; its photos live there now. */
    mergedIntoCaptureId: string | null;
    user: {id: string; displayName: string | null; username: string | null; avatarUrl: string | null};
};

/** The model's verdict that a photo is of a screen or a print, not a live animal. */
function isScreenCapture(post: {authenticityStatus: string | null; captureValidity: string | null}) {
    return post.authenticityStatus === "likely_non_live_source"
        || post.captureValidity === "likely_non_live_source";
}

/** Rows fetched per request; the API caps it at 100. */
const PAGE_SIZE = 100;

/** A capture is this old before an upload still in flight counts as abandoned. */
const ABANDONED_UPLOAD_MINUTES = 30;

/**
 * The photo never reached storage, so there is nothing to analyse and never will
 * be. Two shapes of the same thing: the analysis ran and could not find the
 * object, or the upload stopped before the analysis was ever triggered and the
 * capture has sat unfinished since. Neither is recoverable and neither was
 * charged for, so they are noise in a list of things to act on.
 */
function isDeadUpload(post: {analysisError: string | null; status: string; createdAt: string; analysisCompletedAt: string | null}) {
    const error = String(post.analysisError ?? "");
    if (error.includes("storage_download_failed") || error.includes("upload_incomplete")) return true;

    const unfinished = ["pending", "uploading", "ready_for_analysis"].includes(post.status);
    const age = (Date.now() - new Date(post.createdAt).getTime()) / 60_000;
    return unfinished && !post.analysisCompletedAt && age > ABANDONED_UPLOAD_MINUTES;
}

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
    const [hideMerged, setHideMerged] = useState(false);
    const [hideCreditFailures, setHideCreditFailures] = useState(false);
    const [hideScreenCaptures, setHideScreenCaptures] = useState(false);
    const [hideDeadUploads, setHideDeadUploads] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [running, setRunning] = useState<Set<string>>(new Set());
    const [viewingPost, setViewingPost] = useState<Post | null>(null);
    const [gradingPost, setGradingPost] = useState<Post | null>(null);
    const [notifyRequest, setNotifyRequest] = useState<NotifyRequest | null>(null);
    const [indexingPosts, setIndexingPosts] = useState<Post[] | null>(null);
    const [merging, setMerging] = useState(false);
    const [broken, setBroken] = useState<Array<{id: string; userId: string; status: string; createdAt: string; reason: string}> | null>(null);
    const [checkingBroken, setCheckingBroken] = useState(false);
    /** Set when the index picker was opened by "Set index & merge". */
    const [mergeAfterIndex, setMergeAfterIndex] = useState(false);
    const [gradeById, setGradeById] = useState<Record<string, number>>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadPosts(nextStatus = status, options: {append?: boolean} = {}) {
        const offset = options.append ? posts.length : 0;
        if (options.append) setLoadingMore(true); else setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `/api/admin/maintenance/posts?limit=${PAGE_SIZE}&offset=${offset}&status=${encodeURIComponent(nextStatus)}`,
                {cache: "no-store"}
            );
            if (response.status === 401) { setAuthorized(false); return; }
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load posts");
            // Appending by id rather than by index: a merge between pages can
            // shift rows, and a duplicate row would break selection.
            setPosts((current) => {
                if (!options.append) return body.posts;
                const seen = new Set(current.map((post: Post) => post.id));
                return [...current, ...body.posts.filter((post: Post) => !seen.has(post.id))];
            });
            setHasMore(Boolean(body.hasMore));
            setAuthorized(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load posts");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    /**
     * Refetch what is already on screen, rather than the first page.
     *
     * After an action that changes rows — a merge, a reindex — the list has to
     * come back from the server, but reloading page one threw away every "Load
     * older captures" press and dropped the operator back at the top. This asks
     * for as many pages as were loaded and holds the scroll position across the
     * swap, so a merge deep in the list leaves you where you were.
     */
    async function reloadLoadedPages(nextStatus = status) {
        const pages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
        const scrollY = typeof window === "undefined" ? 0 : window.scrollY;
        setLoading(true);
        setError(null);

        try {
            const collected: Post[] = [];
            const seen = new Set<string>();
            let more = false;

            for (let page = 0; page < pages; page += 1) {
                const response = await fetch(
                    `/api/admin/maintenance/posts?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&status=${encodeURIComponent(nextStatus)}`,
                    {cache: "no-store"}
                );
                if (response.status === 401) { setAuthorized(false); return; }
                const body = await response.json();
                if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load posts");

                for (const post of body.posts as Post[]) {
                    if (seen.has(post.id)) continue;
                    seen.add(post.id);
                    collected.push(post);
                }
                more = Boolean(body.hasMore);
                if (!body.hasMore) break;
            }

            setPosts(collected);
            setHasMore(more);
            setAuthorized(true);
            // After the rows are painted, not before: restoring first would land
            // against the old, shorter document.
            requestAnimationFrame(() => window.scrollTo({top: scrollY}));
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
    /**
     * A capture whose photo never reached storage can never be analysed: the
     * analysis downloads once and throws, so the member is left watching a
     * spinner. This finds them by asking storage, and closes them out.
     */
    async function findBrokenCaptures() {
        setCheckingBroken(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/maintenance/broken-captures?limit=200", {cache: "no-store"});
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to check captures");
            setBroken(body.captures);
            if (!body.captures.length) setNotice("No stuck captures — every one still in progress has its photo in storage.");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to check captures");
        } finally {
            setCheckingBroken(false);
        }
    }

    async function closeBrokenCaptures() {
        if (!broken?.length) return;
        if (!window.confirm(`Close ${broken.length} capture(s) as failed?\n\nTheir photos are not in storage, so they can never be analysed. The owners keep their credits — these were never charged.`)) return;

        setCheckingBroken(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/maintenance/broken-captures", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({captureIds: broken.map((row) => row.id)})
            });
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to close those captures");
            setNotice(`Closed ${body.closed} capture(s) as failed${body.skipped ? `, skipped ${body.skipped} whose photo has since arrived` : ""}.`);
            setBroken(null);
            await reloadLoadedPages(status);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to close those captures");
        } finally {
            setCheckingBroken(false);
        }
    }

    async function mergeSelected() {
        await mergeCaptures(selectedPosts);
    }

    async function mergeCaptures(targets: Post[], options: {skipConfirm?: boolean} = {}) {
        if (targets.length < 2) return;
        if (new Set(targets.map((post) => post.user.id)).size > 1) return;
        // The older capture is the parent: it holds the collection history the
        // newer duplicate should fold into.
        const ordered = [...targets].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
        const [parent, ...children] = ordered;

        if (!options.skipConfirm && !window.confirm(`Merge ${children.length} capture(s) into "${parent.animalName || parent.id}" (${exactDate(parent.createdAt)})?\n\nTheir photos move onto the oldest capture, which keeps its identity — merging does not re-identify anything. This cannot be undone from here.`)) {
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

        if (merged.length) {
            setNotice(`Merged ${merged.length} capture(s) into ${parent.animalName || parent.id}. Identity unchanged — use Set index to move them onto the right entry.`);
            // One message for the whole merge rather than one per capture: a
            // merge is already restricted to a single owner, so this is the
            // person whose collection just changed, told once.
            setNotifyRequest({
                templateId: "merged",
                recipients: [{
                    userId: parent.user.id,
                    label: parent.user.username ? `@${parent.user.username}` : parent.user.displayName || "this member",
                    captureId: parent.id
                }],
                animalName: parent.animalName,
                count: merged.length + 1
            });
        }
        if (failed.length) setError(`${failed.length} of ${children.length} could not merge — ${failed.join(" · ")}`);

        // Keeping the selection when nothing moved: clearing it made a refusal
        // look like a no-op, with the rows unchanged and the checkboxes reset.
        if (merged.length) {
            setSelected(new Set());
            await reloadLoadedPages(status);
        }

        setMerging(false);
    }

    async function refreshSelected() {
        const targets = filtered.filter((post) => selected.has(post.id) && post.captureMode === "photo").slice(0, 10);
        setNotice(null);
        for (const post of targets) await refreshPost(post);
        setSelected(new Set());
        await reloadLoadedPages(status);
        setNotice(`Finished ${targets.length} selected refresh${targets.length === 1 ? "" : "es"}.`);
    }

    const selectedPosts = useMemo(() => posts.filter((post) => selected.has(post.id)), [posts, selected]);
    // Merge is per owner: the database refuses to fold one person's capture into
    // another's, and it should — each of them owns their own photo.
    const selectedOwners = useMemo(() => new Set(selectedPosts.map((post) => post.user.id)), [selectedPosts]);
    // The merge routine folds captures that resolve to the same AnimalDex number,
    // so a selection that cannot possibly satisfy it is caught here rather than
    // failing per capture after the operator has committed to the action.
    const unnumbered = selectedPosts.filter((post) => post.animalDexNumber == null);
    const distinctNumbers = new Set(selectedPosts.map((post) => post.animalDexNumber));
    // Not a dead end: an operator who picks the entry can have both steps run.
    const needsIndexBeforeMerge = selectedPosts.length >= 2
        && selectedOwners.size === 1
        && (unnumbered.length > 0 || distinctNumbers.size > 1);
    const mergeBlockedReason = selectedPosts.length < 2
        ? "Select at least two captures to merge"
        : selectedOwners.size > 1
            ? `Those captures span ${selectedOwners.size} owners — merge only works within one person's collection`
            : unnumbered.length
                ? `${unnumbered.length} of these has no AnimalDex number yet — use Set index on them first, then merge`
                : distinctNumbers.size > 1
                    ? "Those captures sit on different AnimalDex numbers — put them on the same one with Set index first"
                    : null;

    const filtered = useMemo(() => posts.filter((post) => {
        if (mode !== "all" && post.captureMode !== mode) return false;
        // A merged capture is somebody else's photo now; it is in the list for
        // traceability, not because anything is left to do with it.
        if (hideMerged && post.mergedIntoCaptureId) return false;
        // Ran out of credits is a billing state, not a capture to fix.
        if (hideCreditFailures && String(post.analysisError ?? "").includes("insufficient_credits")) return false;
        if (hideScreenCaptures && isScreenCapture(post)) return false;
        if (hideDeadUploads && isDeadUpload(post)) return false;
        const needle = query.trim().toLowerCase();
        return !needle || [post.id, post.title, post.animalName, post.scientificName, post.user.displayName, post.user.username]
            .some((value) => String(value ?? "").toLowerCase().includes(needle));
    }), [posts, query, mode, hideMerged, hideCreditFailures, hideScreenCaptures, hideDeadUploads]);

    const hiddenCount = posts.length - filtered.length;

    if (authorized === false) {
        return <main className="grid min-h-screen place-items-center px-4"><form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex admin</p><h1 className="mt-2 font-display text-3xl text-white">Maintenance</h1><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300" /><button className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-black text-canvas-950">Sign in</button>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}</form></main>;
    }

    const toast = error ? {kind: "error" as const, text: error} : notice ? {kind: "notice" as const, text: notice} : null;

    return (
        <main className="min-h-screen p-4 sm:p-7">
            {/* Actions here are bulk and destructive, and their result used to sit
                in a strip above the fold where an operator working through rows
                never saw it. This follows the viewport instead. */}
            {toast && (
                <div role={toast.kind === "error" ? "alert" : "status"} aria-live={toast.kind === "error" ? "assertive" : "polite"}
                     className="fixed inset-x-3 bottom-4 z-[60] mx-auto max-w-2xl sm:inset-x-auto sm:right-6 sm:left-auto">
                    <div className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur ${toast.kind === "error" ? "border-red-400/40 bg-red-950/95 text-red-100" : "border-primary-400/40 bg-emerald-950/95 text-primary-100"}`}>
                        <span aria-hidden="true" className="text-lg leading-none">{toast.kind === "error" ? "⚠" : "✓"}</span>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase tracking-[.14em] opacity-70">
                                {toast.kind === "error" ? "Action failed" : "Done"}
                            </p>
                            <p className="mt-1 text-sm leading-6">{toast.text}</p>
                        </div>
                        <button type="button" onClick={() => { setError(null); setNotice(null); }}
                                aria-label="Dismiss message"
                                className="shrink-0 rounded-lg border border-white/20 px-2 py-1 text-xs font-bold">Close</button>
                    </div>
                </div>
            )}
            <div className="mx-auto max-w-[100rem]">
                <header className="flex flex-col justify-between gap-5 border-b border-line-300 pb-6 lg:flex-row lg:items-end">
                    <div><Link href="/admin" className="text-sm text-ink-400 hover:text-white">← Admin</Link><p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-primary-200">Capture operations</p><h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Post maintenance</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">Review recent user posts and re-run the production admin analysis without charging the user.</p></div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => void findBrokenCaptures()} disabled={checkingBroken} className="w-fit rounded-xl border border-amber-400/40 px-4 py-2.5 text-sm font-black text-amber-200 disabled:opacity-40">{checkingBroken ? "Checking…" : "Find stuck captures"}</button>
                        <Link href="/admin/catalog" className="w-fit rounded-xl border border-primary-400/40 px-4 py-2.5 text-sm font-black text-primary-100">Manage index entries</Link>
                        <button onClick={() => void loadPosts(status)} disabled={loading} className="w-fit rounded-xl border border-line-300 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? "Loading…" : "Reload posts"}</button>
                    </div>
                </header>

                {/* Sticky: the actions act on a selection made further down the
                    list, and scrolling back up to reach them lost your place. */}
                <div className="sticky top-0 z-40 -mx-4 mt-6 border-b border-line-300 bg-canvas-950/95 px-4 py-2 backdrop-blur sm:-mx-7 sm:px-7">
                <section className="flex flex-wrap items-center gap-2">
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search animal, owner, or capture ID…" className="h-9 min-w-[12rem] flex-1 rounded-lg border border-line-300 bg-canvas-900 px-3 text-sm text-white outline-none focus:border-primary-300" />
                    <select value={status} onChange={(event) => {setStatus(event.target.value); void loadPosts(event.target.value);}} className="h-9 rounded-lg border border-line-300 bg-canvas-900 px-2 text-sm text-white"><option value="all">All statuses</option><option value="ready">Ready</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="processing">Processing</option></select>
                    <select value={mode} onChange={(event) => setMode(event.target.value)} className="h-9 rounded-lg border border-line-300 bg-canvas-900 px-2 text-sm text-white"><option value="all">All media</option><option value="photo">Photos</option><option value="video">Videos</option></select>
                </section>

                {broken && broken.length > 0 && (
                    <section className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                        <p className="font-bold text-amber-100">{broken.length} capture(s) can never finish</p>
                        <p className="mt-1 text-sm leading-6 text-amber-200/90">
                            Their photos are not in storage, so the analysis has nothing to download and the owners are
                            watching a spinner that cannot resolve. Closing them marks the capture failed and records why.
                        </p>
                        <ul className="mt-3 space-y-1 text-xs text-amber-100/80">
                            {broken.slice(0, 8).map((row) => (
                                <li key={row.id}><span className="font-mono">{row.id.slice(0, 8)}</span> · {row.status} · {exactDate(row.createdAt)} · {row.reason}</li>
                            ))}
                            {broken.length > 8 && <li>…and {broken.length - 8} more</li>}
                        </ul>
                        <div className="mt-3 flex gap-2">
                            <button onClick={() => void closeBrokenCaptures()} disabled={checkingBroken} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-40">Close {broken.length} as failed</button>
                            <button onClick={() => setBroken(null)} className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white">Dismiss</button>
                        </div>
                    </section>
                )}

                {(error || notice) && <div className={`mt-4 rounded-xl border p-3 text-sm ${error ? "border-red-400/20 bg-red-500/10 text-red-200" : "border-primary-400/20 bg-primary-500/10 text-primary-100"}`}>{error || notice}</div>}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                    {[
                        {id: "merged", label: "Hide merged", on: hideMerged, toggle: () => setHideMerged((value) => !value)},
                        {id: "credits", label: "Hide credit failures", on: hideCreditFailures, toggle: () => setHideCreditFailures((value) => !value)},
                        {id: "screens", label: "Hide screen captures", on: hideScreenCaptures, toggle: () => setHideScreenCaptures((value) => !value)},
                        {id: "uploads", label: "Hide dead uploads", on: hideDeadUploads, toggle: () => setHideDeadUploads((value) => !value)}
                    ].map((option) => (
                        <button key={option.id} onClick={option.toggle} aria-pressed={option.on}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${option.on ? "border-primary-400 bg-primary-500/15 text-primary-100" : "border-line-300 text-ink-400 hover:text-white"}`}>
                            {option.on ? "✓ " : ""}{option.label}
                        </button>
                    ))}
                    {hiddenCount > 0 && <span className="text-xs text-ink-500">{hiddenCount} hidden</span>}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-ink-400">
                        {filtered.length} recent post{filtered.length === 1 ? "" : "s"} · {selected.size} selected
                        {mergeBlockedReason && selected.size > 0 && <span className="block text-xs text-amber-200">{mergeBlockedReason}</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setIndexingPosts(selectedPosts)} disabled={!selectedPosts.length} title="Move every selected capture onto one catalog entry" className="rounded-xl border border-primary-400/40 px-4 py-2.5 text-sm font-black text-primary-100 disabled:border-line-300 disabled:text-ink-500">Set index for {selectedPosts.length || ""} selected</button>
                        {needsIndexBeforeMerge && (
                            <button onClick={() => { setMergeAfterIndex(true); setIndexingPosts(selectedPosts); }} disabled={merging || selectedPosts.length < 2 || selectedOwners.size > 1} title="Pick the entry these all belong to, then fold them into one card" className="rounded-xl border border-primary-400/40 px-4 py-2.5 text-sm font-black text-primary-100 disabled:border-line-300 disabled:text-ink-500">Set index &amp; merge {selectedPosts.length || ""}</button>
                        )}
                        <button onClick={() => void mergeSelected()} disabled={Boolean(mergeBlockedReason) || merging} title={mergeBlockedReason ?? "Fold the newer captures into the oldest one"} className="rounded-xl border border-violet-400/40 px-4 py-2.5 text-sm font-black text-violet-200 disabled:border-line-300 disabled:text-ink-500">{merging ? "Merging…" : `Merge ${selectedPosts.length > 1 ? selectedPosts.length : ""} selected`}</button>
                        <button onClick={() => void refreshSelected()} disabled={!selected.size || running.size > 0} className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-black text-canvas-950 disabled:cursor-not-allowed disabled:opacity-40">Refresh selected ({Math.min(selected.size, 10)})</button>
                    </div>
                </div>

                </div>

                <section className="mt-4 overflow-hidden rounded-2xl border border-line-300 bg-surface-900">
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
                                    {isScreenCapture(post) && <span title="The model judged this a photo of a screen or a print rather than a live animal, so it is excluded from collections and stats" className="rounded-full bg-red-500/15 px-2 py-1 text-red-200">screen capture</span>}
                                    {isDeadUpload(post) && <span title="The photo never reached storage, so there is nothing to analyse and a retry cannot help. No credit was charged." className="rounded-full bg-red-500/15 px-2 py-1 text-red-200">no photo</span>}
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
                <div className="mt-4 flex items-center justify-center">
                    {hasMore ? (
                        <button onClick={() => void loadPosts(status, {append: true})} disabled={loadingMore}
                                className="rounded-xl border border-line-300 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                            {loadingMore ? "Loading…" : "Load older captures"}
                        </button>
                    ) : (
                        <p className="text-xs text-ink-500">{posts.length} loaded — that is every capture in this status.</p>
                    )}
                </div>

                <p className="mt-4 text-xs leading-5 text-ink-500">Bulk refresh runs sequentially and is capped at 10 posts per batch to protect model rate limits. Video captures remain available in this view but require the frame-extracting admin script.</p>
            </div>
            {indexingPosts && (
                <CaptureIndexPanel
                    captureIds={indexingPosts.map((post) => post.id)}
                    animalName={indexingPosts[0]?.animalName ?? null}
                    mergeAfter={mergeAfterIndex}
                    warning={(() => {
                        // Several captures from one owner landing on one entry is
                        // fine — it is the state a merge needs. What matters is
                        // whether a merge is going to follow.
                        const owners = indexingPosts.map((post) => post.user.id);
                        const duplicated = owners.length - new Set(owners).size;
                        if (!duplicated) return null;
                        return mergeAfterIndex
                            ? `${duplicated} of these share an owner with another in the selection — they will move onto the entry and then fold into that owner's oldest capture.`
                            : `${duplicated} of these share an owner with another in the selection, so that person will end up holding more than one capture on this entry. Merge them afterwards for their collection to show a single card.`;
                    })()}
                    currentNumber={indexingPosts[0]?.animalDexNumber ?? null}
                    onClose={() => { setIndexingPosts(null); setMergeAfterIndex(false); }}
                    onApplied={async (summary) => {
                        setNotice(`${summary.applied} capture(s) moved to #${summary.animalDexNumber ?? "—"} ${summary.displayName ?? ""}.`);

                        if (mergeAfterIndex && indexingPosts.length > 1) {
                            // Both steps were agreed to when the entry was chosen,
                            // so the merge follows without asking a second time.
                            await mergeCaptures(indexingPosts, {skipConfirm: true});
                            setMergeAfterIndex(false);
                            setIndexingPosts(null);
                            return;
                        }

                        setSelected(new Set());
                        void reloadLoadedPages(status);
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
                        setNotifyRequest({
                            templateId: "regraded",
                            recipients: [{
                                userId: gradingPost.user.id,
                                label: gradingPost.user.username
                                    ? `@${gradingPost.user.username}`
                                    : gradingPost.user.displayName || "this member",
                                captureId: gradingPost.id
                            }],
                            animalName: gradingPost.animalName,
                            grade
                        });
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
