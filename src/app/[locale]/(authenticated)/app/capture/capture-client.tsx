"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {storeCaptureReveal} from "@/lib/capture-reveal";
import {CAPTURE_RULES_TEXT, captureRulesLanguage, isRightToLeftLanguage} from "@/lib/capture-rules-text";
import {captureSourceForEntry, libraryNeedsPlace, needsCaptureRules, plusItemInput, takePhotoOpensCameraApp, type CaptureEntry, type WebCaptureSource} from "@/lib/capture-entry";
import {takePendingCaptureFile} from "@/lib/capture-handoff";
import {cameraRollServerPayload, checkCameraRollPhoto, type CameraRollPhotoMetadata, type CameraRollRejection} from "@/lib/camera-roll-photo-checks";
import {captureFailureActions, captureFailurePresentation, classifyCaptureFailure} from "@/lib/capture-failure";
import {captureProgressSnapshot} from "@/lib/capture-progress-copy";
import {
    CAPTURE_WORDS_EN,
    captureCostFootnote,
    captureCreditShortfall,
    captureShowsFreeWithPro,
    fillCaptureWords,
    type CaptureWords
} from "@/lib/capture-words";
import {acceptCommunityTerms, hasAcceptedCommunityTerms} from "@/lib/community-terms";

type Phase = "permission" | "cameraDenied" | "rules" | "terms" | "live" | "review" | "uploading" | "analyzing" | "credits" | "complete" | "failed";
type Coordinates = {latitude: number; longitude: number; at: number};
type Wallet = {balance: number | null; isPro: boolean};
type Place = {latitude: number; longitude: number; label: string | null; countryCode: string | null};
/** A library photo's place: the file's own pin (unconfirmed until the person says so) or the one they picked. */
type RollPlace = {place: Place; confirmed: boolean; fromPhoto: boolean};
/** A capture that stopped: its code, and what a Retry can reuse. */
type Failure = {code: string; captureId: string | null; uploaded: boolean; exhausted: boolean};
type RefusalKey = keyof CaptureWords["refusals"];

/** What identifying one photo costs; the server charges it (analyze-capture). */
const PHOTO_CREDIT_COST = 2;

// The rules every capture is held to, worded and translated as in the apps
// (lib/capture-rules-text, generated from the iOS catalog). Bump the version
// with the apps' CaptureRules.version.
const CAPTURE_RULES_VERSION = 1;

/** A fix older than this is refreshed before it is attached to a capture. */
const LOCATION_FRESH_MS = 120_000;
/** The analysis size the apps send; a library original is cut to it (and loses its EXIF, which travels as claims). */
const ANALYSIS_MAX_PIXELS = 1280;
/** How long the screen keeps reading a capture before saying it could not finish. */
const POLL_LIMIT_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 2000;

/**
 * DEV ONLY (dev/capture/plus): the review drawn from a fixture, no network.
 * `rejected` is a pick turned away; `credits` a balance short of the cost.
 */
export type CaptureGalleryFixture = {entry: CaptureEntry; imageUrl: string; state: "idle" | "review" | "rejected" | "credits"};

class CaptureRefusal extends Error {
    constructor(readonly key: RefusalKey) {
        super(key);
    }
}

function currentPosition() {
    return new Promise<Coordinates>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new CaptureRefusal("location_unsupported"));
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({latitude: position.coords.latitude, longitude: position.coords.longitude, at: Date.now()}),
            () => reject(new CaptureRefusal("location_denied")),
            {enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000}
        );
    });
}

/**
 * The picked file as a JPEG no larger than the analysis size, upright
 * (`imageOrientation: "from-image"` bakes the EXIF orientation in, as ImageIO
 * does on iOS). The apps send this same 1280 px analysis JPEG.
 */
