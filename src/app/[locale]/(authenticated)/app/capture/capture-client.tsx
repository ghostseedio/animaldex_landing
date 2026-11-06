"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {storeCaptureReveal} from "@/lib/capture-reveal";
import {CAPTURE_RULES_TEXT, captureRulesLanguage, isRightToLeftLanguage} from "@/lib/capture-rules-text";
import {captureSourceForEntry, libraryNeedsPlace, needsCaptureRules, plusItemInput, takePhotoOpensCameraApp, type CaptureEntry, type WebCaptureSource} from "@/lib/capture-entry";
import {takePendingCaptureFile} from "@/lib/capture-handoff";
import {CAMERA_ROLL_REJECTION_MESSAGES, cameraRollServerPayload, checkCameraRollPhoto, type CameraRollPhotoMetadata} from "@/lib/camera-roll-photo-checks";

type Phase = "permission" | "rules" | "live" | "review" | "uploading" | "analyzing" | "credits" | "complete" | "error";
type Coordinates = {latitude: number; longitude: number; at: number};
type Wallet = {balance: number | null; isPro: boolean};
type Place = {latitude: number; longitude: number; label: string | null; countryCode: string | null};
/** A library photo's place: the file's own pin (unconfirmed until the person says so) or the one they picked. */
type RollPlace = {place: Place; confirmed: boolean; fromPhoto: boolean};

/** What identifying one photo costs; the server charges it (analyze-capture). */
const PHOTO_CREDIT_COST = 2;

// The rules every capture is held to, worded and translated as in the apps
// (lib/capture-rules-text, generated from the iOS catalog). Bump the version
// with the apps' CaptureRules.version.
const CAPTURE_RULES_VERSION = 1;

const LIVE_HINT = "Center one live animal in the frame. Avoid screens, posters, artwork, and heavy blur.";
const REVIEW_HINT = "Confirm this photo before sending it to analysis.";
/** A fix older than this is refreshed before it is attached to a capture. */
const LOCATION_FRESH_MS = 120_000;
/** The analysis size the apps send; a library original is cut to it (and loses its EXIF, which travels as claims). */
const ANALYSIS_MAX_PIXELS = 1280;

/**
 * DEV ONLY (dev/capture/plus): the review drawn from a fixture, no network.
 * `rejected` is a pick turned away; `credits` a balance short of the cost.
 */
export type CaptureGalleryFixture = {entry: CaptureEntry; imageUrl: string; state: "idle" | "review" | "rejected" | "credits"};

function currentPosition() {
    return new Promise<Coordinates>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("This browser does not provide location access."));
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({latitude: position.coords.latitude, longitude: position.coords.longitude, at: Date.now()}),
            () => reject(new Error("AnimalDex requires location permission for live scans.")),
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
        if (!context) throw new Error("Could not read the photo. Try again.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
        if (!blob) throw new Error("Could not read the photo. Try again.");
        return blob;
    } finally {
        bitmap.close();
    }
}

