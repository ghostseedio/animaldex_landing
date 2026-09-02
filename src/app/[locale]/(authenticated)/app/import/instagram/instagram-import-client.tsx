"use client";

import {Suspense, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import {AppEmpty, AppPage, AppPageHeader, AppPrimaryLink, AppProgress, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {trackEvent} from "@/lib/analytics";
import {appStoreUrl, googlePlayUrl} from "@/lib/store-links";
import {
    canImportSelection,
    candidateNeedsRescreen,
    catalogStatusLine,
    connectQueryMessage,
    connectionStatusLabel,
    displayName,
    humanizeImportError,
    IMPORT_SETTING_TAGS,
    indexNumber,
    indexStatusLine,
    indexedTitle,
    isGenuinelyUnknown,
    isSelectableForImport,
    INSTAGRAM_IMPORT_PATH,
    isActiveInstagramConnection,
    isGroupLevel,
    isVideoMedia,
    locationButtonTitle,
    locationSummary,
    mediaPreviewUrl,
    parseConnectQuery,
    primaryButtonTitle,
    primaryReviewAction,
    requiresReauthorization,
    requiresReauthorizationStatus,
    reviewCandidates,
    reviewHint,
    selectedRows,
    selectionBlocker,
    severalIndividualsNote,
    speciesChoices,
    summaryHeadline,
    titleText,
    materializationCostLabel,
    screeningCostLabel,
    screeningBillingSummaryFromQuote,
    REVIEW_BILLING_EXPLAINER,
    SCREENING_QUOTE_EXPLAINER,
    importButtonChargeHint,
    unscreenedPostsBanner,
    type ScreeningBillingSummary,
    type ExternalImportCandidateRow,
    type ExternalImportConnectionRow,
    type ExternalImportOperation,
    type ImportSettingTag,
    type InstagramImportQuote,
    type InstagramMaterializationQuote
} from "@/lib/instagram-import";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {PurchaseChoice} from "@/app/[locale]/(authenticated)/app/_components/purchase-choice";
import {billingStatusIsServerFulfilled, parseBillingQuery} from "@/lib/web-store-catalog";
import {
    ESCALATION_FRAME_POSITIONS,
    extractInstagramReelFrames,
    INITIAL_FRAME_POSITIONS,
    shouldEscalateFrames,
    type InstagramReelFramePayload
} from "@/lib/instagram-reel-frames";

type Phase = "connecting" | "disconnected" | "finding" | "reviewing" | "importing" | "finished";
type Sheet = "location" | "species" | "accuracy" | null;
type Failure = {name: string; reason: string};

type StatusPayload = {
    connection: ExternalImportConnectionRow | null;
    operation: ExternalImportOperation | null;
    candidates: ExternalImportCandidateRow[];
};

const SELECTION_STORAGE_KEY = "animaldex.instagramImport.selectedIds";

function readStoredSelection() {
    if (typeof window === "undefined") return [] as string[];
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(SELECTION_STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
        return [];
    }
}

function writeStoredSelection(ids: Iterable<string>) {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

async function importRequest<T = any>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
    const maxBusyRetries = 8;
    for (let attempt = 0; ; attempt += 1) {
        const response = await fetch("/api/app/import", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action, ...extra})
        });
        const payload = await response.json().catch(() => ({error: "Import failed."}));
        if (response.status === 429 && payload.retryable !== false && attempt < maxBusyRetries) {
            const wait = Math.min(30_000, Math.max(1000, Number(payload.retry_after_ms) || 4000));
            await new Promise((resolve) => setTimeout(resolve, wait));
            continue;
        }
        if (!response.ok) throw new Error(payload.error || "Import failed.");
        return payload as T;
    }
}

async function loadStatus(): Promise<StatusPayload> {
    const response = await fetch("/api/app/import", {cache: "no-store"});
    const payload = await response.json().catch(() => ({error: "Could not load Instagram status."}));
    if (!response.ok) throw new Error(payload.error || "Could not load Instagram status.");
    return payload as StatusPayload;
}

function proxiedMediaUrl(url: string | null | undefined) {
    if (!url) return null;
    return `/api/app/import/media?url=${encodeURIComponent(url)}`;
}