async function toAnalysisJpeg(file: Blob): Promise<Blob> {
    // "from-image" is in the living standard; this TS lib still lists only the old union.
    const bitmap = await createImageBitmap(file, {imageOrientation: "from-image"} as unknown as ImageBitmapOptions);
    try {
        const scale = Math.min(1, ANALYSIS_MAX_PIXELS / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new CaptureRefusal("photo_unreadable");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
        if (!blob) throw new CaptureRefusal("photo_unreadable");
        return blob;
    } finally {
        bitmap.close();
    }
}

function rejectionText(rejection: CameraRollRejection, words: CaptureWords["scanner"]) {
    switch (rejection) {
        case "screenshot": return words.rejectScreenshot;
        case "no_camera_information": return words.rejectNoCameraInformation;
        default: return words.rejectUnreadable;
    }
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CaptureClient({
    entry = null,
    gallery = null,
    words = CAPTURE_WORDS_EN
}: {
    entry?: CaptureEntry | null;
    gallery?: CaptureGalleryFixture | null;
    words?: CaptureWords;
}) {
    const router = useRouter();
    const scanner = words.scanner;
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const locationRef = useRef<Coordinates | null>(null);
    const locatingRef = useRef<Promise<Coordinates> | null>(null);
    const rulesRef = useRef<Promise<number | null> | null>(null);
    /** Bumped to stop a poll (Retry, Close, a new capture). */
    const pollRunRef = useRef(0);
    const uploadAbortRef = useRef<AbortController | null>(null);
    /** The Terms agreed on this page, for a browser that keeps no storage. */
    const termsAgreedRef = useRef(false);
    const [phase, setPhase] = useState<Phase>("permission");
    // One line under the entry offer or over the review: a pick turned
    // away, a place that is needed. Never raw server text.
    const [notice, setNotice] = useState<string | null>(null);
    const [capture, setCapture] = useState<{blob: Blob; preview: string; capturedAt: number} | null>(null);
    const [captureToken, setCaptureToken] = useState<string | null>(null);
    const [hasLocation, setHasLocation] = useState(false);
    const [rulesVersion, setRulesVersion] = useState<number | null | undefined>(gallery ? CAPTURE_RULES_VERSION : undefined);
    const [rulesConfirmed, setRulesConfirmed] = useState(false);
    const [savingRules, setSavingRules] = useState(false);
    const [shooting, setShooting] = useState(false);
    const [flash, setFlash] = useState(false);
    const [wallet, setWallet] = useState<Wallet | null>(gallery ? {balance: gallery.state === "credits" ? 1 : 12, isPro: false} : null);
    const [rulesLanguage, setRulesLanguage] = useState("en");
    // The chat's "+" (the owner, 2026-11-06, after the Claude app): where the
    // photo came from, and for a library photo its claims and its place.
    const [source, setSource] = useState<WebCaptureSource>(captureSourceForEntry(entry ?? "camera"));
    const [rollMetadata, setRollMetadata] = useState<CameraRollPhotoMetadata | null>(null);
    const [rollPlace, setRollPlace] = useState<RollPlace | null>(null);
    const [placeSheet, setPlaceSheet] = useState(false);
    const [checking, setChecking] = useState(false);
    const [coarsePointer, setCoarsePointer] = useState(true);
    const [failure, setFailure] = useState<Failure | null>(null);
    /** The capture being identified, so Retry runs its analysis again. */
    const [pendingCaptureId, setPendingCaptureId] = useState<string | null>(null);
    /** When the current upload or identification began (iOS `lastProgressAt`). */
    const [stageStartedAt, setStageStartedAt] = useState(() => Date.now());
    const [now, setNow] = useState(() => Date.now());
    // A library pick held while the rules are agreed to.
    const heldLibrary = useRef<{file: File; metadata: CameraRollPhotoMetadata; coordinate: {latitude: number; longitude: number} | null} | null>(null);
    const rulesText = CAPTURE_RULES_TEXT[rulesLanguage] ?? CAPTURE_RULES_TEXT.en;
    const captureRules = [
        {icon: "camera", title: rulesText.ownTitle, detail: rulesText.ownDetail},
        {icon: "spark", title: rulesText.realTitle, detail: rulesText.realDetail},
        {icon: "location", title: rulesText.locationTitle, detail: rulesText.locationDetail}
    ] as const;

    const refusalText = useCallback((error: unknown, fallback: RefusalKey = "photo_unreadable") => {
        if (error instanceof CaptureRefusal) return words.refusals[error.key];
        return words.refusals[fallback];
    }, [words.refusals]);

    // The rules people agree to read in their own language, as in the apps.
    useEffect(() => {
        setRulesLanguage(captureRulesLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
        try {
            setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
        } catch {
            setCoarsePointer(true);
        }
    }, []);

    function stopCamera() {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }

    // The camera stops when the page goes away, never when a photo is taken:
    // stopping it there made Retake ask for the camera and a GPS fix again.
    // Leaving also stops reading the capture; the server carries on.
    useEffect(() => () => {
        stopCamera();
        pollRunRef.current += 1;
        uploadAbortRef.current?.abort();
    }, []);
    useEffect(() => () => {if (capture?.preview) URL.revokeObjectURL(capture.preview);}, [capture?.preview]);

    // The wait screen's clock: its words move with the time spent.
    const busy = phase === "uploading" || phase === "analyzing";
    useEffect(() => {
        if (!busy) return undefined;
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [busy]);

    useEffect(() => {
        if (gallery) return;
        let cancelled = false;
        const lookup = fetch("/api/app/capture-rules", {cache: "no-store"})
            .then((response) => response.ok ? response.json() : null)
            .then((body) => (typeof body?.version === "number" ? body.version as number : null))
            .catch(() => null);
        rulesRef.current = lookup;
        void lookup.then((version) => {if (!cancelled) setRulesVersion(version);});
        return () => {cancelled = true;};
    }, [gallery]);

    // The wallet, so the review can say before Identify whether this photo is
    // covered. Unknown (offline, an error) shows no footnote.
    useEffect(() => {
        if (gallery) return;
        let cancelled = false;
        fetch("/api/app/billing/status", {cache: "no-store"})
            .then((response) => response.ok ? response.json() : null)
            .then((body) => {
                if (cancelled || !body) return;
                setWallet({balance: typeof body.balance === "number" ? body.balance : null, isPro: body.is_pro === true});
            })
            .catch(() => {});
        return () => {cancelled = true;};
    }, [gallery]);

    /** One shared GPS lookup, started alongside the camera rather than ahead of it. */
    function locate(): Promise<Coordinates> {
        const known = locationRef.current;
        if (known && Date.now() - known.at < LOCATION_FRESH_MS) return Promise.resolve(known);
        if (locatingRef.current) return locatingRef.current;
        const lookup = currentPosition()
            .then((coordinates) => {
                locationRef.current = coordinates;
                setHasLocation(true);
                return coordinates;
            })
            .finally(() => {locatingRef.current = null;});
        locatingRef.current = lookup;
        return lookup;
    }

    /** Close, in every state: back to where the camera was opened from. The server keeps identifying a sent capture. */
    function close() {
        stopCamera();
        pollRunRef.current += 1;
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }
        router.push("/app");
    }

    async function agreeToRules() {
        setSavingRules(true);
        try {
            if (!gallery) {
                const response = await fetch("/api/app/capture-rules", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({version: CAPTURE_RULES_VERSION})
                });
                if (!response.ok) throw new Error("rules_save_failed");
            }
            setRulesVersion(CAPTURE_RULES_VERSION);
            setNotice(null);
            const held = heldLibrary.current;
            if (held) {
                // The pick that waited for the rules goes to its review now.
                heldLibrary.current = null;
                await presentLibraryReview(held.file, held.metadata, held.coordinate);
                return;
            }
            if (capture) {
                // Asked again at Identify (agreed on another device only): send it now.
                setPhase("review");
                return;
            }
            void startCamera();
        } catch {
            setNotice(words.refusals.rules_save_failed);
        } finally {
            setSavingRules(false);
        }
    }

    function declineRules() {
        // Not now, from the "+": back to the offer of the roll, not a camera.
        heldLibrary.current = null;
        setPhase(capture ? "review" : "permission");
    }

    async function startCamera() {
        setPhase("permission");
        setNotice(scanner.requestingCamera);
        // The fix can take up to 12 s; the viewfinder does not wait for it.
        void locate().catch(() => {});
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new CaptureRefusal("camera_unsupported");
            const stream = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: "environment"}, width: {ideal: 1920}, height: {ideal: 1080}}});
            streamRef.current = stream;
            setCaptureToken(null);
            setSource("live_camera");
            setPhase("live");
            setNotice(null);
            requestAnimationFrame(() => {if (videoRef.current) {videoRef.current.srcObject = stream; void videoRef.current.play();}});
        } catch (error) {
            stopCamera();
            // iOS `permissionDeniedContent`: the reason, and a way to try again.
            setPhase("cameraDenied");
            setNotice(error instanceof CaptureRefusal ? words.refusals[error.key] : null);
        }
    }

    /** The shutter-time token: freshness, signed with the server's clock. */
    function mintToken(): Promise<string> {
        if (gallery) return Promise.resolve("gallery");
        return fetch("/api/app/captures/session", {method: "POST"})
            .then(async (response) => {
                const session = await response.json().catch(() => ({}));
                if (!response.ok || !session.token) throw new CaptureRefusal("session_failed");
                return session.token as string;
            });
    }

    async function takePhoto() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (shooting) return;
        if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
            setNotice(scanner.cameraNotReady);
            return;
        }
        setShooting(true);
        // The frame is taken at the tap. The secure session is fetched
        // alongside it; fetching it first put a network round trip between
        // the tap and the picture, and the animal moved.
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) {setShooting(false); return;}
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const capturedAt = Date.now();
        setFlash(true);
        setTimeout(() => setFlash(false), 140);
        const tokenRequest = mintToken();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
        try {
            const token = await tokenRequest;
            if (!blob) throw new CaptureRefusal("photo_unreadable");
            setCaptureToken(token);
            setSource("live_camera");
            setCapture({blob, preview: URL.createObjectURL(blob), capturedAt});
            setPhase("review");
            setNotice(null);
        } catch (error) {
            setNotice(refusalText(error));
        } finally {
            setShooting(false);
        }
    }

    // MARK: The "+" entries

    /**
     * A still from the phone's camera app ("Take a photo"): a live capture,
     * with the shutter-time token minted now and the place frozen behind the
     * review, as the scanner does for its own frame.
     */
    async function acceptCameraAppPhoto(file: File) {
        setChecking(true);
        try {
            const capturedAt = Date.now();
            const [blob, token] = await Promise.all([toAnalysisJpeg(file), mintToken()]);
            void locate().catch(() => {});
            setCaptureToken(token);
            setSource("live_camera");
            setRollMetadata(null);
            setRollPlace(null);
            setCapture({blob, preview: URL.createObjectURL(blob), capturedAt});
            setPhase("review");
            setNotice(null);
        } catch (error) {
            setPhase("permission");
            setNotice(refusalText(error));
        } finally {
            setChecking(false);
        }
    }

    /**
     * A pick from the camera roll ("Upload from camera roll"): the cheap
     * on-device checks first (screenshots, no camera information), then the
     * capture rules if never agreed, then the review. The server screens
     * every library upload regardless.
     */
    async function acceptLibraryPhoto(file: File) {
        setChecking(true);
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const verdict = checkCameraRollPhoto(bytes);
            if (!verdict.ok) {
                setPhase("permission");
                setNotice(rejectionText(verdict.rejection, scanner));
                return;
            }
            const agreed = rulesVersion !== undefined ? rulesVersion : await (rulesRef.current ?? Promise.resolve(null));
            if (needsCaptureRules("library", agreed, CAPTURE_RULES_VERSION)) {
                heldLibrary.current = {file, metadata: verdict.metadata, coordinate: verdict.coordinate};
                setNotice(null);
                setPhase("rules");
                return;
            }
            await presentLibraryReview(file, verdict.metadata, verdict.coordinate);
        } catch {
            setPhase("permission");
            setNotice(scanner.rejectUnreadable);
        } finally {
            setChecking(false);
        }
    }

    /**
     * The review a library photo opens. Its place is the file's own pin,
     * labelled once the geocoder answers and confirmed by the person, or the
     * one they pick at Identify. Never where the browser is now.
     */
    async function presentLibraryReview(file: Blob, metadata: CameraRollPhotoMetadata, coordinate: {latitude: number; longitude: number} | null) {
        const blob = await toAnalysisJpeg(file);
        setCaptureToken(null);
        setSource("camera_roll");
        setRollMetadata(metadata);
        setRollPlace(coordinate ? {place: {...coordinate, label: null, countryCode: null}, confirmed: false, fromPhoto: true} : null);
        setCapture({blob, preview: URL.createObjectURL(blob), capturedAt: metadata.takenAt ? Date.parse(metadata.takenAt) : Date.now()});
        setPhase("review");
        setNotice(null);
        if (coordinate && !gallery) {
            try {
                const response = await fetch(`/api/locations/geocode?lat=${coordinate.latitude}&lon=${coordinate.longitude}`);
                const body = await response.json() as {places?: Place[]};
                const labelled = body.places?.[0];
                if (labelled) {
                    setRollPlace((current) => current && !current.confirmed && current.fromPhoto
                        ? {...current, place: {...current.place, label: labelled.label, countryCode: labelled.countryCode}}
                        : current);
                }
            } catch {
                // The pin stands on its own; the label is a courtesy.
            }
        }
    }

    function acceptPickedFile(forEntry: CaptureEntry, file: File) {
        if (forEntry === "library") void acceptLibraryPhoto(file);
        else void acceptCameraAppPhoto(file);
    }

    // From the chat's "+": the file picked there, once the page is up.
    useEffect(() => {
        if (!entry || gallery) return;
        const file = takePendingCaptureFile(entry);
        if (file) acceptPickedFile(entry, file);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entry, gallery]);

    // DEV ONLY: the fixture, drawn as a real pick would be.
    useEffect(() => {
        if (!gallery) return;
        let cancelled = false;
        if (gallery.state === "rejected") {
            setNotice(scanner.rejectScreenshot);
            return;
        }
        if (gallery.state === "idle") return;
        void fetch(gallery.imageUrl).then((response) => response.blob()).then(async (blob) => {
            if (cancelled) return;
            if (gallery.entry === "library") {
                await presentLibraryReview(blob, {takenAt: "2026-10-17T09:41:02Z", cameraMake: "Apple", cameraModel: "iPhone 17 Pro", software: null, hadEmbeddedLocation: true}, {latitude: 51.5074, longitude: -0.1278});
                setRollPlace({place: {latitude: 51.5074, longitude: -0.1278, label: "London, England, United Kingdom", countryCode: "GB"}, confirmed: false, fromPhoto: true});
            } else {
                const jpeg = await toAnalysisJpeg(blob);
                setCaptureToken("gallery");
                setSource("live_camera");
                setCapture({blob: jpeg, preview: URL.createObjectURL(jpeg), capturedAt: Date.now()});
                setPhase("review");
                setHasLocation(true);
            }
        }).catch(() => {});
        return () => {cancelled = true;};
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gallery]);

    /** Retake / Take another: the camera again (or, from the "+", the source). */
    function retake() {
        pollRunRef.current += 1;
        setCapture(null);
        setCaptureToken(null);
        setRollMetadata(null);
        setRollPlace(null);
        setFailure(null);
        setPendingCaptureId(null);
        if (entry) {
            // From the "+": the source again, not a viewfinder.
            setPhase("permission");
            setNotice(entry === "library" ? scanner.chooseAnotherPhoto : scanner.takeAnotherPhoto);
            return;
        }
        setNotice(null);
        if (!streamRef.current?.active) {void startCamera(); return;}
        setPhase("live");
        requestAnimationFrame(() => {void videoRef.current?.play();});
    }

    function fail(code: string, extra: {captureId?: string | null; uploaded?: boolean; exhausted?: boolean} = {}) {
        pollRunRef.current += 1;
        setFailure({code, captureId: extra.captureId ?? null, uploaded: extra.uploaded === true, exhausted: extra.exhausted === true});
        setPhase("failed");
    }

    /** Reads the capture until it is identified or has stopped. Each new run ends the one before. */
    async function poll(id: string) {
        const run = ++pollRunRef.current;
        const startedAt = Date.now();
        while (Date.now() - startedAt < POLL_LIMIT_MS) {
            await wait(POLL_INTERVAL_MS);
            if (pollRunRef.current !== run) return;
            let body: {status?: string; failure_code?: string | null; analysis?: {animal_name?: string | null; completed_at?: string | null; failed?: boolean} | null} | null = null;
            try {
                const response = await fetch(`/api/app/captures/${encodeURIComponent(id)}`, {cache: "no-store"});
                if (response.status === 401) {
                    if (pollRunRef.current === run) fail("authentication_required", {captureId: id, uploaded: true});
                    return;
                }
                body = response.ok ? await response.json() : null;
            } catch {
                // A dropped read is not a failure: the next one decides.
                body = null;
            }
            if (pollRunRef.current !== run) return;
            if (!body) continue;
            if (body.failure_code || body.status === "failed" || body.analysis?.failed) {
                fail(body.failure_code ?? "unknown", {captureId: id, uploaded: true});
                return;
            }
            if (body.analysis?.completed_at && body.status === "ready") {
                // Settled now, before the card opens: once it is in the
                // collection "is this the first?" can no longer be answered.
                // Never in the way: a reveal that cannot be read is skipped.
                try {
                    const revealResponse = await fetch(`/api/app/captures/${encodeURIComponent(id)}/reveal`, {method: "POST"});
                    const revealBody = revealResponse.ok ? await revealResponse.json() : null;
                    if (revealBody?.reveal) storeCaptureReveal(window.sessionStorage, revealBody.reveal);
                } catch {
                    // The capture is saved either way.
                }
                if (pollRunRef.current !== run) return;
                setPhase("complete");
                router.push(`/app/capture/${encodeURIComponent(id)}`);
                router.refresh();
                return;
            }
        }
        // Still not done: the capture is saved and keeps going on the server,
        // but this screen has stopped waiting (iOS `CaptureFailureCatalog.exhausted`).
        if (pollRunRef.current === run) fail("unknown", {captureId: id, uploaded: true, exhausted: true});
    }

    function beginStage(next: "uploading" | "analyzing") {
        setStageStartedAt(Date.now());
        setNow(Date.now());
        setPhase(next);
    }

    async function analyze() {
        if (!capture) return;
        if (gallery) {setNotice("Gallery: nothing is sent."); return;}
        const isLibrary = source === "camera_roll";
        if (!isLibrary && !captureToken) return;
        // A library photo never takes today's GPS fix: Identify waits for an
        // explicit confirm, so a wrong embedded pin cannot ship silently.
        if (libraryNeedsPlace(source, rollPlace?.confirmed === true)) {
            setPlaceSheet(true);
            return;
        }
        // The first capture goes to Explore: the Community Terms first (iOS
        // holds the capture until they are agreed).
        let storage: Storage | null = null;
        try {
            storage = window.localStorage;
        } catch {
            storage = null;
        }
        if (!termsAgreedRef.current && !hasAcceptedCommunityTerms(storage)) {
            setPhase("terms");
            return;
        }
        setFailure(null);
        setNotice(null);
        beginStage("uploading");
        let location: {latitude: number; longitude: number};
        if (isLibrary && rollPlace) {
            location = rollPlace.place;
        } else {
            try {
                location = await locate();
            } catch (error) {
                setPhase("review");
                setNotice(refusalText(error, "location_denied"));
                return;
            }
        }
        stopCamera();
        const form = new FormData();
        form.append("image", new File([capture.blob], isLibrary ? "camera-roll.jpg" : "live-capture.jpg", {type: "image/jpeg"}));
        if (!isLibrary && captureToken) form.append("captureToken", captureToken);
        form.append("captureSource", source);
        form.append("capturedAt", String(capture.capturedAt));
        form.append("latitude", String(location.latitude));
        form.append("longitude", String(location.longitude));
        if (isLibrary && rollMetadata) form.append("cameraRollMetadata", JSON.stringify(cameraRollServerPayload(rollMetadata)));
        const abort = new AbortController();
        uploadAbortRef.current = abort;
        try {
            const response = await fetch("/api/app/captures", {method: "POST", body: form, signal: abort.signal});
            const body = await response.json().catch(() => ({}));
            if (response.status === 402) {
                // Saved and waiting for credits; it is identified on its own
                // once the wallet covers it.
                if (typeof body.balance === "number") setWallet((current) => ({balance: body.balance, isPro: current?.isPro ?? false}));
                setPhase("credits");
                return;
            }
            if (response.status === 403 && body.error === "capture_rules_not_accepted") {
                // Agreed on this device but not yet on the server: ask again.
                setRulesVersion(null);
                heldLibrary.current = null;
                setNotice(null);
                setPhase("rules");
                return;
            }
            if (typeof body.refusal === "string" && body.refusal in words.refusals) {
                // Turned away before anything was made: say why, on the review.
                setPhase("review");
                setNotice(words.refusals[body.refusal as RefusalKey]);
                return;
            }
            if (!response.ok || typeof body.captureId !== "string" || body.failure_code) {
                fail(body.failure_code ?? classifyCaptureFailure({errorCode: body.error, httpStatus: response.status}), {
                    captureId: typeof body.captureId === "string" ? body.captureId : null,
                    uploaded: body.uploaded === true
                });
                return;
            }
            setPendingCaptureId(body.captureId);
            beginStage("analyzing");
            await poll(body.captureId);
        } catch (error) {
            if (abort.signal.aborted) return;
            fail(classifyCaptureFailure({message: error instanceof Error ? error.message : null}));
        } finally {
            if (uploadAbortRef.current === abort) uploadAbortRef.current = null;
        }
    }

    /** Runs the analysis again on a capture the server already holds. */
    async function reanalyzeHeld(captureId: string) {
        setFailure(null);
        setPendingCaptureId(captureId);
        beginStage("analyzing");
        try {
            const response = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}/analyze`, {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"});
            const body = await response.json().catch(() => ({}));
            if (response.status === 402) {
                setPhase("credits");
                return;
            }
            if (!response.ok) {
                fail(body.failure_code ?? classifyCaptureFailure({httpStatus: response.status}), {captureId, uploaded: true});
                return;
            }
            await poll(captureId);
        } catch (error) {
            fail(classifyCaptureFailure({message: error instanceof Error ? error.message : null}), {captureId, uploaded: true});
        }
    }

    /** Retry: the same capture again where the server holds it, else the photo sent again. */
    function retry() {
        if (phase === "uploading") {
            uploadAbortRef.current?.abort();
            void analyze();
            return;
        }
        const heldId = failure?.uploaded && failure.captureId ? failure.captureId : phase === "analyzing" ? pendingCaptureId : null;
        if (heldId) {
            void reanalyzeHeld(heldId);
            return;
        }
        setFailure(null);
        void analyze();
    }

    function agreeToTerms() {
        let storage: Storage | null = null;
        try {
            storage = window.localStorage;
        } catch {
            storage = null;
        }
        acceptCommunityTerms(storage);
        termsAgreedRef.current = true;
        setPhase("review");
        // The capture waited for the Terms: it is sent now.
        window.setTimeout(() => void analyze(), 0);
    }

    const showingCamera = phase === "live";
    const isLibraryReview = phase === "review" && source === "camera_roll";
    const placeWaits = isLibraryReview && libraryNeedsPlace(source, rollPlace?.confirmed === true);
    const placeLabel = rollPlace?.place.label ?? (rollPlace ? `${rollPlace.place.latitude.toFixed(3)}, ${rollPlace.place.longitude.toFixed(3)}` : null);
    const cameraAppOpens = entry === "camera" && takePhotoOpensCameraApp(coarsePointer);
    const footnote = captureCostFootnote(wallet, PHOTO_CREDIT_COST, scanner);
    const shortfall = captureCreditShortfall(wallet, PHOTO_CREDIT_COST);
    const freeWithPro = captureShowsFreeWithPro(wallet, PHOTO_CREDIT_COST);
    const progress = busy ? captureProgressSnapshot(phase, (now - stageStartedAt) / 1000, words.progress) : null;
    const failureCopy = failure ? captureFailurePresentation(failure.code, words.failures, {attemptsExhausted: failure.exhausted, exhausted: words.exhausted}) : null;
    const failureActions = failure ? captureFailureActions(failure.code) : null;

    // The offer that stands in for the scanner's priming from the "+": a
    // label over a file input, so the tap opens the camera app or the roll
    // directly, as the apps' entries do.
    const entryOffer = entry && phase === "permission" ? (
        <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name={entry === "library" ? "spark" : "camera"} className="h-9 w-9"/></span>
            <h2 className="mt-6 font-display text-3xl font-bold">{entry === "library" ? scanner.uploadFromCameraRoll : scanner.takeAPhoto}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/45">{notice ?? (entry === "library" ? scanner.entryLibraryDetail : scanner.entryCameraDetail)}</p>
            {checking ? <p className="mt-6 text-sm font-bold text-white/70" aria-live="polite">{scanner.checkingPhoto}</p> : entry === "library" || cameraAppOpens ? (
                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary-400 px-6 py-3.5 text-sm font-black text-black/90" data-testid="capture-entry-pick">
                    <AppIcon name={entry === "library" ? "spark" : "camera"} className="h-4 w-4"/>
                    {entry === "library" ? scanner.chooseFromCameraRoll : scanner.openCamera}
                    <input
                        type="file"
                        accept={plusItemInput(entry).accept}
                        capture={plusItemInput(entry).capture}
                        className="sr-only"
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            event.target.value = "";
                            if (file) acceptPickedFile(entry, file);
                        }}
                    />
                </label>
            ) : (
                <button onClick={() => void startCamera()} className="mt-6 rounded-full bg-primary-400 px-6 py-3.5 text-sm font-black text-black/90">{scanner.continue}</button>
            )}
        </div>
    ) : null;

    return <div className="mx-auto max-w-4xl">
        <style>{`@keyframes animaldex-capture-breath{from{box-shadow:0 0 0 1.5px rgba(167,244,50,.22),0 0 18px rgba(167,244,50,.08)}to{box-shadow:0 0 0 1.5px rgba(167,244,50,.55),0 0 18px rgba(167,244,50,.22)}}.animaldex-capture-breath{animation:animaldex-capture-breath 1.6s ease-in-out infinite alternate}@media (prefers-reduced-motion: reduce){.animaldex-capture-breath{animation:none;box-shadow:0 0 0 1.5px rgba(167,244,50,.4)}}`}</style>
        <div className="relative min-h-[34rem] overflow-hidden border border-white/10 bg-[#090909]">
            <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${showingCamera ? "block" : "hidden"}`}/>
            <canvas ref={canvasRef} className="hidden"/>
            {capture && phase !== "live" ? <img src={capture.preview} alt={isLibraryReview ? scanner.reviewAltLibrary : scanner.reviewAltLive} className="absolute inset-0 h-full w-full object-contain"/> : null}
            {!capture && !showingCamera ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,219,101,.12),transparent_45%)]"/> : null}
            {showingCamera || phase === "review" ? <div className="pointer-events-none absolute inset-5 border border-white/20"><span className="absolute left-0 top-0 h-12 w-12 -translate-x-px -translate-y-px border-l-2 border-t-2 border-primary-400"/><span className="absolute bottom-0 right-0 h-12 w-12 translate-x-px translate-y-px border-b-2 border-r-2 border-primary-400"/></div> : null}
            {flash ? <div className="pointer-events-none absolute inset-0 bg-white/60"/> : null}
            {entryOffer}
            {/* iOS `cameraPrimingContent`: what the camera is for, then Continue. */}
            {!entry && phase === "permission" ? (
                <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-8 text-center">
                    <span className="text-primary-400"><AppIcon name="camera" className="h-12 w-12"/></span>
                    <h2 className="mt-5 max-w-md font-display text-3xl font-black text-white">{scanner.primingTitle}</h2>
                    <p className="mt-3 max-w-md text-[15px] leading-6 text-white/60">{scanner.primingDetail}</p>
                    {notice ? <p className="mt-4 text-xs font-semibold text-white/50" aria-live="polite">{notice}</p> : null}
                    <button onClick={() => void startCamera()} className="mt-8 min-h-14 w-full max-w-[520px] rounded-full bg-primary-400 px-6 text-base font-black text-black/90" data-testid="capture-priming-continue">{scanner.continue}</button>
                </div>
            ) : null}
            {/* iOS `permissionDeniedContent`. */}
            {phase === "cameraDenied" ? (
                <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-8 text-center">
                    <span className="text-primary-400"><AppIcon name="camera" className="h-11 w-11"/></span>
                    <h2 className="mt-5 font-display text-2xl font-bold text-white">{scanner.cameraRequiredTitle}</h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-white/70">{notice ?? scanner.cameraRequiredDetail}</p>
                    <button onClick={() => void startCamera()} className="mt-6 min-h-[50px] rounded-full bg-primary-400 px-7 text-sm font-black text-black/90">{words.tryAgain}</button>
                </div>
            ) : null}
            {phase === "rules" ? <div lang={rulesLanguage} dir={isRightToLeftLanguage(rulesLanguage) ? "rtl" : "ltr"} className="relative z-10 flex min-h-[34rem] flex-col justify-center bg-[#090909] p-6 pt-16 sm:p-10 sm:pt-16">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name="check"/></span>
                <h2 className="mt-4 font-display text-3xl font-bold">{rulesText.title}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{rulesText.intro}</p>
                <ul className="mt-5 space-y-4 border border-white/10 bg-[#151515] p-5">
                    {captureRules.map((rule) => <li key={rule.icon} className="flex gap-3"><span className="mt-0.5 text-primary-200"><AppIcon name={rule.icon} className="h-5 w-5"/></span><span><span className="block text-sm font-bold text-white">{rule.title}</span><span className="block text-sm leading-6 text-white/50">{rule.detail}</span></span></li>)}
                </ul>
                <p className="mt-4 flex gap-2 text-sm leading-6 text-white/70"><span className="text-orange-300">!</span>{rulesText.enforcement}</p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/80"><input type="checkbox" checked={rulesConfirmed} onChange={(event) => setRulesConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#a7f432]"/>{rulesText.confirm}</label>
                {notice ? <p className="mt-3 text-sm text-orange-300" role="alert">{notice}</p> : null}
                <div className="mt-5 flex gap-3"><button onClick={agreeToRules} disabled={!rulesConfirmed || savingRules} className="flex-1 bg-primary-400 px-5 py-3.5 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/40">{savingRules ? "…" : rulesText.agree}</button><button onClick={declineRules} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">{rulesText.notNow}</button></div>
            </div> : null}
            {phase === "terms" ? <CommunityTermsPanel words={words.terms} onAgree={agreeToTerms}/> : null}
            {showingCamera ? (
                <div className="absolute inset-x-0 bottom-7 flex flex-col items-center gap-3">
                    {notice ? <p className="rounded-full bg-[#090909]/75 px-3 py-1.5 text-xs font-semibold text-white" role="status">{notice}</p> : null}
                    <button onClick={takePhoto} disabled={shooting} aria-label={scanner.takePhoto} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/25 shadow-2xl transition active:scale-95 disabled:opacity-60"><span className="h-14 w-14 rounded-full bg-primary-400"/></button>
                    <p className="text-xs font-semibold text-white/70">{scanner.tapToShoot}</p>
                </div>
            ) : null}
            {/* iOS `FirstCaptureIdentifyingView`: the photo with a breathing
                edge, what is happening and how long, Retry once it has sat
                too long, and a failure in the same place with its way on. */}
            {(busy || phase === "complete" || phase === "failed") && capture ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden p-6 pt-16 text-center" aria-live="polite">
                    <img src={capture.preview} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"/>
                    <div className="absolute inset-0 bg-[#090909]/[0.72]"/>
                    <div className="relative flex w-full max-w-[520px] flex-col items-center gap-5">
                        <img src={capture.preview} alt="" aria-hidden="true" className={`max-h-[380px] w-auto max-w-full object-contain ${phase === "failed" ? "ring-1 ring-white/15" : "animaldex-capture-breath"}`}/>
                        {phase === "failed" && failureCopy && failureActions ? (
                            <div className="flex flex-col items-center gap-2.5">
                                <p className="font-display text-2xl font-bold text-white">{failureCopy.title}</p>
                                <p className="max-w-md text-sm leading-6 text-white/60">{failureCopy.message}</p>
                                <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                                    {failureActions.getCredits ? <a href="/app/credits" className="inline-flex min-h-11 items-center rounded-full bg-primary-400 px-5 text-sm font-black text-black/90">{scanner.getCredits}</a> : null}
                                    {failureActions.signIn ? <a href="/account" className="inline-flex min-h-11 items-center rounded-full bg-primary-400 px-5 text-sm font-black text-black/90">{words.signIn}</a> : null}
                                    {failureActions.agreeToRules ? <button type="button" onClick={() => {setRulesVersion(null); setPhase("rules");}} className="inline-flex min-h-11 items-center rounded-full bg-primary-400 px-5 text-sm font-black text-black/90">{rulesText.agree}</button> : null}
                                    {failureActions.retry ? (
                                        <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-black/90" data-testid="capture-retry">
                                            <span aria-hidden="true">↻</span>{scanner.retry}
                                        </button>
                                    ) : null}
                                    {failureActions.takeAnother ? (
                                        <button type="button" onClick={retake} className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.08] px-5 text-sm font-black text-white">{entry === "library" ? scanner.chooseAnother : scanner.takeAnother}</button>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2.5">
                                <p className="font-display text-2xl font-bold text-white">{phase === "complete" ? scanner.ready : progress?.label ?? words.progress.identifying}</p>
                                {progress?.detail ? <p className="max-w-md text-xs leading-5 text-white/60">{progress.detail}</p> : null}
                                {progress ? (
                                    <div className="mt-1 h-1 w-[220px] overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.progressFraction * 100)}>
                                        <div className="h-full rounded-full bg-primary-400 transition-[width] duration-700" style={{width: `${progress.progressFraction * 100}%`}}/>
                                    </div>
                                ) : null}
                                {progress?.offersRetry ? (
                                    <button type="button" onClick={retry} className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-black text-primary-400" data-testid="capture-retry">
                                        <span aria-hidden="true">↻</span>{scanner.retry}
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
            {/* Close, in every state (iOS's ✕ on the scanner, the review and the wait). */}
            <button
                type="button"
                onClick={close}
                aria-label={words.close}
                className="absolute left-3 top-3 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#090909]/60 text-white backdrop-blur-md transition hover:bg-[#090909]/80"
                data-testid="capture-close"
            >
                <AppIcon name="close"/>
            </button>
        </div>
        {phase === "review" || phase === "credits" ? (
            <div className="mt-5 border border-white/10 bg-[#151515] p-5">
                {phase === "review" ? <p className="font-display text-lg font-bold text-white">{scanner.reviewTitle}</p> : null}
                {phase === "review" && notice ? <p className="mt-2 text-sm leading-6 text-orange-300" role="alert">{notice}</p> : null}
                {isLibraryReview ? (
                    // Where was this? The file's own pin, to confirm or change; or a place to pick. Never today's fix.
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm" data-testid="roll-place">
                        <AppIcon name="location" className="h-4 w-4 shrink-0 text-primary-200"/>
                        {rollPlace?.confirmed ? (
                            <><span className="min-w-0 flex-1 text-white/80">{placeLabel}</span><button type="button" onClick={() => setPlaceSheet(true)} className="font-black text-primary-200 underline underline-offset-2">{scanner.change}</button></>
                        ) : rollPlace ? (
                            <><span className="min-w-0 flex-1 text-white/80">{fillCaptureWords(scanner.fromThePhoto, {place: placeLabel ?? "…"})}</span><button type="button" onClick={() => setRollPlace((current) => current ? {...current, confirmed: true} : current)} className="bg-primary-400 px-3 py-1.5 text-xs font-black text-black" data-testid="roll-place-confirm">{scanner.confirm}</button><button type="button" onClick={() => setPlaceSheet(true)} className="font-black text-primary-200 underline underline-offset-2">{scanner.change}</button></>
                        ) : (
                            <><span className="min-w-0 flex-1 text-white/80">{scanner.noPlaceSaved}</span><button type="button" onClick={() => setPlaceSheet(true)} className="bg-primary-400 px-3 py-1.5 text-xs font-black text-black" data-testid="roll-place-pick">{scanner.pickThePlace}</button></>
                        )}
                    </div>
                ) : null}
                {phase === "review" ? (
                    <div className="mt-5 flex gap-3">
                        <button onClick={retake} className="min-h-14 min-w-24 bg-white/[0.14] px-5 text-base font-semibold text-white">{entry === "library" ? scanner.chooseAnother : scanner.retake}</button>
                        <button onClick={analyze} disabled={placeWaits} title={placeWaits ? scanner.pickPlaceFirst : undefined} className="flex min-h-14 flex-1 items-center justify-center gap-2 bg-primary-400 px-5 text-base font-bold text-black disabled:bg-white/10 disabled:text-white/40" data-testid="identify-photo"><AppIcon name="spark"/>{scanner.identifyPhoto}</button>
                    </div>
                ) : null}
                {/* iOS `reviewFootnoteRow` / `CaptureCreditShortfallLine`: the cost and what is left, never in the button. */}
                {phase === "review" && shortfall ? (
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-orange-300">
                        {fillCaptureWords(scanner.needsCredits, {required: shortfall.required, available: shortfall.available})}
                        <a href="/app/credits" className="font-black text-primary-200 underline underline-offset-2">{scanner.getCredits}</a>
                    </p>
                ) : phase === "review" && footnote ? (
                    <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[11px] text-white/65" data-testid="capture-cost-footnote">
                        <span>{footnote}</span>
                        {freeWithPro ? <><span aria-hidden="true" className="text-white/45">·</span><a href="/app/credits#pro" className="font-bold text-primary-400">{scanner.freeWithPro}</a></> : null}
                    </p>
                ) : null}
                {phase === "credits" ? (
                    <div>
                        <p className="font-display text-xl font-bold text-white">{words.failures.insufficient_credits.title}</p>
                        <p className="mt-2 text-sm leading-6 text-white/55">{words.failures.insufficient_credits.message}</p>
                        <div className="mt-4 flex gap-3"><a href="/app/credits" className="flex flex-1 items-center justify-center bg-primary-400 px-5 py-3.5 text-sm font-black text-black">{scanner.getCredits}</a><button onClick={retake} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">{scanner.takeAnother}</button></div>
                    </div>
                ) : null}
                {phase === "review" && source === "live_camera" ? <p className="mt-4 flex items-center gap-2 text-xs text-white/30"><AppIcon name="location" className="h-4 w-4"/>{hasLocation ? scanner.locationAttached : scanner.gettingLocation}</p> : null}
            </div>
        ) : null}
        {placeSheet ? (
            <PlaceSheet
                words={words}
                initialLabel={rollPlace && !rollPlace.confirmed ? placeLabel : null}
                onCancel={() => setPlaceSheet(false)}
                onConfirm={(place) => {
                    setRollPlace({place, confirmed: true, fromPhoto: false});
                    setPlaceSheet(false);
                }}
            />
        ) : null}
    </div>;
}

/** iOS `TermsAgreementView`, in the capture's frame: the four rules, the legal links, I Agree. */
function CommunityTermsPanel({words, onAgree}: {words: CaptureWords["terms"]; onAgree: () => void}) {
    const rules = [words.ruleContent, words.ruleReport, words.ruleBlock, words.ruleRemoval];
    return (
        <div className="relative z-10 flex min-h-[34rem] flex-col justify-center gap-5 bg-[#090909] p-6 pt-16 sm:p-10 sm:pt-16" role="dialog" aria-modal="false" aria-labelledby="community-terms-title" data-testid="community-terms">
            <span className="text-primary-400"><AppIcon name="check" className="h-9 w-9"/></span>
            <div className="flex flex-col gap-2.5">
                <h2 id="community-terms-title" className="font-display text-3xl font-bold text-white">{words.title}</h2>
                <p className="max-w-xl text-sm leading-6 text-white/60">{words.intro}</p>
            </div>
            <ul className="flex flex-col gap-3 border-y border-white/10 py-4">
                {rules.map((rule) => (
                    <li key={rule} className="flex gap-2.5 text-sm leading-6 text-white/80">
                        <span className="mt-0.5 text-primary-400"><AppIcon name="check" className="h-4 w-4"/></span>
                        {rule}
                    </li>
                ))}
            </ul>
            <p className="text-xs leading-5 text-white/50">
                {words.legalPrefix}{" "}
                <a href="/legal/terms" target="_blank" rel="noreferrer" className="font-bold text-primary-200 underline underline-offset-2">{words.termsOfUse}</a>
                {" "}{words.and}{" "}
                <a href="/legal/privacy" target="_blank" rel="noreferrer" className="font-bold text-primary-200 underline underline-offset-2">{words.privacyPolicy}</a>.
                {" "}{words.zeroTolerance}
            </p>
            <button type="button" onClick={onAgree} className="min-h-14 w-full rounded-full bg-primary-400 px-6 text-base font-black text-black/90" data-testid="community-terms-agree">{words.agree}</button>
        </div>
    );
}

/**
 * "Where was this?" for a library photo: a place search over the same
 * geocoder the Instagram importer uses. The answer is the person's own,
 * recorded as confirmed, never the browser's fix.
 */
function PlaceSheet({words, initialLabel, onCancel, onConfirm}: {words: CaptureWords; initialLabel: string | null; onCancel: () => void; onConfirm: (place: Place) => void}) {
    const scanner = words.scanner;
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Place[]>([]);
    const [selected, setSelected] = useState<Place | null>(null);
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
                const payload = await response.json() as {places?: Place[]};
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
        <div className="fixed inset-0 z-50">
            <button type="button" aria-label={words.close} className="absolute inset-0 bg-[#090909]/70 backdrop-blur-sm" onClick={onCancel} />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="capture-place-title"
                className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto border border-white/10 bg-[#101010] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2"
                data-testid="roll-place-sheet"
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 id="capture-place-title" className="font-display text-2xl font-bold text-white">{scanner.whereWasThis}</h3>
                    <button type="button" aria-label={words.close} onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/60">
                        <AppIcon name="close" />
                    </button>
                </div>
                <p className="text-sm text-white/45">{initialLabel ? fillCaptureWords(scanner.photoSays, {place: initialLabel}) : scanner.noPlaceRequired}</p>
                <label className="mt-4 block">
                    <span className="sr-only">{scanner.searchForAPlace}</span>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={scanner.searchForAPlace}
                        enterKeyHint="search"
                        autoComplete="off"
                        className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-primary-400/50"
                    />
                </label>
                {searching ? <p className="mt-3 text-xs text-white/35">{scanner.searching}</p> : null}
                <div className="mt-3 space-y-2">
                    {results.map((place) => (
                        <button
                            key={`${place.latitude}-${place.longitude}-${place.label}`}
                            type="button"
                            onClick={() => setSelected(place)}
                            className={`w-full border px-4 py-3 text-left text-sm ${selected?.label === place.label ? "border-primary-400 bg-primary-400/10 text-white" : "border-white/10 text-white/75"}`}
                        >
                            {place.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    disabled={!selected}
                    onClick={() => selected && onConfirm(selected)}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/35"
                >
                    {scanner.confirmLocation}
                </button>
            </div>
        </div>
    );
}
