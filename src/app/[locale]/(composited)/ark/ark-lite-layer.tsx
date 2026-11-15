"use client";

import {useEffect, useRef} from "react";
import type {ArkSnapshot} from "@/ark-scene/types";
import type {ArkLiteHandle} from "@/ark-scene/lite/lite-view";
import type {ArkLiveHud} from "@/ark-scene/live";
import type {ArkWords} from "@/lib/ark-words";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import {ARK_POSTER} from "@/lib/ark-poster";

/**
 * Ark Lite on /ark (decision 358, `lib/ark-lite.ts`): the same page as the apps' embed (`ark-scene/lite/lite-view.ts`),
 * over the world, with its own live log (the server's record, no scene behind it). Its code is fetched only when shown.
 */
export default function ArkLiteLayer({snapshot, hearts, words, locale, linkLocale, talk, ready3d, onOpen3d, eventsUrl}: {
    snapshot: ArkSnapshot | null;
    hearts: Record<string, number> | null;
    words: ArkWords;
    locale: string;
    linkLocale: string | null;
    talk: {a: string; an: string};
    ready3d: boolean;
    onOpen3d: () => void;
    eventsUrl: string | null;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const liteRef = useRef<ArkLiteHandle | null>(null);
    const hudRef = useRef<ArkLiveHud | null>(null);
    const latest = useRef({snapshot, hearts, words, locale, ready3d, onOpen3d});
    latest.current = {snapshot, hearts, words, locale, ready3d, onOpen3d};

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        let disposed = false;
        void Promise.all([import("@/ark-scene/lite/lite-view"), import("@/ark-scene/live")]).then(([{mountArkLite}, {mountArkLiveHud}]) => {
            if (disposed) return;
            const now = latest.current;
            const lite = mountArkLite(host, {
                words: now.words as unknown as Record<string, unknown>,
                locale: now.locale,
                iconUrl: arkIconUrl,
                posterUrl: ARK_POSTER.tall,
                linkLocale,
                talk,
                onOpen3d: () => latest.current.onOpen3d()
            });
            liteRef.current = lite;
            if (now.snapshot) lite.update(now.snapshot);
            lite.setHearts(now.hearts);
            lite.set3dReady(now.ready3d);
            const hud = mountArkLiveHud(lite.root, {
                scene: () => null,
                words: now.words as unknown as Parameters<typeof mountArkLiveHud>[1]["words"],
                locale: now.locale,
                eventsUrl,
                iconUrl: arkIconUrl,
                log: true,
                bars: false,
                reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
            });
            hudRef.current = hud;
            if (now.snapshot) hud.snapshot(now.snapshot);
        });
        return () => {
            disposed = true;
            hudRef.current?.dispose();
            liteRef.current?.dispose();
            hudRef.current = null;
            liteRef.current = null;
        };
        // Mounted once; later changes go through the handles below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!snapshot) return;
        liteRef.current?.update(snapshot);
        hudRef.current?.snapshot(snapshot);
    }, [snapshot]);
    useEffect(() => liteRef.current?.setHearts(hearts), [hearts]);
    useEffect(() => liteRef.current?.set3dReady(ready3d), [ready3d]);

    return <div ref={hostRef} className="absolute inset-0 z-[3]" />;
}