export default function CaptureClient({entry = null, gallery = null}: {entry?: CaptureEntry | null; gallery?: CaptureGalleryFixture | null}) {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const locationRef = useRef<Coordinates | null>(null);
    const locatingRef = useRef<Promise<Coordinates> | null>(null);
    const rulesRef = useRef<Promise<number | null> | null>(null);
    const [phase, setPhase] = useState<Phase>("permission");
    const [message, setMessage] = useState(entry === "library"
        ? "Choose a photo you took. Screenshots, downloads and AI images can't be uploaded."
        : entry === "camera"
            ? "Take a photo of the animal with your camera."
            : "Camera and location access are required. Gallery uploads are disabled.");
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
    // A library pick held while the rules are agreed to.
    const heldLibrary = useRef<{file: File; metadata: CameraRollPhotoMetadata; coordinate: {latitude: number; longitude: number} | null} | null>(null);
    const rulesText = CAPTURE_RULES_TEXT[rulesLanguage] ?? CAPTURE_RULES_TEXT.en;
    const captureRules = [
        {icon: "camera", title: rulesText.ownTitle, detail: rulesText.ownDetail},
        {icon: "spark", title: rulesText.realTitle, detail: rulesText.realDetail},
        {icon: "location", title: rulesText.locationTitle, detail: rulesText.locationDetail}
    ] as const;

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
    useEffect(() => () => stopCamera(), []);
    useEffect(() => () => {if (capture?.preview) URL.revokeObjectURL(capture.preview);}, [capture?.preview]);

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
    // covered. Unknown (offline, an error) shows the plain cost.
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

    function enableScanner() {
        if (rulesVersion === undefined) return;
        if ((rulesVersion ?? 0) < CAPTURE_RULES_VERSION) {
            setPhase("rules");
            return;
        }
        void startCamera();
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
                if (!response.ok) throw new Error(rulesText.saveFailed);
            }
            setRulesVersion(CAPTURE_RULES_VERSION);
            const held = heldLibrary.current;
            if (held) {
                // The pick that waited for the rules goes to its review now.
                heldLibrary.current = null;
                await presentLibraryReview(held.file, held.metadata, held.coordinate);
                return;
            }
            void startCamera();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : rulesText.saveFailed);
        } finally {
            setSavingRules(false);
        }
    }

    function declineRules() {
        // Not now, from the "+": back to the offer of the roll, not a camera.
        heldLibrary.current = null;
        setPhase("permission");
    }

    async function startCamera() {
        setPhase("permission");
        setMessage("Requesting the back camera…");
        // The fix can take up to 12 s; the viewfinder does not wait for it.
        void locate().catch(() => {});
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error("Live camera capture requires HTTPS and a supported browser.");
            const stream = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: "environment"}, width: {ideal: 1920}, height: {ideal: 1080}}});
            streamRef.current = stream;
            setCaptureToken(null);
            setSource("live_camera");
            setPhase("live");
            setMessage(LIVE_HINT);
            requestAnimationFrame(() => {if (videoRef.current) {videoRef.current.srcObject = stream; void videoRef.current.play();}});
        } catch (error) {
            stopCamera();
            setPhase("error");
            setMessage(error instanceof Error ? error.message : "Camera access failed.");
        }
    }

    /** The shutter-time token: freshness, signed with the server's clock. */
    function mintToken(): Promise<string> {
        if (gallery) return Promise.resolve("gallery");
        return fetch("/api/app/captures/session", {method: "POST"})
            .then(async (response) => {
                const session = await response.json().catch(() => ({}));
                if (!response.ok || !session.token) throw new Error(session.error || "Could not start a secure capture session.");
                return session.token as string;
            });
    }

    async function takePhoto() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (shooting) return;
        if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
            setMessage("The live camera is not ready yet. Wait a second and try again.");
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
            if (!blob) throw new Error("Could not read the live camera frame. Try again.");
            setCaptureToken(token);
            setSource("live_camera");
            setCapture({blob, preview: URL.createObjectURL(blob), capturedAt});
            setPhase("review");
            setMessage(REVIEW_HINT);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not take the photo. Try again.");
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
            setMessage(REVIEW_HINT);
        } catch (error) {
            setPhase("permission");
            setMessage(error instanceof Error ? error.message : "Could not read the photo. Try again.");
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
                setMessage(CAMERA_ROLL_REJECTION_MESSAGES[verdict.rejection]);
                return;
            }
            const agreed = rulesVersion !== undefined ? rulesVersion : await (rulesRef.current ?? Promise.resolve(null));
            if (needsCaptureRules("library", agreed, CAPTURE_RULES_VERSION)) {
                heldLibrary.current = {file, metadata: verdict.metadata, coordinate: verdict.coordinate};
                setPhase("rules");
                return;
            }
            await presentLibraryReview(file, verdict.metadata, verdict.coordinate);
        } catch (error) {
            setPhase("permission");
            setMessage(error instanceof Error ? error.message : CAMERA_ROLL_REJECTION_MESSAGES.unreadable);
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
        setMessage(REVIEW_HINT);
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
            setMessage(CAMERA_ROLL_REJECTION_MESSAGES.screenshot);
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
                setMessage(REVIEW_HINT);
                setHasLocation(true);
            }
        }).catch(() => {});
        return () => {cancelled = true;};
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gallery]);

    function retake() {
        setCapture(null);
        setCaptureToken(null);
        setRollMetadata(null);
        setRollPlace(null);
        if (entry) {
            // From the "+": the source again, not a viewfinder.
            setPhase("permission");
            setMessage(entry === "library" ? "Choose another photo you took." : "Take another photo with your camera.");
            return;
        }
        if (!streamRef.current?.active) {void startCamera(); return;}
        setPhase("live");
        setMessage(LIVE_HINT);
        requestAnimationFrame(() => {void videoRef.current?.play();});
    }

    async function poll(id: string) {
        for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const response = await fetch(`/api/app/captures/${id}`, {cache: "no-store"});
            const body = await response.json();
            if (body.analysis?.error_message || body.status === "failed") throw new Error(body.analysis?.error_message || "Analysis failed.");
            if (body.analysis?.completed_at && body.status === "ready") {
                // Settled now, before the card opens: once it is in the
                // collection "is this the first?" can no longer be answered.
                // Never in the way: a reveal that cannot be read is skipped.
                try {
                    const revealResponse = await fetch(`/api/app/captures/${id}/reveal`, {method: "POST"});
                    const revealBody = revealResponse.ok ? await revealResponse.json() : null;
                    if (revealBody?.reveal) storeCaptureReveal(window.sessionStorage, revealBody.reveal);
                } catch {
                    // The capture is saved either way.
                }
                setPhase("complete");
                setMessage(`${body.analysis.animal_name || "Animal"} identified. Opening your capture…`);
                await new Promise((resolve) => setTimeout(resolve, 700));
                router.push(`/app/capture/${id}`);
                router.refresh();
                return;
            }
            setMessage(body.status === "analyzing" ? "Checking live-capture authenticity, identity, habitat, and rarity…" : "Preparing your live capture for analysis…");
        }
        throw new Error("Analysis is taking longer than expected. It will continue processing in your collection.");
    }

    async function analyze() {
        if (!capture) return;
        if (gallery) {setMessage("Gallery: nothing is sent."); return;}
        const isLibrary = source === "camera_roll";
        if (!isLibrary && !captureToken) return;
        // A library photo never takes today's GPS fix: Identify waits for an
        // explicit confirm, so a wrong embedded pin cannot ship silently.
        if (libraryNeedsPlace(source, rollPlace?.confirmed === true)) {
            setPlaceSheet(true);
            return;
        }
        setPhase("uploading");
        setMessage(isLibrary ? "Uploading your photo…" : locationRef.current ? "Uploading the verified live camera frame…" : "Getting your location…");
        let location: {latitude: number; longitude: number};
        if (isLibrary && rollPlace) {
            location = rollPlace.place;
        } else {
            try {
                location = await locate();
            } catch (error) {
                setPhase("review");
                setMessage(error instanceof Error ? error.message : "Location permission is required for live scans.");
                return;
            }
        }
        setMessage(isLibrary ? "Uploading your photo…" : "Uploading the verified live camera frame…");
        stopCamera();
        const form = new FormData();
        form.append("image", new File([capture.blob], isLibrary ? "camera-roll.jpg" : "live-capture.jpg", {type: "image/jpeg"}));
        if (!isLibrary && captureToken) form.append("captureToken", captureToken);
        form.append("captureSource", source);
        form.append("capturedAt", String(capture.capturedAt));
        form.append("latitude", String(location.latitude));
        form.append("longitude", String(location.longitude));
        if (isLibrary && rollMetadata) form.append("cameraRollMetadata", JSON.stringify(cameraRollServerPayload(rollMetadata)));
        try {
            const response = await fetch("/api/app/captures", {method: "POST", body: form});
            const body = await response.json();
            if (response.status === 402) {
                // Saved and waiting for credits; it is identified on its own
                // once the wallet covers it.
                if (typeof body.balance === "number") setWallet((current) => ({balance: body.balance, isPro: current?.isPro ?? false}));
                setPhase("credits");
                setMessage(body.message || "This capture is saved. Add credits to continue analysing it.");
                return;
            }
            if (response.status === 403 && body.error === "capture_rules_not_accepted") {
                // Agreed on this device but not yet on the server: ask again.
                setRulesVersion(null);
                heldLibrary.current = null;
                setPhase("rules");
                setMessage(body.message || rulesText.intro);
                return;
            }
            if (!response.ok) throw new Error(body.error || (isLibrary ? "The upload failed." : "Live capture upload failed."));
            setPhase("analyzing");
            setMessage(isLibrary ? "Checking the photo, identity, habitat, and rarity…" : "Checking live-capture authenticity, identity, habitat, and rarity…");
            await poll(body.captureId);
        } catch (error) {
            setPhase("error");
            setMessage(error instanceof Error ? error.message : "Capture failed.");
        }
    }

    const busy = phase === "uploading" || phase === "analyzing";
    const showingCamera = phase === "live";
    const shortOfCredits = wallet !== null && !wallet.isPro && wallet.balance !== null && wallet.balance < PHOTO_CREDIT_COST;
    const isLibraryReview = phase === "review" && source === "camera_roll";
    const placeWaits = isLibraryReview && libraryNeedsPlace(source, rollPlace?.confirmed === true);
    const placeLabel = rollPlace?.place.label ?? (rollPlace ? `${rollPlace.place.latitude.toFixed(3)}, ${rollPlace.place.longitude.toFixed(3)}` : null);
    const cameraAppOpens = entry === "camera" && takePhotoOpensCameraApp(coarsePointer);

    // The offer that stands in for the scanner's "Enable live scanner" from
    // the "+": a label over a file input, so the tap opens the camera app or
    // the roll directly, as the apps' entries do.
    const entryOffer = entry && (phase === "permission" || (phase === "error" && !capture)) ? (
        <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name={entry === "library" ? "spark" : "camera"} className="h-9 w-9"/></span>
            <h2 className="mt-6 font-display text-3xl font-bold">{entry === "library" ? "Upload from camera roll" : "Take a photo"}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/45">{message}</p>
            {checking ? <p className="mt-6 text-sm font-bold text-white/70" aria-live="polite">Checking photo…</p> : entry === "library" || cameraAppOpens ? (
                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 bg-white px-6 py-3.5 text-sm font-black text-black" data-testid="capture-entry-pick">
                    <AppIcon name={entry === "library" ? "spark" : "camera"} className="h-4 w-4"/>
                    {entry === "library" ? "Choose from camera roll" : "Open camera"}
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
                <button onClick={enableScanner} disabled={rulesVersion === undefined} className="mt-6 bg-white px-6 py-3.5 text-sm font-black text-black disabled:opacity-50">Enable live scanner</button>
            )}
        </div>
    ) : null;

    return <div className="mx-auto max-w-4xl">
        <div className="relative min-h-[34rem] overflow-hidden border border-white/10 bg-[#090909]">
            <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${showingCamera ? "block" : "hidden"}`}/>
            <canvas ref={canvasRef} className="hidden"/>
            {capture && phase !== "live" ? <img src={capture.preview} alt={isLibraryReview ? "Camera roll photo review" : "Live camera capture review"} className="absolute inset-0 h-full w-full object-contain"/> : null}
            {!capture && !showingCamera ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,219,101,.12),transparent_45%)]"/> : null}
            <div className="pointer-events-none absolute inset-5 border border-white/20"><span className="absolute left-0 top-0 h-12 w-12 -translate-x-px -translate-y-px border-l-2 border-t-2 border-primary-400"/><span className="absolute bottom-0 right-0 h-12 w-12 translate-x-px translate-y-px border-b-2 border-r-2 border-primary-400"/></div>
            {flash ? <div className="pointer-events-none absolute inset-0 bg-white/60"/> : null}
            {entryOffer}
            {!entry && (phase === "permission" || (phase === "error" && !capture)) ? <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name="camera" className="h-9 w-9"/></span><h2 className="mt-6 font-display text-3xl font-bold">Sighting scanner</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/45">Live capture only. Camera and location permission are required; photo-library selection is not available.</p><button onClick={enableScanner} disabled={rulesVersion === undefined} className="mt-6 bg-white px-6 py-3.5 text-sm font-black text-black disabled:opacity-50">Enable live scanner</button></div> : null}
            {phase === "rules" ? <div lang={rulesLanguage} dir={isRightToLeftLanguage(rulesLanguage) ? "rtl" : "ltr"} className="relative flex min-h-[34rem] flex-col justify-center p-6 sm:p-10">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name="check"/></span>
                <h2 className="mt-4 font-display text-3xl font-bold">{rulesText.title}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{rulesText.intro}</p>
                <ul className="mt-5 space-y-4 border border-white/10 bg-[#151515] p-5">
                    {captureRules.map((rule) => <li key={rule.icon} className="flex gap-3"><span className="mt-0.5 text-primary-200"><AppIcon name={rule.icon} className="h-5 w-5"/></span><span><span className="block text-sm font-bold text-white">{rule.title}</span><span className="block text-sm leading-6 text-white/50">{rule.detail}</span></span></li>)}
                </ul>
                <p className="mt-4 flex gap-2 text-sm leading-6 text-white/70"><span className="text-orange-300">!</span>{rulesText.enforcement}</p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/80"><input type="checkbox" checked={rulesConfirmed} onChange={(event) => setRulesConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#a7f432]"/>{rulesText.confirm}</label>
                <div className="mt-5 flex gap-3"><button onClick={agreeToRules} disabled={!rulesConfirmed || savingRules} className="flex-1 bg-primary-400 px-5 py-3.5 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/40">{savingRules ? "…" : rulesText.agree}</button><button onClick={declineRules} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">{rulesText.notNow}</button></div>
            </div> : null}
            {showingCamera ? <div className="absolute inset-x-0 bottom-7 flex justify-center"><button onClick={takePhoto} disabled={shooting} aria-label="Take live photo" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/25 shadow-2xl transition active:scale-95 disabled:opacity-60"><span className="h-14 w-14 rounded-full bg-primary-400"/></button></div> : null}
            {busy ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-8 text-center backdrop-blur-sm"><span className="h-14 w-14 animate-spin rounded-full border-2 border-white/15 border-t-primary-400"/><p className="mt-6 font-display text-2xl font-bold">{phase === "uploading" ? (source === "camera_roll" ? "Uploading photo" : "Securing live capture") : "Analyzing animal"}</p><p className="mt-2 max-w-md text-sm text-white/50">{message}</p></div> : null}
        </div>
        <div className="mt-5 border border-white/10 bg-[#151515] p-5"><div className="flex items-start gap-3"><span className={phase === "error" ? "text-red-300" : "text-primary-200"}><AppIcon name={phase === "complete" ? "check" : phase === "error" ? "close" : "spark"}/></span><p className="text-sm leading-6 text-white/55">{message}</p></div>
            {isLibraryReview ? (
                // Where was this? The file's own pin, to confirm or change; or a place to pick. Never today's fix.
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm" data-testid="roll-place">
                    <AppIcon name="location" className="h-4 w-4 shrink-0 text-primary-200"/>
                    {rollPlace?.confirmed ? (
                        <><span className="min-w-0 flex-1 text-white/80">{placeLabel}</span><button type="button" onClick={() => setPlaceSheet(true)} className="font-black text-primary-200 underline underline-offset-2">Change</button></>
                    ) : rollPlace ? (
                        <><span className="min-w-0 flex-1 text-white/80">From the photo: {placeLabel ?? "…"}</span><button type="button" onClick={() => setRollPlace((current) => current ? {...current, confirmed: true} : current)} className="bg-primary-400 px-3 py-1.5 text-xs font-black text-black" data-testid="roll-place-confirm">Confirm</button><button type="button" onClick={() => setPlaceSheet(true)} className="font-black text-primary-200 underline underline-offset-2">Change</button></>
                    ) : (
                        <><span className="min-w-0 flex-1 text-white/80">This photo has no location saved. Pick the place you took it.</span><button type="button" onClick={() => setPlaceSheet(true)} className="bg-primary-400 px-3 py-1.5 text-xs font-black text-black" data-testid="roll-place-pick">Pick the place</button></>
                    )}
                </div>
            ) : null}
            {phase === "review" ? <div className="mt-5 flex gap-3"><button onClick={retake} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">{entry === "library" ? "Choose another" : "Retake"}</button><button onClick={analyze} disabled={placeWaits} title={placeWaits ? "Pick where this photo was taken first." : undefined} className="flex flex-1 items-center justify-center gap-2 bg-primary-400 px-5 py-3.5 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/40" data-testid="identify-photo"><AppIcon name="spark"/>Identify photo</button></div> : null}{phase === "review" && wallet && !wallet.isPro ? (shortOfCredits
                ? <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-orange-300">Needs {PHOTO_CREDIT_COST} credits — you have {wallet.balance}.<a href="/app/credits" className="font-black text-primary-200 underline underline-offset-2">Get Credits</a></p>
                : <p className="mt-3 text-xs text-white/35">Uses {PHOTO_CREDIT_COST} credits</p>) : null}{phase === "credits" ? <div className="mt-5"><p className="font-display text-xl font-bold text-white">Not enough credits</p><div className="mt-4 flex gap-3"><a href="/app/credits" className="flex flex-1 items-center justify-center bg-primary-400 px-5 py-3.5 text-sm font-black text-black">Get Credits</a><button onClick={retake} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">Take another</button></div></div> : null}{(showingCamera || phase === "review") && source === "live_camera" ? <p className="mt-4 flex items-center gap-2 text-xs text-white/30"><AppIcon name="location" className="h-4 w-4"/>{hasLocation ? "Live location attached for habitat validation" : "Getting your location…"}</p> : null}</div>
        {placeSheet ? (
            <PlaceSheet
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

/**
 * "Where was this?" for a library photo: a place search over the same
 * geocoder the Instagram importer uses. The answer is the person's own,
 * recorded as confirmed, never the browser's fix.
 */
function PlaceSheet({initialLabel, onCancel, onConfirm}: {initialLabel: string | null; onCancel: () => void; onConfirm: (place: Place) => void}) {
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
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="capture-place-title"
                className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto border border-white/10 bg-[#101010] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2"
                data-testid="roll-place-sheet"
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 id="capture-place-title" className="font-display text-2xl font-bold text-white">Where was this?</h3>
                    <button type="button" aria-label="Close" onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/60">
                        <AppIcon name="close" />
                    </button>
                </div>
                <p className="text-sm text-white/45">{initialLabel ? `The photo says ${initialLabel}. Pick the place if that's wrong.` : "This photo has no location saved. Pick the place you took it. It's required for camera-roll uploads."}</p>
                <label className="mt-4 block">
                    <span className="sr-only">Search for a place</span>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search for a place"
                        enterKeyHint="search"
                        autoComplete="off"
                        className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-primary-400/50"
                    />
                </label>
                {searching ? <p className="mt-3 text-xs text-white/35">Searching…</p> : null}
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
                    Confirm location
                </button>
            </div>
        </div>
    );
}
