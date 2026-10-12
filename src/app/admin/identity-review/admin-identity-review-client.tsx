"use client";

import Link from "next/link";
import {useCallback, useEffect, useState} from "react";
import {AdminPage, Alert, Button, buttonVariants, EmptyState, PageHeader, RefreshButton, Segmented, Skeleton} from "@/components/admin/ui";

/**
 * Same-animal review queue. A scheduled scan pairs one owner's captures taken
 * moments apart that landed on different AnimalDex numbers, and a vision model
 * compares the two photos. Nothing changes until a verdict is applied here:
 * applying moves the wrong capture onto the right species (capture-identity)
 * and, optionally, folds the pair into one capture (merge).
 */

type ReviewCapture = {
    id: string;
    imageSrc: string;
    name: string | null;
    scientificName: string | null;
    confidence: number | null;
    speciesProfileId: string | null;
    animalDexNumber: number | null;
};

type Review = {
    id: string;
    status: string;
    owner: string | null;
    secondsApart: number;
    distanceM: number | null;
    signals: string[];
    verdict: {same_animal: string; confidence: number; correct_capture: string; correct_common_name: string; correct_scientific_name: string; reasoning: string} | null;
    model: string | null;
    lastError: string | null;
    captureA: ReviewCapture;
    captureB: ReviewCapture;
    suggestedCaptureId: string | null;
    suggestedSpecies: {speciesProfileId: string; animalDexNumber: number | null; displayName: string; scientificName: string | null} | null;
};

const TABS: Array<[string, string]> = [
    ["same_animal", "Same animal"],
    ["unclear", "Unclear"],
    ["pending", "Awaiting analysis"],
    ["error", "Failed"],
    ["different_animals", "Different animals"],
    ["applied", "Applied"],
    ["dismissed", "Dismissed"]
];

const dex = (value: number | null) => (value == null ? "—" : `#${String(value).padStart(3, "0")}`);

async function postJson(url: string, body: unknown) {
    const response = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error ?? `Request failed (${response.status})`);
    return payload;
}

