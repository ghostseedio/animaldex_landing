"use client";

import {useEffect, useRef, useState} from "react";
import {loadTalkingModelManifest, talkingModelAsset, talkingModelSceneUrl} from "@/lib/talking-models/catalog";

/**
 * The voice level of a line read aloud (dBFS) at `t` seconds: a syllable on each vowel run, about 13 letters a
 * second, a breath at a comma and a longer one at a full stop. Only for the dev render, never for a real voice.
 */
function lineLevel(text: string, t: number): number {
    const letterSeconds = 1 / 13;
    let at = 0.35;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const pause = char === "," ? 0.22 : char === "." || char === "?" || char === "!" ? 0.45 : 0;
        const length = letterSeconds + pause;
        if (t < at + length) {
            if (pause) return -60;
            if (char === " ") return -34;
            const vowel = /[aeiouy]/i.test(char);
            const within = (t - at) / letterSeconds;
            return (vowel ? -16 : -27) - 6 * Math.abs(within - 0.5);
        }
        at += length;
    }
    return -60;
}

export default function LandingTalkClient({slug, text, withScene}: {slug: string; text: string; withScene: boolean}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scene, setScene] = useState<string | null>(null);
    const [state, setState] = useState("loading");

    useEffect(() => {
        let disposed = false;
        let dispose: (() => void) | null = null;
        void (async () => {
            const [{installRecordClock}, renderer, manifest] = await Promise.all([
                import("@/ark-scene/record-clock"),
                import("@/components/ask-animaldex/voice-call/talking-model-renderer"),
                loadTalkingModelManifest()
            ]);
            const asset = talkingModelAsset(manifest, slug);
            if (!asset || !containerRef.current) {
                setState("failed");
                return;
            }
            if (withScene) setScene(await talkingModelSceneUrl(slug));
            const loaded = await renderer.loadTalkingModel(asset);
            if (disposed || !containerRef.current) return;
            const clock = installRecordClock(window);
            const stage = await renderer.createTalkingStage(containerRef.current, loaded, {
                decibels: () => lineLevel(text, clock.elapsed() / 1000),
                ambientOcclusion: "high"
            });
            dispose = () => stage.dispose();
            const canvas = () => containerRef.current?.querySelector("canvas") ?? null;
            (window as unknown as {__landingTalk?: unknown}).__landingTalk = {
                frame: (quality = 0.92) => {
                    clock.tick(1000 / 30);
                    return canvas()?.toDataURL("image/png", quality) ?? "";
                },
                seconds: () => clock.elapsed() / 1000
            };
            clock.tick(0);
            setState("ready");
        })().catch((error) => {
            console.warn("[landing-talk]", error);
            setState("failed");
        });
        return () => {
            disposed = true;
            dispose?.();
        };
    }, [slug, text, withScene]);

    return (
        <div data-landing-talk={state} style={{position: "fixed", inset: 0, zIndex: 2147483000, background: withScene ? "#0b1a10" : "transparent"}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {scene ? <img src={scene} alt="" style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"}} /> : null}
            <div ref={containerRef} style={{position: "absolute", inset: 0}} />
        </div>
    );
}