function InstagramImportClientInner() {
    const pathname = usePathname() || INSTAGRAM_IMPORT_PATH;
    const searchParams = useSearchParams();
    const [phase, setPhase] = useState<Phase>("connecting");
    const [connection, setConnection] = useState<ExternalImportConnectionRow | null>(null);
    const [candidates, setCandidates] = useState<ExternalImportCandidateRow[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(connectQueryMessage(parseConnectQuery(searchParams.get("connect"))));
    const [busy, setBusy] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [progressHeadline, setProgressHeadline] = useState("Looking through your posts…");
    const [progressDetail, setProgressDetail] = useState<string | null>(null);
    const [importHeadline, setImportHeadline] = useState("");
    const [importFraction, setImportFraction] = useState(0);
    const [imported, setImported] = useState(0);
    const [failures, setFailures] = useState<Failure[]>([]);
    const [sheet, setSheet] = useState<Sheet>(null);
    const [speciesCandidate, setSpeciesCandidate] = useState<ExternalImportCandidateRow | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [billingNotice, setBillingNotice] = useState<string | null>(null);
    const jobIdRef = useRef<string | null>(null);
    const searchingRef = useRef(false);
    const cancelledRef = useRef(false);
    const quoteResolverRef = useRef<((accepted: boolean) => void) | null>(null);
    const [quote, setQuote] = useState<InstagramImportQuote | null>(null);
    const [materializationQuote, setMaterializationQuote] = useState<InstagramMaterializationQuote | null>(null);
    const [lastScreeningBillingSummary, setLastScreeningBillingSummary] = useState<ScreeningBillingSummary | null>(null);
    const credits = useAppCredits();

    const connected = isActiveInstagramConnection(connection);
    const visibleCandidates = useMemo(() => reviewCandidates(candidates), [candidates]);
    const selectedList = useMemo(() => selectedRows(visibleCandidates, selected), [visibleCandidates, selected]);
    const action = primaryReviewAction(selectedList);
    const blocker = selectionBlocker(selectedList);
    const unscreenedCount = useMemo(
        () => visibleCandidates.filter(candidateNeedsRescreen).length,
        [visibleCandidates],
    );
    const importChargeHint = importButtonChargeHint(action, materializationQuote);

    useEffect(() => {
        writeStoredSelection(selected);
    }, [selected]);

    useEffect(() => {
        if (action !== "importPosts" || selectedList.length === 0) return;
        void importRequest<InstagramMaterializationQuote>("quote-materialization", {
            candidateIds: selectedList.map((row) => row.candidate_id),
        }).then((quoted) => setMaterializationQuote(quoted)).catch(() => undefined);
    }, [action, selectedList]);

    const quoteRef = useRef(quote);
    const materializationQuoteRef = useRef(materializationQuote);
    quoteRef.current = quote;
    materializationQuoteRef.current = materializationQuote;

    useEffect(() => {
        const billing = parseBillingQuery(searchParams.get("billing"));
        if (!billing) return;
        if (billing === "cancel") {
            setBillingNotice("Checkout was cancelled. Your Instagram import is still here. You were not charged.");
            return;
        }
        if (billing === "pending") {
            setBillingNotice("Your payment was received, but your balance is still updating. Refresh the quote, or wait a moment.");
            return;
        }
        const purchaseId = searchParams.get("purchase_id");
        if (!purchaseId) {
            setBillingNotice("Your Instagram import is still here. Refresh the quote if you already paid.");
            return;
        }
        setBillingNotice("Payment received — updating your AnimalDex…");
        let stopped = false;
        (async () => {
            for (let attempt = 0; attempt < 8 && !stopped; attempt += 1) {
                try {
                    const statusUrl = `/api/app/billing/status?purchase_id=${encodeURIComponent(purchaseId)}`;
                    const response = await fetch(statusUrl);
                    const payload = await response.json() as {balance?: number; is_pro?: boolean; fulfilled?: boolean};
                    if (typeof payload.balance === "number") credits.setBalance(payload.balance);
                    if (billingStatusIsServerFulfilled(payload)) {
                        if (payload.is_pro) trackEvent("pro_activated", {source: "import_page"});
                        setBillingNotice(payload.is_pro
                            ? "Pro is active. Instagram Import is included. Refreshing your quote…"
                            : "Your Credits are updated. Refreshing your quote…");
                        trackEvent("web_checkout_completed_server_confirmed", {
                            source: "import_page",
                            pro: Boolean(payload.is_pro),
                            provider: "paddle"
                        });
                        const screening = quoteRef.current;
                        if (screening?.operation_id) {
                            try {
                                const quoted = await importRequest<InstagramImportQuote>("quote-operation", {jobId: screening.operation_id});
                                setQuote(quoted);
                            } catch {
                                // Keep the existing quote; the user can tap Refresh.
                            }
                        }
                        const materialization = materializationQuoteRef.current;
                        if (materialization) {
                            try {
                                const quoted = await importRequest<InstagramMaterializationQuote>("quote-materialization", {
                                    candidateIds: Array.from(readStoredSelection())
                                });
                                setMaterializationQuote(quoted);
                            } catch {
                                // Keep the existing quote; the user can tap Refresh.
                            }
                        }
                        setBillingNotice(payload.is_pro
                            ? "Pro is active. Instagram Import is included."
                            : "Your Credits are updated. Continue when you are ready.");
                        return;
                    }
                } catch {
                    // keep polling
                }
                await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
            }
            if (!stopped) setBillingNotice("Your payment was received, but your balance is still updating. Use Refresh balance.");
        })();
        return () => {
            stopped = true;
        };
    }, [credits, searchParams]);

    const applyStatus = useCallback((payload: StatusPayload, nextPhase?: Phase) => {
        setConnection(payload.connection);
        const nextCandidates = Array.isArray(payload.candidates) ? payload.candidates : [];
        setCandidates(nextCandidates);
        setSelected((current) => {
            const stored = readStoredSelection();
            const merged = new Set([...Array.from(current), ...stored]);
            return new Set(Array.from(merged).filter((id) => {
                const row = nextCandidates.find((candidate) => candidate.candidate_id === id);
                return row != null && isSelectableForImport(row);
            }));
        });
        if (nextPhase) {
            setPhase(nextPhase);
            return;
        }
        if (!isActiveInstagramConnection(payload.connection)) {
            setPhase("disconnected");
            return;
        }
        setPhase(reviewCandidates(nextCandidates).length ? "reviewing" : "disconnected");
    }, []);

    const reload = useCallback(async () => {
        const payload = await loadStatus();
        applyStatus(payload, connected || isActiveInstagramConnection(payload.connection)
            ? (reviewCandidates(payload.candidates).length ? "reviewing" : "disconnected")
            : "disconnected");
        setError(null);
        return payload;
    }, [applyStatus, connected]);

    const confirmQuote = useCallback(async (jobId: string): Promise<boolean> => {
        const quoted = await importRequest<InstagramImportQuote>("quote-operation", {jobId});
        setQuote(quoted);
        if (quoted.accepted || quoted.posts_requiring_processing === 0) {
            setLastScreeningBillingSummary(screeningBillingSummaryFromQuote(quoted));
            if (quoted.accepted) setQuote(null);
            return true;
        }
        trackEvent("instagram_import_quote_viewed", {
            credit_cost: quoted.credit_cost,
            post_count_bucket: quoted.posts_requiring_processing >= 500 ? "500+" : quoted.posts_requiring_processing >= 100 ? "100+" : "under_100",
            pro: quoted.pro_included,
            source: "import_page"
        });
        return new Promise<boolean>((resolve) => {
            quoteResolverRef.current = resolve;
        });
    }, []);

    const continueScreening = useCallback(async (jobId: string, connectionId: string, includeThumbnails: boolean, recheck: boolean) => {
        if (includeThumbnails) {
            setProgressHeadline("Spotting the animals…");
            let screened = 0;
            while (!cancelledRef.current) {
                const batch = await importRequest<{processed: number; remaining: number}>("screen", {
                    connectionId,
                    jobId,
                    limit: 8
                });
                screened += batch.processed ?? 0;
                const total = screened + (batch.remaining ?? 0);
                setProgressDetail(total > 0 ? `${screened} of ${total} checked` : null);
                if (!batch.remaining || !batch.processed) break;
            }
        }

        setProgressHeadline(recheck ? "Re-checking your videos…" : "Taking a closer look at your videos…");
        let done = 0;
        let skippedVideos = 0;
        let cursor: string | null = null;
        type FrameTargetsPage = {targets: Array<{candidate_id: string; media_url: string | null}>; next_cursor: string | null};
        do {
            const page: FrameTargetsPage = await importRequest<FrameTargetsPage>("frame-targets", {
                connectionId,
                jobId,
                cursor,
                limit: 5
            });
            for (const target of page.targets ?? []) {
                if (cancelledRef.current) throw new Error("frame_extraction_interrupted");
                done += 1;
                setProgressDetail(`${done} video${done === 1 ? "" : "s"} checked`);
                const source = proxiedMediaUrl(target.media_url);
                if (!source) {
                    skippedVideos += 1;
                    continue;
                }
                let videoSrc = source;
                let frames: InstagramReelFramePayload[] = [];
                let extractionMeta = {path: "remote" as const, bytesTransferred: 0, durationMs: 0};
                try {
                    try {
                        const initial = await extractInstagramReelFrames({
                            src: videoSrc,
                            positions: INITIAL_FRAME_POSITIONS
                        });
                        frames = initial.frames;
                        extractionMeta = initial;
                    } catch {
                        const refreshed = await importRequest<{
                            media?: Array<{playable_media_reference?: string | null; has_playable_source?: boolean | null}>;
                        }>("media-refresh", {candidateId: target.candidate_id});
                        const playable = refreshed.media?.find((item) => item.has_playable_source && item.playable_media_reference);
                        const retrySource = proxiedMediaUrl(playable?.playable_media_reference);
                        if (!retrySource) throw new Error("frame_extraction_interrupted");
                        videoSrc = retrySource;
                        const initial = await extractInstagramReelFrames({
                            src: videoSrc,
                            positions: INITIAL_FRAME_POSITIONS
                        });
                        frames = initial.frames;
                        extractionMeta = initial;
                    }
                    let result = await importRequest<{escalate?: boolean}>("frame-screen", {
                        candidateId: target.candidate_id,
                        jobId,
                        frames,
                        extraction: {path: extractionMeta.path, bytes_transferred: extractionMeta.bytesTransferred, duration_ms: extractionMeta.durationMs}
                    });
                    if (shouldEscalateFrames(result, frames.length)) {
                        const more = await extractInstagramReelFrames({
                            src: videoSrc,
                            positions: ESCALATION_FRAME_POSITIONS,
                            startIndex: frames.length
                        });
                        frames = frames.concat(more.frames);
                        result = await importRequest("frame-screen", {
                            candidateId: target.candidate_id,
                            jobId,
                            frames,
                            extraction: {path: more.path, bytes_transferred: more.bytesTransferred, duration_ms: more.durationMs}
                        });
                    }
                } catch {
                    if (cancelledRef.current) throw new Error("frame_extraction_interrupted");
                    skippedVideos += 1;
                }
            }
            cursor = page.next_cursor ?? null;
        } while (cursor && !cancelledRef.current);
        return skippedVideos;
    }, []);

    const runSearch = useCallback(async (resume?: ExternalImportOperation | null, connectionId = connection?.connection_id) => {
        if (!connectionId || searchingRef.current) return;
        if (!resume) {
            try {
                const activePayload = await importRequest<{operation: ExternalImportOperation | null}>("active-operation", {connectionId});
                if (activePayload.operation) {
                    resume = activePayload.operation;
                }
            } catch {
                // Start a fresh scan when active-operation cannot be read.
            }
        }
        searchingRef.current = true;
        setIsSearching(true);
        setPhase("finding");
        setError(null);
        cancelledRef.current = false;
        const recheck = resume?.operation_kind === "recheck";
        const thumbnailRescreen = resume?.operation_kind === "recheck"
            && resume.stage === "thumbnail_screening";
        try {
            trackEvent("instagram_scan_started", {source: "import_page"});
            setProgressHeadline(thumbnailRescreen
                ? "Checking your posts again…"
                : recheck ? "Taking another look…" : "Looking for new posts…");
            setProgressDetail(null);
            let jobId = resume?.id ?? null;
            if (resume?.stage === "discovery" || !resume) {
                let scan = await importRequest<{job_id: string; complete: boolean; next_cursor: string | null; source_records_seen: number}>("scan", {
                    ...(resume?.id ? {jobId: resume.id, cursor: resume.discovery_cursor} : {})
                });
                jobId = scan.job_id;
                jobIdRef.current = jobId;
                let seen = scan.source_records_seen ?? 0;
                setProgressDetail(`${seen} posts checked`);
                while (!scan.complete && scan.next_cursor && !cancelledRef.current) {
                    scan = await importRequest("scan", {jobId: scan.job_id, cursor: scan.next_cursor});
                    seen += scan.source_records_seen ?? 0;
                    setProgressDetail(`${seen} posts checked`);
                }
            }
            if (!jobId) throw new Error("missing_operation");
            jobIdRef.current = jobId;
            const accepted = await confirmQuote(jobId);
            if (!accepted) {
                await importRequest("pause-operation", {jobId}).catch(() => undefined);
                setQuote(null);
                setPhase("reviewing");
                return;
            }
            setQuote(null);
            const includeThumbnails = !resume
                || (resume.operation_kind === "scan" && resume.stage !== "frame_screening")
                || thumbnailRescreen;
            const skippedVideos = await continueScreening(jobId, connectionId, includeThumbnails, recheck);
            await importRequest("complete-operation", {jobId});
            const after = await reload();
            setPhase("reviewing");
            if (skippedVideos > 0) {
                setNotice("Some videos could not be checked in this browser. Photos and other posts are still ready to review. You can try those Reels again later, or import them from the iOS app.");
            } else if (recheck && reviewCandidates(after.candidates).length === 0) {
                setNotice("No new animal posts this time.");
            } else {
                setNotice(null);
            }
            trackEvent("instagram_scan_completed", {source: "import_page"});
            trackEvent("instagram_candidate_review_started", {source: "import_page"});
        } catch (caught) {
            const message = humanizeImportError(caught);
            setError(message);
            if (jobIdRef.current) {
                try { await importRequest("pause-operation", {jobId: jobIdRef.current}); } catch { /* keep the grid */ }
            }
            const payload = await loadStatus().catch(() => null);
            if (payload) applyStatus(payload);
            else setPhase(visibleCandidates.length ? "reviewing" : "disconnected");
        } finally {
            searchingRef.current = false;
            setIsSearching(false);
        }
    }, [applyStatus, confirmQuote, connection?.connection_id, continueScreening, reload, visibleCandidates.length]);

    const runRefresh = useCallback(async () => {
        const connectionId = connection?.connection_id;
        if (!connectionId || searchingRef.current) return;
        try {
            const activePayload = await importRequest<{operation: ExternalImportOperation | null}>("active-operation", {connectionId});
            if (activePayload.operation) {
                await runSearch(activePayload.operation, connectionId);
                return;
            }
        } catch {
            // Fall through to rescreen / new-post scan.
        }
        if (visibleCandidates.some(candidateNeedsRescreen)) {
            searchingRef.current = true;
            setIsSearching(true);
            setPhase("finding");
            setError(null);
            cancelledRef.current = false;
            try {
                setProgressHeadline("Checking your posts again…");
                setProgressDetail(null);
                const {jobId} = await importRequest<{jobId: string}>("rescreen-job", {connectionId});
                jobIdRef.current = jobId;
                const accepted = await confirmQuote(jobId);
                if (!accepted) {
                    await importRequest("pause-operation", {jobId}).catch(() => undefined);
                    setQuote(null);
                    setPhase("reviewing");
                    return;
                }
                setQuote(null);
                await continueScreening(jobId, connectionId, true, true);
                await importRequest("complete-operation", {jobId});
                await reload();
            } catch (caught) {
                setError(humanizeImportError(caught));
                if (jobIdRef.current) {
                    try { await importRequest("pause-operation", {jobId: jobIdRef.current}); } catch { /* keep grid */ }
                }
                await reload().catch(() => undefined);
                setPhase("reviewing");
                return;
            } finally {
                searchingRef.current = false;
                setIsSearching(false);
            }
        }
        await runSearch(undefined, connectionId);
    }, [confirmQuote, connection?.connection_id, continueScreening, reload, runSearch, visibleCandidates]);

    useEffect(() => {
        let active = true;
        trackEvent("instagram_import_page_view", {source: "import_page"});
        const connectStatus = parseConnectQuery(searchParams.get("connect"));
        if (connectStatus === "ok") trackEvent("instagram_connect_succeeded", {source: "import_page"});
        if (connectStatus === "failed") trackEvent("instagram_connect_failed", {source: "oauth_return"});
        if (connectStatus === "cancelled") trackEvent("instagram_connect_failed", {source: "oauth_cancelled"});
        (async () => {
            try {
                const payload = await loadStatus();
                if (!active) return;
                applyStatus(payload);
                const activeConnection = payload.connection;
                const stage = payload.operation?.stage;
                const shouldResumeScreening = stage === "discovery"
                    || stage === "thumbnail_screening"
                    || stage === "frame_screening";
                if (payload.operation && activeConnection && isActiveInstagramConnection(activeConnection) && shouldResumeScreening) {
                    await runSearch(payload.operation, activeConnection.connection_id);
                }
            } catch (caught) {
                if (!active) return;
                setError(humanizeImportError(caught));
                setPhase("disconnected");
            }
        })();
        return () => {
            active = false;
            cancelledRef.current = true;
            if (jobIdRef.current) {
                void importRequest("pause-operation", {jobId: jobIdRef.current}).catch(() => undefined);
            }
        };
        // Intentionally run once on mount so a durable job can resume.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden && jobIdRef.current && searchingRef.current) {
                cancelledRef.current = true;
                void importRequest("pause-operation", {jobId: jobIdRef.current}).catch(() => undefined);
                searchingRef.current = false;
                setIsSearching(false);
                setNotice("Search paused. Open this screen again to continue.");
                return;
            }
            if (!document.hidden && connection?.connection_id && !searchingRef.current) {
                void loadStatus().then((payload) => {
                    if (payload.operation && isActiveInstagramConnection(payload.connection)) {
                        cancelledRef.current = false;
                        return runSearch(payload.operation, payload.connection?.connection_id);
                    }
                    return undefined;
                }).catch(() => undefined);
            }
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [connection?.connection_id, runSearch]);

    async function connect() {
        setError(null);
        trackEvent("instagram_connect_started", {source: "import_page"});
        try {
            const origin = window.location.origin;
            const returnTo = `${origin}${pathname.startsWith("http") ? "" : pathname}`;
            const result = await importRequest<{authorize_url: string}>("oauth-start", {
                forceReauth: true,
                returnTo
            });
            window.location.assign(result.authorize_url);
        } catch (caught) {
            setError(humanizeImportError(caught));
            trackEvent("instagram_connect_failed", {source: "import_page"});
        }
    }

    async function confirmLocation(place: {latitude: number; longitude: number; label: string | null; countryCode: string | null}) {
        setBusy(true);
        try {
            await importRequest("confirm-location", {
                candidateIds: Array.from(selected),
                latitude: place.latitude,
                longitude: place.longitude,
                label: place.label,
                countryCode: place.countryCode
            });
            await reload();
            setSheet(null);
        } catch (caught) {
            setError(humanizeImportError(caught));
        } finally {
            setBusy(false);
        }
    }

    async function skipLocation() {
        setBusy(true);
        try {
            await importRequest("skip-location", {candidateIds: Array.from(selected)});
            await reload();
            setSheet(null);
        } catch (caught) {
            setError(humanizeImportError(caught));
        } finally {
            setBusy(false);
        }
    }

    async function confirmSpecies(candidateId: string, speciesId: string) {
        setBusy(true);
        try {
            await importRequest("set-species", {candidateId, speciesId});
            await reload();
            setSheet(null);
            setSpeciesCandidate(null);
        } catch (caught) {
            setError(humanizeImportError(caught));
        } finally {
            setBusy(false);
        }
    }

    async function importSelected(settingTag: ImportSettingTag) {
        if (!canImportSelection(selectedList)) return;
        setBusy(true);
        let acceptedQuoteId: string | null = null;
        try {
            let priced = materializationQuote ?? await importRequest<InstagramMaterializationQuote>("quote-materialization", {
                candidateIds: selectedList.map((row) => row.candidate_id)
            });
            setMaterializationQuote(priced);
            if (!priced.pro_included && priced.credit_cost > 0 && !priced.sufficient_credits) {
                setBusy(false);
                return;
            }
            priced = await importRequest<InstagramMaterializationQuote>("accept-materialization", {quoteId: priced.quote_id});
            setMaterializationQuote(priced);
            acceptedQuoteId = priced.quote_id;
            credits.setBalance(priced.balance ?? credits.balance ?? 0);
            await importRequest("attest", {candidateIds: selectedList.map((row) => row.candidate_id), settingTag});
        } catch (caught) {
            setBusy(false);
            setError(humanizeImportError(caught));
            return;
        }
        setBusy(false);
        setSheet(null);
        setPhase("importing");
        setImportFraction(0);
        let nextImported = 0;
        const nextFailures: Failure[] = [];
        for (let index = 0; index < selectedList.length; index += 1) {
            const row = selectedList[index];
            setImportHeadline(selectedList.length === 1
                ? `Adding ${displayName(row)}…`
                : `Adding ${displayName(row)} — ${index + 1} of ${selectedList.length}`);
            try {
                await importRequest("materialize", {candidateId: row.candidate_id});
                nextImported += 1;
            } catch (caught) {
                nextFailures.push({name: displayName(row), reason: humanizeImportError(caught)});
            }
            setImportFraction((index + 1) / selectedList.length);
        }
        if (acceptedQuoteId) {
            await importRequest("settle-materialization", {quoteId: acceptedQuoteId}).catch(() => undefined);
        }
        setMaterializationQuote(null);
        setImported(nextImported);
        setFailures(nextFailures);
        setSelected(new Set());
        await reload().catch(() => undefined);
        setPhase("finished");
        trackEvent(nextFailures.length && nextImported ? "instagram_import_partial_failure" : nextImported ? "instagram_import_completed" : "instagram_import_partial_failure", {
            source: "import_page"
        });
    }

    const connectScreen = (
        <AppSurface className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/20">
                <AppIcon name="camera" className="h-7 w-7" />
            </span>
            <h2 className="mt-6 max-w-md font-display text-3xl font-bold text-white">Bring your Instagram animals into AnimalDex</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-white/55 md:text-base">
                We will look through your posts for animals and add the ones you choose to your Dex.
            </p>
            {connected ? (
                <>
                    <p className="mt-5 text-sm font-bold text-primary-200">{connectionStatusLabel(connection)}</p>
                    <button type="button" onClick={() => void runRefresh()} disabled={isSearching} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black">
                        Check for new posts
                    </button>
                    <button type="button" onClick={() => void connect()} className="mt-3 text-sm font-bold text-white/45 hover:text-white">
                        Use a different account
                    </button>
                </>
            ) : (
                <button type="button" onClick={() => void connect()} className="mt-8 inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black">
                    Connect Instagram
                </button>
            )}
            {requiresReauthorization(error) || requiresReauthorizationStatus(connection) ? (
                <p className="mt-4 text-sm text-amber-200">Instagram needs you to sign in again.</p>
            ) : null}
            {error ? <p className="mt-4 max-w-md text-sm text-red-300">{error}</p> : null}
            <p className="mt-8 max-w-md text-xs leading-6 text-white/35">
                Instagram import needs a compatible Instagram professional account. Personal accounts cannot always connect.
            </p>
        </AppSurface>
    );

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Connected services"
                title="Import from Instagram"
                description="Find animal posts you already photographed and add the ones you choose to your Dex."
                action={phase === "reviewing" ? (
                    <button type="button" onClick={() => void runRefresh()} disabled={isSearching || busy} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/80">
                        Check for new posts
                    </button>
                ) : null}
            />
            {billingNotice ? (
                <p className="mb-4 rounded-2xl border border-primary-400/20 bg-primary-400/10 px-4 py-3 text-sm text-primary-100" role="status" aria-live="polite">
                    {billingNotice}
                </p>
            ) : null}

            {phase === "connecting" ? (
                <AppSurface className="flex min-h-[22rem] items-center justify-center">
                    <p className="text-sm font-bold text-white/45">Checking Instagram…</p>
                </AppSurface>
            ) : null}
            {phase === "disconnected" ? connectScreen : null}
            {phase === "finding" ? (
                <AppSurface className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-primary-400" />
                    <h2 className="mt-6 font-display text-3xl font-bold text-white">{progressHeadline}</h2>
                    {progressDetail ? <p className="mt-2 text-sm text-white/45">{progressDetail}</p> : null}
                    <p className="mt-5 max-w-md text-xs leading-6 text-white/35">
                        We&apos;ll process your posts in batches. Progress is saved — you can leave and come back anytime.
                    </p>
                    {progressDetail && /\d{3,}/.test(progressDetail) ? (
                        <p className="mt-2 max-w-md text-xs leading-6 text-white/30">
                            Processing is taking a little longer because your archive is large.
                        </p>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => {
                            cancelledRef.current = true;
                            if (jobIdRef.current) {
                                void importRequest("pause-operation", {jobId: jobIdRef.current}).catch(() => undefined);
                            }
                        }}
                        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white/70"
                    >
                        Pause
                    </button>
                </AppSurface>
            ) : null}
            {phase === "reviewing" ? (
                visibleCandidates.length === 0 ? (
                    <div className="space-y-4">
                        {notice && /could not be checked/i.test(notice) ? (
                            <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{notice}</p>
                        ) : null}
                    <AppEmpty
                        icon="search"
                        title={notice && /No new animal posts/i.test(notice) ? "No new animal posts" : "No animal posts found yet"}
                        detail={notice && /No new animal posts/i.test(notice)
                            ? "We did not find additional animal posts since the last check."
                            : notice && /could not be checked/i.test(notice)
                                ? "Photos may still appear after another check. Videos this browser could not sample were skipped."
                            : "We did not spot any animals we could identify in your recent posts."}
                        action={<button type="button" onClick={() => void runRefresh()} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white">Check for new posts</button>}
                    />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
                        {notice ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{notice}</p> : null}
                        {unscreenedPostsBanner(unscreenedCount) ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-primary-400/20 bg-primary-400/10 px-4 py-3">
                                <AppIcon name="refresh" className="h-4 w-4 shrink-0 text-primary-200" />
                                <p className="flex-1 text-sm text-primary-100">{unscreenedPostsBanner(unscreenedCount)}</p>
                                <button
                                    type="button"
                                    onClick={() => void runRefresh()}
                                    disabled={isSearching || busy}
                                    className="shrink-0 text-sm font-bold text-primary-200"
                                >
                                    Check now
                                </button>
                            </div>
                        ) : null}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {visibleCandidates.map((candidate) => {
                                const isSelected = selected.has(candidate.candidate_id);
                                const selectable = isSelectableForImport(candidate);
                                const media = candidate.media[0];
                                const preview = proxiedMediaUrl(mediaPreviewUrl(media));
                                const catalog = catalogStatusLine(candidate);
                                const indexLine = indexStatusLine(candidate);
                                const note = severalIndividualsNote(candidate);
                                return (
                                    <button
                                        key={candidate.candidate_id}
                                        type="button"
                                        disabled={!selectable}
                                        onClick={() => {
                                            if (!selectable) return;
                                            setSelected((current) => {
                                                const next = new Set(current);
                                                if (next.has(candidate.candidate_id)) next.delete(candidate.candidate_id);
                                                else next.add(candidate.candidate_id);
                                                return next;
                                            });
                                        }}
                                        className={`overflow-hidden rounded-[1.2rem] border text-left transition ${!selectable ? "cursor-not-allowed opacity-55" : ""} ${isSelected ? "border-primary-400 bg-primary-400/10" : "border-white/10 bg-[#121212]"}`}
                                    >
                                        <div className="relative aspect-square bg-white/5">
                                            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : null}
                                            {isVideoMedia(media) ? (
                                                <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[0.62rem] font-black text-white">VIDEO</span>
                                            ) : null}
                                            {isSelected ? (
                                                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary-400 text-black">
                                                    <AppIcon name="check" className="h-3.5 w-3.5" />
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="space-y-1 p-3">
                                            <p className="truncate text-sm font-bold text-white">{titleText(candidate)}</p>
                                            {catalog ? <p className="truncate text-[0.7rem] font-bold text-amber-200">{catalog}</p> : null}
                                            {!catalog && indexLine ? (
                                                <p className={`truncate text-[0.7rem] font-bold ${isGenuinelyUnknown(candidate) ? "text-amber-200" : indexNumber(candidate) != null ? "text-primary-200" : "text-white/45"}`}>
                                                    {indexLine}
                                                </p>
                                            ) : null}
                                            {note ? <p className="truncate text-[0.7rem] font-bold text-amber-200">{note}</p> : null}
                                            {!catalog && !indexLine && !note ? <p className="truncate text-[0.7rem] text-white/40">{locationSummary(candidate)}</p> : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="sticky bottom-20 z-20 space-y-3 rounded-[1.35rem] border border-white/10 bg-[#101010]/95 p-4 backdrop-blur md:bottom-6">
                            {blocker ? <p className={`text-xs font-bold ${blocker.tone === "warn" ? "text-amber-200" : "text-white/45"}`}>{blocker.message}</p> : null}
                            {lastScreeningBillingSummary ? (
                                <div className="space-y-0.5">
                                    <p className="text-xs text-white/55">{lastScreeningBillingSummary.headline}</p>
                                    {lastScreeningBillingSummary.detail ? (
                                        <p className="text-[0.7rem] text-white/35">{lastScreeningBillingSummary.detail}</p>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    disabled={selected.size === 0 || busy}
                                    onClick={() => setSheet("location")}
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white"
                                >
                                    {locationButtonTitle(selected.size)}
                                </button>
                                <button
                                    type="button"
                                    disabled={action === "disabled" || busy}
                                    onClick={() => {
                                        if (action === "confirmSpecies") {
                                            const next = selectedList.find((row) => !row.species_profile_id) ?? null;
                                            setSpeciesCandidate(next);
                                            setSheet("species");
                                            return;
                                        }
                                        if (action === "importPosts") {
                                            setError(null);
                                            setSheet("accuracy");
                                            void importRequest<InstagramMaterializationQuote>("quote-materialization", {
                                                candidateIds: selectedList.map((row) => row.candidate_id)
                                            }).then((quoted) => setMaterializationQuote(quoted)).catch((caught) => {
                                                setError(humanizeImportError(caught));
                                            });
                                        }
                                    }}
                                    className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-3 text-sm font-black ${action === "disabled" ? "bg-white/10 text-white/35" : "bg-primary-400 text-black"}`}
                                >
                                    {primaryButtonTitle(action, selected.size)}
                                </button>
                            </div>
                            <p className={`text-[0.7rem] ${importChargeHint ? "text-white/55" : "text-white/35"}`}>
                                {importChargeHint ?? reviewHint(action, selectedList)}
                            </p>
                            <p className="text-[0.7rem] text-white/30">{REVIEW_BILLING_EXPLAINER}</p>
                        </div>
                    </div>
                )
            ) : null}
            {phase === "importing" ? (
                <AppSurface className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="w-full max-w-md"><AppProgress value={importFraction * 100} /></div>
                    <h2 className="mt-6 font-display text-3xl font-bold text-white">{importHeadline}</h2>
                    <p className="mt-3 max-w-md text-xs text-white/35">
                        Downloading originals one at a time. Already added captures stay in your Dex if you leave.
                    </p>
                </AppSurface>
            ) : null}
            {phase === "finished" ? (
                <AppSurface className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-16 text-center">
                    <h2 className="font-display text-3xl font-bold text-white">{summaryHeadline(imported, failures.length)}</h2>
                    {failures.length ? (
                        <ul className="mt-6 w-full max-w-md space-y-3 text-left">
                            {failures.map((failure) => (
                                <li key={`${failure.name}-${failure.reason}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <p className="font-bold text-white">{failure.name}</p>
                                    <p className="mt-1 text-sm text-white/45">{failure.reason}</p>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {imported > 0 ? (
                        <p className="mt-4 max-w-md text-sm leading-6 text-white/55">
                            {imported === 1 ? "1 animal" : `${imported} animals`} added to your AnimalDex. Totals are unique AnimalDex entries — some may be group-level identities, not species names.
                        </p>
                    ) : null}
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        {imported > 0 ? <AppPrimaryLink href="/app/collection">View my AnimalDex</AppPrimaryLink> : null}
                        <button type="button" onClick={() => void reload()} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white/70">
                            {imported > 0 ? "Import more" : "Back to posts"}
                        </button>
                    </div>
                    {imported > 0 ? (
                        <p className="mt-8 max-w-md text-sm leading-6 text-white/45">
                            Get the app to capture new animals in the field.{" "}
                            <a href={appStoreUrl} className="font-bold text-primary-200" onClick={() => trackEvent("mobile_download_clicked", {store: "app_store", source: "import_result"})}>App Store</a>
                            {" · "}
                            <a href={googlePlayUrl} className="font-bold text-primary-200" onClick={() => trackEvent("mobile_download_clicked", {store: "google_play", source: "import_result"})}>Google Play</a>
                        </p>
                    ) : null}
                </AppSurface>
            ) : null}

            {quote && !quote.accepted ? (
                <QuoteSheet
                    quote={quote}
                    busy={busy}
                    onCancel={() => {
                        quoteResolverRef.current?.(false);
                        quoteResolverRef.current = null;
                        setQuote(null);
                    }}
                    onRefreshQuote={async () => {
                        const jobId = quote.operation_id;
                        setBusy(true);
                        try {
                            const quoted = await importRequest<InstagramImportQuote>("quote-operation", {jobId});
                            setQuote(quoted);
                        } catch (caught) {
                            setError(humanizeImportError(caught));
                        } finally {
                            setBusy(false);
                        }
                    }}
                    onAccept={async () => {
                        if (!quote.sufficient_credits && !quote.pro_included && quote.credit_cost > 0) {
                            trackEvent("instagram_import_insufficient_credits", {
                                credit_cost: quote.credit_cost,
                                pro: false,
                                source: "import_page"
                            });
                            return;
                        }
                        setBusy(true);
                        try {
                            const accepted = await importRequest<InstagramImportQuote>("accept-quote", {
                                jobId: quote.operation_id,
                                quoteId: quote.quote_id
                            });
                            credits.setBalance(accepted.balance ?? quote.balance - quote.credit_cost);
                            trackEvent("instagram_import_charge_confirmed", {
                                credit_cost: accepted.credit_cost ?? quote.credit_cost,
                                pro: accepted.pro_included ?? quote.pro_included,
                                source: "import_page"
                            });
                            trackEvent("instagram_import_quote_accepted", {
                                credit_cost: accepted.credit_cost ?? quote.credit_cost,
                                pro: accepted.pro_included ?? quote.pro_included,
                                source: "import_page"
                            });
                            setLastScreeningBillingSummary(
                                screeningBillingSummaryFromQuote({...quote, ...accepted}),
                            );
                            quoteResolverRef.current?.(true);
                            quoteResolverRef.current = null;
                            setQuote(null);
                        } catch (caught) {
                            setError(humanizeImportError(caught));
                            trackEvent("instagram_import_charge_failed", {
                                credit_cost: quote.credit_cost,
                                source: "import_page"
                            });
                            if (String(caught).includes("insufficient_credits")) {
                                trackEvent("instagram_import_insufficient_credits", {
                                    credit_cost: quote.credit_cost,
                                    pro: false,
                                    source: "import_page"
                                });
                            }
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            ) : null}
            {sheet === "location" ? (
                <LocationSheet
                    count={selected.size}
                    busy={busy}
                    onCancel={() => setSheet(null)}
                    onConfirm={(place) => void confirmLocation(place)}
                    onSkip={() => void skipLocation()}
                />
            ) : null}
            {sheet === "species" && speciesCandidate ? (
                <SpeciesSheet
                    candidate={speciesCandidate}
                    busy={busy}
                    onCancel={() => { setSheet(null); setSpeciesCandidate(null); }}
                    onConfirm={(speciesId) => void confirmSpecies(speciesCandidate.candidate_id, speciesId)}
                />
            ) : null}
            {sheet === "accuracy" ? (
                <AccuracySheet
                    candidates={selectedList}
                    quote={materializationQuote}
                    error={error}
                    busy={busy}
                    onCancel={() => { setSheet(null); setMaterializationQuote(null); }}
                    onRefreshQuote={async () => {
                        setBusy(true);
                        try {
                            const quoted = await importRequest<InstagramMaterializationQuote>("quote-materialization", {
                                candidateIds: selectedList.map((row) => row.candidate_id)
                            });
                            setMaterializationQuote(quoted);
                        } catch (caught) {
                            setError(humanizeImportError(caught));
                        } finally {
                            setBusy(false);
                        }
                    }}
                    onConfirm={(setting) => void importSelected(setting)}
                />
            ) : null}
        </AppPage>
    );
}

function QuoteSheet({
    quote,
    busy,
    onCancel,
    onAccept,
    onRefreshQuote
}: {
    quote: InstagramImportQuote;
    busy: boolean;
    onCancel: () => void;
    onAccept: () => void;
    onRefreshQuote: () => void;
}) {
    const insufficient = !quote.pro_included && quote.credit_cost > 0 && !quote.sufficient_credits;
    const costLabel = screeningCostLabel(quote);
    const balanceLabel = quote.balance === 1 ? "1 Credit" : `${quote.balance} Credits`;
    return (
        <SheetFrame title="Ready to check your archive" onCancel={onCancel}>
            <p className="text-sm text-white/60">
                {quote.total_posts_seen} Instagram posts found
                <br />
                {quote.posts_requiring_processing} posts need AnimalDex screening
                {(quote.posts_remaining_after_batch ?? 0) > 0
                    ? ` · ${quote.posts_remaining_after_batch} more can be checked in a later batch`
                    : ""}
            </p>
            <p className="mt-3 text-xs leading-5 text-white/40">{SCREENING_QUOTE_EXPLAINER}</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/35">Screening cost</p>
                <p className="mt-2 font-display text-3xl font-bold text-white">{costLabel}</p>
                <p className="mt-2 text-xs leading-5 text-white/45">{quote.pricing_explanation}</p>
                <p className="mt-3 text-xs text-white/35">
                    {quote.pro_included ? null : `Balance: ${balanceLabel}`}
                    {!quote.pro_included && insufficient ? ` · ${quote.credit_cost === 1 ? "1 Credit" : `${quote.credit_cost} Credits`} needed` : ""}
                </p>
            </div>
            <p className="mt-4 text-[0.7rem] leading-5 text-white/30">
                AnimalDex Credits are in-app currency and cannot be withdrawn for cash.
            </p>
            <div className="mt-6 flex flex-col gap-3">
                {insufficient ? (
                    <PurchaseChoice
                        needed={quote.credit_cost}
                        balance={quote.balance}
                        returnPath={INSTAGRAM_IMPORT_PATH}
                        source="import_screening"
                        onRefresh={onRefreshQuote}
                    />
                ) : (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onAccept}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black"
                    >
                        {quote.pro_included
                            ? "Continue — included with Pro"
                            : quote.credit_cost === 0
                                ? "Continue"
                                : `Continue for ${costLabel}`}
                    </button>
                )}
                <button type="button" onClick={onCancel} className="text-sm font-bold text-white/45">Cancel</button>
            </div>
        </SheetFrame>
    );
}

function SheetFrame({title, children, onCancel}: {title: string; children: React.ReactNode; onCancel: () => void}) {
    return (
        <div className="fixed inset-0 z-50">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-sheet-title"
                className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-[#101010] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[1.6rem]"
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 id="import-sheet-title" className="font-display text-2xl font-bold text-white">{title}</h3>
                    <button type="button" aria-label="Close" onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/60">
                        <AppIcon name="close" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function LocationSheet({
    count,
    busy,
    onCancel,
    onConfirm,
    onSkip
}: {
    count: number;
    busy: boolean;
    onCancel: () => void;
    onConfirm: (place: {latitude: number; longitude: number; label: string | null; countryCode: string | null}) => void;
    onSkip: () => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Array<{label: string; latitude: number; longitude: number; countryCode: string | null}>>([]);
    const [selected, setSelected] = useState<{label: string; latitude: number; longitude: number; countryCode: string | null} | null>(null);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 3) {
            setResults([]);
            return;
        }
        const timer = window.setTimeout(async () => {
            setSearching(true);
            try {
                const response = await fetch(`/api/locations/geocode?q=${encodeURIComponent(trimmed)}`);
                const payload = await response.json() as {places?: Array<{label: string; latitude: number; longitude: number; countryCode: string | null}>};
                setResults(payload.places ?? []);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => window.clearTimeout(timer);
    }, [query]);

    return (
        <SheetFrame title={count === 1 ? "Where was this?" : "Where were these?"} onCancel={onCancel}>
            <p className="text-sm text-white/45">
                {count === 1 ? "This location will be saved to 1 post." : `This location will be saved to all ${count} selected posts.`}
            </p>
            <label className="mt-4 block">
                <span className="sr-only">Search for a place</span>
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search for a place"
                    enterKeyHint="search"
                    autoComplete="off"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-primary-400/50"
                    onFocus={(event) => event.currentTarget.scrollIntoView({block: "center", behavior: "smooth"})}
                />
            </label>
            {searching ? <p className="mt-3 text-xs text-white/35">Searching…</p> : null}
            <div className="mt-3 space-y-2">
                {results.map((place) => (
                    <button
                        key={`${place.latitude}-${place.longitude}-${place.label}`}
                        type="button"
                        onClick={() => setSelected(place)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${selected?.label === place.label ? "border-primary-400 bg-primary-400/10 text-white" : "border-white/10 text-white/75"}`}
                    >
                        {place.label}
                    </button>
                ))}
            </div>
            <button
                type="button"
                disabled={!selected || busy}
                onClick={() => selected && onConfirm(selected)}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/35"
            >
                {count === 1 ? "Confirm location" : `Confirm for ${count} posts`}
            </button>
            <button type="button" disabled={busy} onClick={onSkip} className="mt-3 w-full text-center text-sm font-bold text-white/45">
                {count === 1 ? "I don't know" : `I don't know for these ${count}`}
            </button>
            <p className="mt-2 text-xs leading-5 text-amber-200/80">
                A confirmed capture location is required to import this post. Marking it unknown keeps it out of your review queue.
            </p>
        </SheetFrame>
    );
}

function SpeciesSheet({
    candidate,
    busy,
    onCancel,
    onConfirm
}: {
    candidate: ExternalImportCandidateRow;
    busy: boolean;
    onCancel: () => void;
    onConfirm: (speciesId: string) => void;
}) {
    const choices = speciesChoices(candidate);
    const [selectedId, setSelectedId] = useState(choices[0]?.species_profile_id ?? "");
    const emptyDetail = candidate.catalog_state === "pending"
        ? "An AnimalDex entry is being prepared for this animal. Check back once it's ready."
        : candidate.catalog_state === "broad"
            ? "The identification is too broad to import yet."
            : candidate.catalog_state === "needs_review"
                ? "This identification still needs catalog review."
                : "There is no species to confirm for this post.";

    return (
        <SheetFrame title="What animal is this?" onCancel={onCancel}>
            <p className="text-sm font-bold text-white">{titleText(candidate)}</p>
            {severalIndividualsNote(candidate) ? <p className="mt-1 text-xs font-bold text-amber-200">{severalIndividualsNote(candidate)}</p> : null}
            {choices.length === 0 ? (
                <p className="mt-6 text-sm leading-6 text-white/55">{emptyDetail}</p>
            ) : (
                <>
                    <p className="mt-3 text-sm text-white/45">Tap the animal this post shows, then confirm.</p>
                    <div className="mt-4 space-y-2">
                        {choices.map((match, index) => (
                            <button
                                key={match.species_profile_id}
                                type="button"
                                onClick={() => setSelectedId(match.species_profile_id)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedId === match.species_profile_id ? "border-primary-400 bg-primary-400/10" : "border-white/10"}`}
                            >
                                {index === 0 && choices.length > 1 ? <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-primary-200">Best match</p> : null}
                                <p className="font-bold text-white">{indexedTitle(match)}</p>
                                {match.scientific_name ? <p className="text-xs italic text-white/40">{match.scientific_name}</p> : null}
                                {isGroupLevel(match) ? <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/40">Group</p> : null}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        disabled={!selectedId || busy}
                        onClick={() => onConfirm(selectedId)}
                        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/35"
                    >
                        Confirm species
                    </button>
                </>
            )}
        </SheetFrame>
    );
}

function AccuracySheet({
    candidates,
    quote,
    error,
    busy,
    onCancel,
    onConfirm,
    onRefreshQuote
}: {
    candidates: ExternalImportCandidateRow[];
    quote: InstagramMaterializationQuote | null;
    error: string | null;
    busy: boolean;
    onCancel: () => void;
    onConfirm: (setting: ImportSettingTag) => void;
    onRefreshQuote: () => void;
}) {
    const [setting, setSetting] = useState<ImportSettingTag>("Wild");
    const [attested, setAttested] = useState(false);
    const insufficient = Boolean(quote && !quote.pro_included && quote.credit_cost > 0 && !quote.sufficient_credits);
    const costLabel = quote ? materializationCostLabel(quote) : "";
    const balanceLabel = quote && quote.balance === 1 ? "1 Credit" : `${quote?.balance ?? 0} Credits`;
    return (
        <SheetFrame title="Confirm details" onCancel={onCancel}>
            <p className="text-sm leading-6 text-white/55">Confirm these details are accurate. Imported posts are published to Discover.</p>
            <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                {candidates.map((candidate) => (
                    <div key={candidate.candidate_id}>
                        <p className="font-bold text-white">{titleText(candidate)}</p>
                        <p className="text-xs text-white/40">{locationSummary(candidate)}</p>
                    </div>
                ))}
            </div>
            {quote ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/35">Import cost</p>
                    <p className="mt-2 font-display text-3xl font-bold text-white">{costLabel}</p>
                    <p className="mt-2 text-xs leading-5 text-white/45">{quote.pricing_explanation}</p>
                    {quote.pro_included ? null : <p className="mt-3 text-xs text-white/35">Balance: {balanceLabel}</p>}
                    {insufficient ? <p className="mt-2 text-sm text-red-300">You do not have enough Credits to import these animals.</p> : null}
                </div>
            ) : null}
            <p className="mt-5 text-sm font-bold text-white">Setting</p>
            <div className="mt-2 flex flex-wrap gap-2">
                {IMPORT_SETTING_TAGS.map((tag) => (
                    <button
                        key={tag}
                        type="button"
                        onClick={() => setSetting(tag)}
                        className={`rounded-full px-3 py-2 text-sm font-bold ${setting === tag ? "bg-primary-400 text-black" : "bg-white/10 text-white/70"}`}
                    >
                        {tag}
                    </button>
                ))}
            </div>
            <label className="mt-5 flex items-start gap-3 text-sm text-white/80">
                <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} className="mt-1" />
                I confirm these details are accurate
            </label>
            <p className="mt-3 text-xs leading-5 text-amber-200">False or misleading details can result in an account strike. Three strikes suspend the account.</p>
            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
            {insufficient && quote ? (
                <PurchaseChoice
                    needed={quote.credit_cost}
                    balance={quote.balance}
                    returnPath={INSTAGRAM_IMPORT_PATH}
                    source="import_materialization"
                    onRefresh={onRefreshQuote}
                />
            ) : (
            <button
                type="button"
                disabled={!attested || busy}
                onClick={() => onConfirm(setting)}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/35"
            >
                Confirm and import
            </button>
            )}
        </SheetFrame>
    );
}

export default function InstagramImportClient() {
    return (
        <Suspense fallback={<AppPage><AppSurface className="flex min-h-[22rem] items-center justify-center"><p className="text-sm text-white/45">Loading Instagram import…</p></AppSurface></AppPage>}>
            <InstagramImportClientInner />
        </Suspense>
    );
}
