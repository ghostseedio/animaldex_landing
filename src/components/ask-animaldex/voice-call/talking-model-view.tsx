"use client";

/**
 * The animal on a call: its 3D model once it has loaded (three.js arrives
 * with it, so a page that never opens a call never downloads it), a quiet
 * wait until then, and if it cannot be shown the call goes on without it.
 *
 * Fingers (and a mouse): one rolls the animal like a ball about its middle,
 * two twist it and pinch to zoom (a wheel or a trackpad pinch zooms too), a
 * double tap brings it home, a single tap stops it talking. A ring shows
 * under each finger, as on iOS.
 */

import {useEffect, useRef, useState} from "react";
import type {TalkingModelAsset} from "@/lib/talking-models/catalog";
import type {TalkingStage} from "@/components/ask-animaldex/voice-call/talking-model-renderer";

type Ring = {id: number; x: number; y: number; leaving: boolean};

const DOUBLE_TAP_MS = 280;

export default function TalkingModelView({
    asset,
    decibels,
    unavailableLabel,
    onTap
}: {
    asset: TalkingModelAsset | null;
    decibels: () => number;
    /** "{animal} can't be shown right now." */
    unavailableLabel: string;
    /** A single tap: the animal stops talking. */
    onTap: () => void;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const stageRef = useRef<TalkingStage | null>(null);
    const decibelsRef = useRef(decibels);
    decibelsRef.current = decibels;
    const onTapRef = useRef(onTap);
    onTapRef.current = onTap;
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
    const [rings, setRings] = useState<Ring[]>([]);

    useEffect(() => {
        if (!asset) {
            setState("failed");
            return;
        }
        let cancelled = false;
        const abort = new AbortController();
        setState("loading");
        void (async () => {
            try {
                const renderer = await import("@/components/ask-animaldex/voice-call/talking-model-renderer");
                const loaded = await renderer.loadTalkingModel(asset, abort.signal);
                const container = containerRef.current;
                if (cancelled || !container) return;
                const stage = await renderer.createTalkingStage(container, loaded, {decibels: () => decibelsRef.current()});
                if (cancelled) {
                    stage.dispose();
                    return;
                }
                const box = container.getBoundingClientRect();
                stage.resize(box.width, box.height);
                stageRef.current = stage;
                setState("ready");
            } catch (error) {
                if (!cancelled) {
                    console.warn("[voice-call] the animal could not be shown", error instanceof Error ? error.message : error);
                    setState("failed");
                }
            }
        })();
        return () => {
            cancelled = true;
            abort.abort();
            stageRef.current?.dispose();
            stageRef.current = null;
        };
    }, [asset]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) => {
            const {width, height} = entry.contentRect;
            stageRef.current?.resize(width, height);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Taps: a double tap is home; a single one waits to be sure it is not the first of two.
    const tap = useRef<{at: number; timer: ReturnType<typeof setTimeout> | null}>({at: 0, timer: null});
    const downs = useRef(new Map<number, {x: number; y: number; at: number}>());
    const moved = useRef(false);

    useEffect(() => () => {
        if (tap.current.timer) clearTimeout(tap.current.timer);
    }, []);

    const local = (event: React.PointerEvent<HTMLDivElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        return {x: event.clientX - box.left, y: event.clientY - box.top};
    };

    const showRing = (id: number, x: number, y: number) => {
        setRings((current) => [...current.filter((ring) => ring.id !== id), {id, x, y, leaving: false}]);
    };
    const dropRing = (id: number) => {
        setRings((current) => current.map((ring) => (ring.id === id ? {...ring, leaving: true} : ring)));
        setTimeout(() => setRings((current) => current.filter((ring) => !(ring.id === id && ring.leaving))), 250);
    };

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const {x, y} = local(event);
        if (downs.current.size === 0) moved.current = false;
        downs.current.set(event.pointerId, {x, y, at: performance.now()});
        if (downs.current.size > 1) moved.current = true;
        showRing(event.pointerId, x, y);
        stageRef.current?.pointerDown(event.pointerId, x, y);
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const down = downs.current.get(event.pointerId);
        if (!down) return;
        const {x, y} = local(event);
        if (Math.hypot(x - down.x, y - down.y) > 8) moved.current = true;
        showRing(event.pointerId, x, y);
        stageRef.current?.pointerMove(event.pointerId, x, y);
    };

    const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        const down = downs.current.get(event.pointerId);
        if (!down) return;
        downs.current.delete(event.pointerId);
        dropRing(event.pointerId);
        stageRef.current?.pointerUp(event.pointerId);
        if (downs.current.size > 0 || moved.current || performance.now() - down.at > 400) return;
        const now = performance.now();
        if (tap.current.timer && now - tap.current.at < DOUBLE_TAP_MS) {
            // Double tap: the animal back how it started (it can be turned out of view).
            clearTimeout(tap.current.timer);
            tap.current = {at: 0, timer: null};
            stageRef.current?.goHome();
            return;
        }
        tap.current = {
            at: now,
            timer: setTimeout(() => {
                tap.current = {at: 0, timer: null};
                onTapRef.current();
            }, DOUBLE_TAP_MS)
        };
    };

    const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!downs.current.has(event.pointerId)) return;
        downs.current.delete(event.pointerId);
        moved.current = true;
        dropRing(event.pointerId);
        stageRef.current?.pointerUp(event.pointerId);
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        // Not passive: the page must not scroll or zoom under the animal.
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            stageRef.current?.zoom(event.ctrlKey ? event.deltaY * 4 : event.deltaY);
        };
        container.addEventListener("wheel", onWheel, {passive: false});
        return () => container.removeEventListener("wheel", onWheel);
    }, []);

    return (
        <div className="relative h-full w-full">
            {/* The stage draws into a canvas of its own in here. */}
            <div
                ref={containerRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onContextMenu={(event) => event.preventDefault()}
                className={`h-full w-full touch-none select-none transition-opacity duration-[350ms] ${state === "ready" ? "opacity-100" : "opacity-0"}`}
                data-testid="talking-model-canvas"
                data-state={state}
            />
            {rings.map((ring) => (
                <span
                    key={ring.id}
                    aria-hidden="true"
                    className={`pointer-events-none absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-opacity duration-200 ${ring.leaving ? "opacity-0" : "opacity-100"}`}
                    style={{left: ring.x, top: ring.y, borderColor: "rgba(167, 244, 50, 0.85)", backgroundColor: "rgba(167, 244, 50, 0.18)"}}
                />
            ))}
            {state === "loading" ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                </div>
            ) : null}
            {state === "failed" ? (
                <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm font-medium text-white/55">
                    {unavailableLabel}
                </p>
            ) : null}
        </div>
    );
}
