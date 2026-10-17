"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {storeCaptureReveal} from "@/lib/capture-reveal";
import {CAPTURE_RULES_TEXT, captureRulesLanguage, isRightToLeftLanguage} from "@/lib/capture-rules-text";

type Phase = "permission" | "rules" | "live" | "review" | "uploading" | "analyzing" | "credits" | "complete" | "error";
type Coordinates = {latitude: number; longitude: number; at: number};
type Wallet = {balance: number | null; isPro: boolean};

/** What identifying one photo costs; the server charges it (analyze-capture). */
const PHOTO_CREDIT_COST = 2;

// The rules every capture is held to, worded and translated as in the apps
// (lib/capture-rules-text, generated from the iOS catalog). Bump the version
// with the apps' CaptureRules.version.
const CAPTURE_RULES_VERSION = 1;

const LIVE_HINT = "Center one live animal in the frame. Avoid screens, posters, artwork, and heavy blur.";
/** A fix older than this is refreshed before it is attached to a capture. */
const LOCATION_FRESH_MS = 120_000;

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

export default function CaptureClient() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const locationRef = useRef<Coordinates | null>(null);
    const locatingRef = useRef<Promise<Coordinates> | null>(null);
    const [phase, setPhase] = useState<Phase>("permission");
    const [message, setMessage] = useState("Camera and location access are required. Gallery uploads are disabled.");
    const [capture, setCapture] = useState<{blob: Blob; preview: string; capturedAt: number} | null>(null);
    const [captureToken, setCaptureToken] = useState<string | null>(null);
    const [hasLocation, setHasLocation] = useState(false);
    const [rulesVersion, setRulesVersion] = useState<number | null | undefined>(undefined);
    const [rulesConfirmed, setRulesConfirmed] = useState(false);
    const [savingRules, setSavingRules] = useState(false);
    const [shooting, setShooting] = useState(false);
    const [flash, setFlash] = useState(false);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [rulesLanguage, setRulesLanguage] = useState("en");
    const rulesText = CAPTURE_RULES_TEXT[rulesLanguage] ?? CAPTURE_RULES_TEXT.en;
    const captureRules = [
        {icon: "camera", title: rulesText.ownTitle, detail: rulesText.ownDetail},
        {icon: "spark", title: rulesText.realTitle, detail: rulesText.realDetail},
        {icon: "location", title: rulesText.locationTitle, detail: rulesText.locationDetail}
    ] as const;

    // The rules people agree to read in their own language, as in the apps.
    useEffect(() => {
        setRulesLanguage(captureRulesLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
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
        let cancelled = false;
        fetch("/api/app/capture-rules", {cache: "no-store"})
            .then((response) => response.ok ? response.json() : null)
            .then((body) => {if (!cancelled) setRulesVersion(typeof body?.version === "number" ? body.version : null);})
            .catch(() => {if (!cancelled) setRulesVersion(null);});
        return () => {cancelled = true;};
    }, []);

    // The wallet, so the review can say before Identify whether this photo is
    // covered. Unknown (offline, an error) shows the plain cost.
    useEffect(() => {
        let cancelled = false;
        fetch("/api/app/billing/status", {cache: "no-store"})
            .then((response) => response.ok ? response.json() : null)
            .then((body) => {
                if (cancelled || !body) return;
                setWallet({balance: typeof body.balance === "number" ? body.balance : null, isPro: body.is_pro === true});
            })
            .catch(() => {});
        return () => {cancelled = true;};
    }, []);

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
            const response = await fetch("/api/app/capture-rules", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({version: CAPTURE_RULES_VERSION})
            });
            if (!response.ok) throw new Error(rulesText.saveFailed);
            setRulesVersion(CAPTURE_RULES_VERSION);
            void startCamera();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : rulesText.saveFailed);
        } finally {
            setSavingRules(false);
        }
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
            setPhase("live");
            setMessage(LIVE_HINT);
            requestAnimationFrame(() => {if (videoRef.current) {videoRef.current.srcObject = stream; void videoRef.current.play();}});
        } catch (error) {
            stopCamera();
            setPhase("error");
            setMessage(error instanceof Error ? error.message : "Camera access failed.");
        }
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
        const tokenRequest = fetch("/api/app/captures/session", {method: "POST"})
            .then(async (response) => {
                const session = await response.json().catch(() => ({}));
                if (!response.ok || !session.token) throw new Error(session.error || "Could not start a secure capture session.");
                return session.token as string;
            });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
        try {
            const token = await tokenRequest;
            if (!blob) throw new Error("Could not read the live camera frame. Try again.");
            setCaptureToken(token);
            setCapture({blob, preview: URL.createObjectURL(blob), capturedAt});
            setPhase("review");
            setMessage("Confirm this live photo before sending it to analysis.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not take the photo. Try again.");
        } finally {
            setShooting(false);
        }
    }

    function retake() {
        setCapture(null);
        setCaptureToken(null);
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
                // Never in the way — a reveal that cannot be read is skipped.
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
        if (!capture || !captureToken) return;
        setPhase("uploading");
        setMessage(locationRef.current ? "Uploading the verified live camera frame…" : "Getting your location…");
        let location: Coordinates;
        try {
            location = await locate();
        } catch (error) {
            setPhase("review");
            setMessage(error instanceof Error ? error.message : "Location permission is required for live scans.");
            return;
        }
        setMessage("Uploading the verified live camera frame…");
        stopCamera();
        const form = new FormData();
        form.append("image", new File([capture.blob], "live-capture.jpg", {type: "image/jpeg"}));
        form.append("captureToken", captureToken);
        form.append("captureSource", "live_camera");
        form.append("capturedAt", String(capture.capturedAt));
        form.append("latitude", String(location.latitude));
        form.append("longitude", String(location.longitude));
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
            if (!response.ok) throw new Error(body.error || "Live capture upload failed.");
            setPhase("analyzing");
            setMessage("Checking live-capture authenticity, identity, habitat, and rarity…");
            await poll(body.captureId);
        } catch (error) {
            setPhase("error");
            setMessage(error instanceof Error ? error.message : "Capture failed.");
        }
    }

    const busy = phase === "uploading" || phase === "analyzing";
    const showingCamera = phase === "live";
    const shortOfCredits = wallet !== null && !wallet.isPro && wallet.balance !== null && wallet.balance < PHOTO_CREDIT_COST;

    return <div className="mx-auto max-w-4xl">
        <div className="relative min-h-[34rem] overflow-hidden border border-white/10 bg-[#090909]">
            <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${showingCamera ? "block" : "hidden"}`}/>
            <canvas ref={canvasRef} className="hidden"/>
            {capture && phase !== "live" ? <img src={capture.preview} alt="Live camera capture review" className="absolute inset-0 h-full w-full object-contain"/> : null}
            {!capture && !showingCamera ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,219,101,.12),transparent_45%)]"/> : null}
            <div className="pointer-events-none absolute inset-5 border border-white/20"><span className="absolute left-0 top-0 h-12 w-12 -translate-x-px -translate-y-px border-l-2 border-t-2 border-primary-400"/><span className="absolute bottom-0 right-0 h-12 w-12 translate-x-px translate-y-px border-b-2 border-r-2 border-primary-400"/></div>
            {flash ? <div className="pointer-events-none absolute inset-0 bg-white/60"/> : null}
            {phase === "permission" || (phase === "error" && !capture) ? <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name="camera" className="h-9 w-9"/></span><h2 className="mt-6 font-display text-3xl font-bold">Sighting scanner</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/45">Live capture only. Camera and location permission are required; photo-library selection is not available.</p><button onClick={enableScanner} disabled={rulesVersion === undefined} className="mt-6 bg-white px-6 py-3.5 text-sm font-black text-black disabled:opacity-50">Enable live scanner</button></div> : null}
            {phase === "rules" ? <div lang={rulesLanguage} dir={isRightToLeftLanguage(rulesLanguage) ? "rtl" : "ltr"} className="relative flex min-h-[34rem] flex-col justify-center p-6 sm:p-10">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name="check"/></span>
                <h2 className="mt-4 font-display text-3xl font-bold">{rulesText.title}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{rulesText.intro}</p>
                <ul className="mt-5 space-y-4 border border-white/10 bg-[#151515] p-5">
                    {captureRules.map((rule) => <li key={rule.icon} className="flex gap-3"><span className="mt-0.5 text-primary-200"><AppIcon name={rule.icon} className="h-5 w-5"/></span><span><span className="block text-sm font-bold text-white">{rule.title}</span><span className="block text-sm leading-6 text-white/50">{rule.detail}</span></span></li>)}
                </ul>
                <p className="mt-4 flex gap-2 text-sm leading-6 text-white/70"><span className="text-orange-300">!</span>{rulesText.enforcement}</p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/80"><input type="checkbox" checked={rulesConfirmed} onChange={(event) => setRulesConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#a7f432]"/>{rulesText.confirm}</label>
                <div className="mt-5 flex gap-3"><button onClick={agreeToRules} disabled={!rulesConfirmed || savingRules} className="flex-1 bg-primary-400 px-5 py-3.5 text-sm font-black text-black disabled:bg-white/10 disabled:text-white/40">{savingRules ? "…" : rulesText.agree}</button><button onClick={() => setPhase("permission")} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">{rulesText.notNow}</button></div>
            </div> : null}
            {showingCamera ? <div className="absolute inset-x-0 bottom-7 flex justify-center"><button onClick={takePhoto} disabled={shooting} aria-label="Take live photo" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/25 shadow-2xl transition active:scale-95 disabled:opacity-60"><span className="h-14 w-14 rounded-full bg-primary-400"/></button></div> : null}
            {busy ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-8 text-center backdrop-blur-sm"><span className="h-14 w-14 animate-spin rounded-full border-2 border-white/15 border-t-primary-400"/><p className="mt-6 font-display text-2xl font-bold">{phase === "uploading" ? "Securing live capture" : "Analyzing animal"}</p><p className="mt-2 max-w-md text-sm text-white/50">{message}</p></div> : null}
        </div>
        <div className="mt-5 border border-white/10 bg-[#151515] p-5"><div className="flex items-start gap-3"><span className={phase === "error" ? "text-red-300" : "text-primary-200"}><AppIcon name={phase === "complete" ? "check" : phase === "error" ? "close" : "spark"}/></span><p className="text-sm leading-6 text-white/55">{message}</p></div>{phase === "review" ? <div className="mt-5 flex gap-3"><button onClick={retake} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">Retake</button><button onClick={analyze} className="flex flex-1 items-center justify-center gap-2 bg-primary-400 px-5 py-3.5 text-sm font-black text-black"><AppIcon name="spark"/>Identify photo</button></div> : null}{phase === "review" && wallet && !wallet.isPro ? (shortOfCredits
                ? <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-orange-300">Needs {PHOTO_CREDIT_COST} credits — you have {wallet.balance}.<a href="/app/credits" className="font-black text-primary-200 underline underline-offset-2">Get Credits</a></p>
                : <p className="mt-3 text-xs text-white/35">Uses {PHOTO_CREDIT_COST} credits</p>) : null}{phase === "credits" ? <div className="mt-5"><p className="font-display text-xl font-bold text-white">Not enough credits</p><div className="mt-4 flex gap-3"><a href="/app/credits" className="flex flex-1 items-center justify-center bg-primary-400 px-5 py-3.5 text-sm font-black text-black">Get Credits</a><button onClick={retake} className="border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">Take another</button></div></div> : null}{showingCamera || phase === "review" ? <p className="mt-4 flex items-center gap-2 text-xs text-white/30"><AppIcon name="location" className="h-4 w-4"/>{hasLocation ? "Live location attached for habitat validation" : "Getting your location…"}</p> : null}</div>
    </div>;
}
