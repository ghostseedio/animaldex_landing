"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";

type Phase = "permission" | "live" | "review" | "uploading" | "analyzing" | "complete" | "error";
type Coordinates = {latitude: number; longitude: number};

function currentPosition() {
    return new Promise<Coordinates>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("This browser does not provide location access."));
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({latitude: position.coords.latitude, longitude: position.coords.longitude}),
            () => reject(new Error("AnimalDex requires location permission for live scans.")),
            {enableHighAccuracy: true, timeout: 12_000, maximumAge: 0}
        );
    });
}

export default function CaptureClient() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [phase, setPhase] = useState<Phase>("permission");
    const [message, setMessage] = useState("Camera and location access are required. Gallery uploads are disabled.");
    const [capture, setCapture] = useState<{blob: Blob; preview: string; capturedAt: number} | null>(null);
    const [location, setLocation] = useState<Coordinates | null>(null);
    const [captureToken, setCaptureToken] = useState<string | null>(null);

    function stopCamera() {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }

    useEffect(() => () => {stopCamera(); if (capture?.preview) URL.revokeObjectURL(capture.preview);}, [capture?.preview]);

    async function startCamera() {
        setPhase("permission");
        setMessage("Requesting back camera and precise location…");
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error("Live camera capture requires HTTPS and a supported browser.");
            const [stream, coordinates] = await Promise.all([
                navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: "environment"}, width: {ideal: 1920}, height: {ideal: 1080}}}),
                currentPosition()
            ]);
            streamRef.current = stream;
            setLocation(coordinates);
            setCaptureToken(null);
            setPhase("live");
            setMessage("Center one live animal in the frame. Avoid screens, posters, artwork, and heavy blur.");
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
        if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
            setMessage("The live camera is not ready yet. Wait a second and try again.");
            return;
        }
        const sessionResponse = await fetch("/api/app/captures/session", {method: "POST"});
        const session = await sessionResponse.json().catch(() => ({}));
        if (!sessionResponse.ok || !session.token) {
            setMessage(session.error || "Could not start a secure capture session.");
            return;
        }
        setCaptureToken(session.token);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) {setMessage("Could not read the live camera frame. Try again."); return;}
            if (capture?.preview) URL.revokeObjectURL(capture.preview);
            setCapture({blob, preview: URL.createObjectURL(blob), capturedAt: Date.now()});
            setPhase("review");
            setMessage("Confirm this live photo before sending it to analysis.");
        }, "image/jpeg", 0.94);
    }

    function retake() {
        if (capture?.preview) URL.revokeObjectURL(capture.preview);
        setCapture(null);
        if (!streamRef.current?.active) {void startCamera(); return;}
        setPhase("live");
        setMessage("Center one live animal in the frame. Avoid screens, posters, artwork, and heavy blur.");
    }

    async function poll(id: string) {
        for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const response = await fetch(`/api/app/captures/${id}`, {cache: "no-store"});
            const body = await response.json();
            if (body.analysis?.error_message || body.status === "failed") throw new Error(body.analysis?.error_message || "Analysis failed.");
            if (body.analysis?.completed_at && body.status === "ready") {
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
        if (!capture || !location || !captureToken) return;
        setPhase("uploading");
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

    return <div className="mx-auto max-w-4xl">
        <div className="relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[#090909]">
            <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${showingCamera ? "block" : "hidden"}`}/>
            <canvas ref={canvasRef} className="hidden"/>
            {capture && phase !== "live" ? <img src={capture.preview} alt="Live camera capture review" className="absolute inset-0 h-full w-full object-contain"/> : null}
            {!capture && !showingCamera ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,219,101,.12),transparent_45%)]"/> : null}
            <div className="pointer-events-none absolute inset-5 rounded-[1.6rem] border border-white/20"><span className="absolute left-0 top-0 h-12 w-12 -translate-x-px -translate-y-px rounded-tl-[1.6rem] border-l-2 border-t-2 border-primary-400"/><span className="absolute bottom-0 right-0 h-12 w-12 translate-x-px translate-y-px rounded-br-[1.6rem] border-b-2 border-r-2 border-primary-400"/></div>
            {phase === "permission" || (phase === "error" && !capture) ? <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-400/10 text-primary-200"><AppIcon name="camera" className="h-9 w-9"/></span><h2 className="mt-6 font-display text-3xl font-bold">Sighting scanner</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/45">Live capture only. Camera and location permission are required; photo-library selection is not available.</p><button onClick={startCamera} className="mt-6 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-black">Enable live scanner</button></div> : null}
            {showingCamera ? <div className="absolute inset-x-0 bottom-7 flex justify-center"><button onClick={takePhoto} aria-label="Take live photo" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/25 shadow-2xl"><span className="h-14 w-14 rounded-full bg-white"/></button></div> : null}
            {busy ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-8 text-center backdrop-blur-sm"><span className="h-14 w-14 animate-spin rounded-full border-2 border-white/15 border-t-primary-400"/><p className="mt-6 font-display text-2xl font-bold">{phase === "uploading" ? "Securing live capture" : "Analyzing animal"}</p><p className="mt-2 max-w-md text-sm text-white/50">{message}</p></div> : null}
        </div>
        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#151515] p-5"><div className="flex items-start gap-3"><span className={phase === "error" ? "text-red-300" : "text-primary-200"}><AppIcon name={phase === "complete" ? "check" : phase === "error" ? "close" : "spark"}/></span><p className="text-sm leading-6 text-white/55">{message}</p></div>{phase === "review" ? <div className="mt-5 flex gap-3"><button onClick={analyze} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-400 px-5 py-3.5 text-sm font-black text-black"><AppIcon name="check"/>Use capture</button><button onClick={retake} className="rounded-2xl border border-white/10 px-5 py-3.5 text-sm font-black text-white/60">Retake</button></div> : null}{location ? <p className="mt-4 flex items-center gap-2 text-xs text-white/30"><AppIcon name="location" className="h-4 w-4"/>Live location attached for habitat validation</p> : null}</div>
    </div>;
}
