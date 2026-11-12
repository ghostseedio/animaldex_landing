"use client";

import React, {useEffect, useRef, useState} from "react";
import type {ArkSnapshot} from "@/ark-scene/types";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";

/**
 * `/ark?record=1`: the Ark alone, full screen, for the marketing clip
 * recorder (scripts/ark-clips.mts, docs/ark-next-4b.md). No page around it,
 * no replay of its own, nothing remembered; time is the recorder's clock and
 * the camera is `window.__arkDirector`'s. Only served in development or
 * where `ARK_RECORD_ENABLED=1` (page.tsx).
 */

type Props = {
    initial: ArkSnapshot;
    fixture: boolean;
    modelBase: string;
    /** The fixture's event log (as the server answers it); null: the live log is read from /api/ark/events. */
    events: unknown | null;
};

/** How far back the live log is read for a meal to replay (the route's own limit). */
const EVENTS_DAYS = 30;

export default function ArkRecordView({initial, fixture, modelBase, events}: Props) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;
        let disposed = false;
        let dispose: (() => void) | null = null;
        const log: Promise<unknown> = events
            ? Promise.resolve(events)
            : fetch(`/api/ark/events?since=${encodeURIComponent(new Date(Date.now() - EVENTS_DAYS * 86_400_000).toISOString())}`, {cache: "no-store"})
                .then((response) => (response.ok ? response.json() : {events: []}))
                .then((body: {events?: unknown}) => body.events ?? [])
                .catch(() => []);
        Promise.all([import("@/ark-scene"), import("@/ark-scene/record-clock"), import("@/ark-scene/director"), log])
            .then(async ([{mountArk}, {installRecordClock}, {createArkDirector}, eventLog]) => {
                if (disposed) return;
                // Part C, one world (decision 141): with two islands the town is built first and stands across the strait.
                const {arkIslandSnapshot, arkTwoIslands} = await import("@/lib/ark-islands");
                const two = arkTwoIslands(initial);
                const town = two ? await (await import("@/ark-scene/islands/scene")).loadTownScene({tier: "high", animals: arkIslandSnapshot(initial, "town").animals}) : null;
                if (disposed) {
                    town?.dispose();
                    return;
                }
                // The best quality tier, never lowered: frames take as long as they take.
                (globalThis as {__arkQuality?: string}).__arkQuality = "high";
                const clock = installRecordClock(window);
                const handle = mountArk(el, {
                    snapshot: initial,
                    modelBase,
                    iconUrl: getSpeciesArtworkUrl,
                    recording: true,
                    hours: 10.5,
                    ...(town ? {island: town, wildAnimals: arkIslandSnapshot(initial, "wild").animals} : {})
                });
                dispose = () => handle.dispose();
                const director = createArkDirector({
                    handle,
                    clock,
                    canvas: () => el.querySelector("canvas"),
                    info: {snapshot: initial, fixture, events: eventLog}
                });
                (window as unknown as {__arkDirector?: unknown}).__arkDirector = director;
                clock.tick(0);
                setState("ready");
            })
            .catch((error) => {
                console.warn("[ark] the recorder could not start", error);
                setState("failed");
            });
        return () => {
            disposed = true;
            dispose?.();
        };
        // Built once: a recording is one page load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{position: "fixed", inset: 0, zIndex: 2147483000, background: "#000"}} data-ark-record={state}>
            <div ref={mountRef} style={{position: "absolute", inset: 0}} />
        </div>
    );
}
