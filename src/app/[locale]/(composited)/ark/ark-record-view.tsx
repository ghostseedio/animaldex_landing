"use client";

import React, {useEffect, useRef, useState} from "react";
import type {ArkSnapshot} from "@/ark-scene/types";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {arkTwoIslands} from "@/lib/ark-islands";
import {ARK_LIVE_WILD_ISLAND} from "@/ark-scene/islands/wild-default";

/**
 * `/ark?record=1`: the Ark alone, full screen, for the marketing clip
 * recorder (scripts/ark-clips.mts, docs/ark-next-4b.md). No page around it,
 * no replay of its own, nothing remembered; time is the recorder's clock and
 * the camera is `window.__arkDirector`'s. Only served in development or
 * where `ARK_RECORD_ENABLED=1` (page.tsx).
 *
 * `&replay=<event id>` (V2 replay, `src/ark-scene/replay/README.md`): the recorder films that recorded event at its own
 * time. The page then reads the public event log through to now (a single read stops about a thousand rows in), so
 * the event and the records of the animals it names are in `__arkDirector.info().events`; the recorder plans the shot
 * from it. `&lite=1` with it: the replay as Ark Lite shows it, in words (no 3D world).
 */

type Props = {
    initial: ArkSnapshot;
    fixture: boolean;
    modelBase: string;
    /** The fixture's event log (as the server answers it); null: the live log is read from /api/ark/events. */
    events: unknown | null;
    /** A recorded event's id to replay (`&replay=`), or null. */
    replay?: string | null;
    /** The replay in words, as Ark Lite shows it (`&lite=1`), instead of the 3D world. */
    lite?: boolean;
};

/** How far back the live log is read for a meal to replay (the route's own limit). */
const EVENTS_DAYS = 30;

export default function ArkRecordView({initial, fixture, modelBase, events, replay = null, lite = false}: Props) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;
        let disposed = false;
        let dispose: (() => void) | null = null;
        // (A replay: the log read through to now, `replay/event-log.ts`: the newest events are past a single read's end.)
        const log: Promise<unknown> = events
            ? Promise.resolve(events)
            : replay
            ? import("@/ark-scene/replay/event-log").then(({readArkEventLog}) => readArkEventLog("")).then((read) => read.events).catch(() => [])
            : fetch(`/api/ark/events?since=${encodeURIComponent(new Date(Date.now() - EVENTS_DAYS * 86_400_000).toISOString())}`, {cache: "no-store"})
                .then((response) => (response.ok ? response.json() : {events: []}))
                .then((body: {events?: unknown}) => body.events ?? [])
                .catch(() => []);
        if (replay && lite) {
            // Ark Lite's replay: the event in words (`replay/text.ts`), no world.
            Promise.all([import("@/ark-scene/replay/event-replay"), import("@/ark-scene/replay/text"), log])
                .then(([{planArkEventReplay}, {arkReplayText, renderArkReplayCard}, eventLog]) => {
                    if (disposed) return;
                    const plan = planArkEventReplay(replay, eventLog, initial, {now: Date.now()});
                    el.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;padding:16px;background:#0b1422";
                    renderArkReplayCard(el, plan, arkReplayText(plan, null, document.documentElement.lang || "en", {sample: fixture || plan.provisional}), getSpeciesArtworkUrl);
                    setState("ready");
                })
                .catch((error) => {
                    console.warn("[ark] the replay could not be shown", error);
                    setState("failed");
                });
            return () => {
                disposed = true;
            };
        }
        // The wild island the live page shows (`islands/archipelago.ts`: the bigger one in islands mode), chosen before any
        // of the scene's modules load (`world.ts` askedWorld). Before, the recorder filmed today's Ark on the old island:
        // every place differed from the live page's, and the server's encounter places (a meal's, an escape's) are the
        // live island's.
        const world = arkTwoIslands(initial) && ARK_LIVE_WILD_ISLAND === "v2" ? import("@/ark-scene/world").then(({setArkWorld}) => setArkWorld("v2")) : Promise.resolve();
        world.then(() => Promise.all([import("@/ark-scene"), import("@/ark-scene/record-clock"), import("@/ark-scene/director"), log]))
            .then(async ([{mountArk}, {installRecordClock}, {createArkDirector}, eventLog]) => {
                if (disposed) return;
                // Part C, one world (decision 141): with two islands the town is built first and stands across the strait.
                const {arkIslandSnapshot} = await import("@/lib/ark-islands");
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