function CapturePanel({label, capture, highlight}: {label: string; capture: ReviewCapture; highlight: "keep" | "move" | null}) {
    return (
        <div className={`min-w-0 border bg-canvas-950 p-2 ${highlight === "move" ? "border-amber-400/60" : highlight === "keep" ? "border-primary-400/60" : "border-line-300"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capture.imageSrc} alt="" className="aspect-square w-full bg-black object-contain" loading="lazy" />
            <p className="mt-2 text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
                {label} {highlight === "keep" ? "· keep" : highlight === "move" ? "· move" : ""}
            </p>
            <p className="text-sm font-bold text-white">{dex(capture.animalDexNumber)} {capture.name ?? "Unknown"}</p>
            <p className="text-xs italic text-ink-400">{capture.scientificName ?? ""}</p>
            <p className="text-xs tabular-nums text-ink-500">confidence {capture.confidence ?? "n/a"} · <span className="font-mono">{capture.id.slice(0, 8)}</span></p>
        </div>
    );
}

function ReviewCard({review, onDone}: {review: Review; onDone: () => void}) {
    const [busy, setBusy] = useState(false);
    // Which button started the work, so only that one spins.
    const [pressed, setPressed] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const target = review.suggestedSpecies;
    const moveIds = review.suggestedCaptureId
        ? [review.suggestedCaptureId]
        : target ? [review.captureA, review.captureB].filter((capture) => capture.speciesProfileId !== target.speciesProfileId).map((capture) => capture.id) : [];
    const keepId = review.suggestedCaptureId
        ? (review.suggestedCaptureId === review.captureA.id ? review.captureB.id : review.captureA.id)
        : null;
    const highlight = (id: string) => (moveIds.includes(id) ? "move" : id === keepId ? "keep" : null);

    async function apply(merge: boolean) {
        if (!target) return;
        setBusy(true);
        setMessage(null);
        try {
            for (const captureId of moveIds) {
                await postJson("/api/admin/maintenance/capture-identity", {captureId, speciesProfileId: target.speciesProfileId});
            }
            if (merge) {
                // Fold the moved capture into the one that was already right; with
                // both moved, fold B into A.
                const parent = keepId ?? review.captureA.id;
                const child = parent === review.captureA.id ? review.captureB.id : review.captureA.id;
                await postJson("/api/admin/maintenance/merge", {childCaptureId: child, parentCaptureId: parent});
            }
            await postJson("/api/admin/maintenance/identity-review", {id: review.id, action: "applied", note: merge ? "moved and merged" : "moved"});
            onDone();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not apply");
        } finally {
            setBusy(false);
        }
    }

    async function mark(action: "dismiss" | "reopen") {
        setBusy(true);
        try {
            await postJson("/api/admin/maintenance/identity-review", {id: review.id, action});
            onDone();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not update");
        } finally {
            setBusy(false);
        }
    }

    return (
        <article className="border border-line-300 bg-surface-900 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs text-ink-400">
                    <span className="font-bold text-white">{review.owner ?? "unknown owner"}</span> · {review.secondsApart}s apart
                    {review.distanceM != null ? ` · ${review.distanceM} m` : ""} · {review.signals.join(", ")}
                </p>
                {review.model ? <p className="text-[11px] text-ink-500">{review.model}</p> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
                <CapturePanel label="A" capture={review.captureA} highlight={highlight(review.captureA.id)} />
                <CapturePanel label="B" capture={review.captureB} highlight={highlight(review.captureB.id)} />
            </div>
            {review.verdict ? (
                <div className="mt-3 border-l-2 border-primary-400/50 pl-3">
                    <p className="text-sm font-bold text-white">
                        {review.verdict.same_animal === "yes" ? "Same animal" : review.verdict.same_animal === "no" ? "Different animals" : "Unclear"}
                        {" · "}{Math.round(review.verdict.confidence * 100)}% · {review.verdict.correct_common_name}
                        {review.verdict.correct_scientific_name ? <span className="font-normal italic text-ink-400"> ({review.verdict.correct_scientific_name})</span> : null}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-300">{review.verdict.reasoning}</p>
                </div>
            ) : null}
            {review.lastError ? <Alert tone="bad" className="mt-3 text-xs">{review.lastError}</Alert> : null}
            {review.status === "same_animal" && !target ? (
                <Alert tone="warn" className="mt-3 text-xs">The named species is not in the catalog. Fix it by hand in Maintenance.</Alert>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
                {target && moveIds.length && review.status !== "applied" ? (
                    <>
                        <Button size="sm" variant="primary" disabled={busy} loading={busy && pressed === "merge"} onClick={() => { setPressed("merge"); void apply(true); }}>
                            Move to {dex(target.animalDexNumber)} {target.displayName} and merge
                        </Button>
                        <Button size="sm" disabled={busy} loading={busy && pressed === "move"} onClick={() => { setPressed("move"); void apply(false); }}>
                            Move only
                        </Button>
                    </>
                ) : null}
                {review.status === "dismissed" || review.status === "different_animals" ? (
                    <Button size="sm" variant="ghost" disabled={busy} loading={busy && pressed === "reopen"} onClick={() => { setPressed("reopen"); void mark("reopen"); }}>Reopen as same animal</Button>
                ) : review.status !== "applied" ? (
                    <Button size="sm" variant="ghost" disabled={busy} loading={busy && pressed === "dismiss"} onClick={() => { setPressed("dismiss"); void mark("dismiss"); }}>Dismiss</Button>
                ) : null}
            </div>
            {message ? <Alert tone="bad" className="mt-3 text-xs">{message}</Alert> : null}
        </article>
    );
}

export default function AdminIdentityReviewClient() {
    const [status, setStatus] = useState("same_animal");
    const [reviews, setReviews] = useState<Review[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    // Separates "first fetch not back yet" from "the queue is empty".
    const [loaded, setLoaded] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/maintenance/identity-review?status=${status}`, {cache: "no-store"});
            const payload = await response.json();
            if (!payload.ok) throw new Error(payload.error);
            setReviews(payload.reviews);
            setCounts(payload.counts);
        } catch (error) {
            setNotice(error instanceof Error ? error.message : "Could not load the queue");
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    }, [status]);

    useEffect(() => {
        void load();
    }, [load]);

    async function scan() {
        setScanning(true);
        setNotice(null);
        try {
            const result = await postJson("/api/admin/maintenance/identity-review/scan?days=7&limit=12", {});
            setNotice(`Scanned ${result.scannedCaptures} captures · ${result.queued} new pairs · ${result.analyzed} analysed · ${result.failed} failed · ${result.pendingRemaining} still waiting`);
            await load();
        } catch (error) {
            setNotice(error instanceof Error ? error.message : "Scan failed");
        } finally {
            setScanning(false);
        }
    }

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Catalog"
                title="Identity review"
                description="Same animal, two AnimalDex numbers · scheduled scan · applied by hand"
                actions={
                    <>
                        <Link href="/admin/maintenance" className={buttonVariants({size: "sm", variant: "ghost"})}>Maintenance</Link>
                        <Button size="sm" onClick={() => void scan()} loading={scanning}>
                            {scanning ? "Scanning…" : "Scan now"}
                        </Button>
                        <RefreshButton loading={loading} onClick={() => void load()} />
                    </>
                }
            />
            <Segmented
                label="Review status"
                className="mt-6"
                value={status}
                onChange={setStatus}
                options={TABS.map(([value, label]) => ({value, label, count: counts[value] ?? 0}))}
            />
            {notice ? <Alert tone="info" className="mt-4">{notice}</Alert> : null}
            {reviews.length === 0 && loaded && !loading ? <EmptyState className="mt-6" title="Nothing here." /> : null}
            {reviews.length === 0 && (!loaded || loading) ? (
                <div role="status" aria-label="Loading" className="mt-6 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {Array.from({length: 3}, (_, index) => (
                        <div key={index} className="border border-line-300 bg-surface-900 p-4">
                            <Skeleton className="h-3 w-2/3" />
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Skeleton className="aspect-square w-full" />
                                <Skeleton className="aspect-square w-full" />
                            </div>
                            <Skeleton className="mt-3 h-3 w-1/2" />
                            <Skeleton className="mt-2 h-2.5 w-full" />
                            <div className="mt-3 flex gap-1.5">
                                <Skeleton className="h-8 w-40" />
                                <Skeleton className="h-8 w-20" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            {reviews.length > 0 ? (
                <div className="mt-6 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {reviews.map((review) => <ReviewCard key={review.id} review={review} onDone={() => void load()} />)}
                </div>
            ) : null}
        </AdminPage>
    );
}
