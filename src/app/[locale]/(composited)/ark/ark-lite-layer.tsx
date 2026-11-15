"use client";

import {useEffect, useRef} from "react";
import type {ArkSnapshot} from "@/ark-scene/types";
import type {ArkLiteHandle} from "@/ark-scene/lite/lite-view";
import type {ArkFounders} from "@/lib/ark-founders";
import type {ArkWords} from "@/lib/ark-words";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import {ARK_POSTER} from "@/lib/ark-poster";

/**
 * Ark Lite on /ark (decisions 358 and 359, `lib/ark-lite.ts`): the same page as the apps' embed
 * (`ark-scene/lite/lite-view.ts`), over the world, with its own "Latest on the Ark" from the server's record and who
 * brought each animal (the founders read). Its code is fetched only when shown.
 */
export default function ArkLiteLayer({snapshot, hearts, words, locale, linkLocale, talk, ready3d, onOpen3d, eventsUrl, founders}: {
    snapshot: ArkSnapshot | null;
    hearts: Record<string, number> | null;
    words: ArkWords;
    locale: string;
    linkLocale: string | null;
    talk: {a: string; an: string};
    ready3d: boolean;
    onOpen3d: () => void;
    eventsUrl: string | null;
    founders: ArkFounders;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const liteRef = useRef<ArkLiteHandle | null>(null);
    const latest = useRef({snapshot, hearts, words, locale, ready3d, onOpen3d, founders});
    latest.current = {snapshot, hearts, words, locale, ready3d, onOpen3d, founders};

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        let disposed = false;
        void import("@/ark-scene/lite/lite-view").then(({mountArkLite}) => {
            if (disposed) return;
            const now = latest.current;
            const lite = mountArkLite(host, {
                words: now.words as unknown as Record<string, unknown>,
                locale: now.locale,
                iconUrl: arkIconUrl,
                posterUrl: ARK_POSTER.tall,
                linkLocale,
                talk,
                eventsUrl,
                onOpen3d: () => latest.current.onOpen3d()
            });
            liteRef.current = lite;
            lite.setFounders(now.founders);
            if (now.snapshot) lite.update(now.snapshot);
            lite.setHearts(now.hearts);
            lite.set3dReady(now.ready3d);
        });
        return () => {
            disposed = true;
            liteRef.current?.dispose();
            liteRef.current = null;
        };
        // Mounted once; later changes go through the handle below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (snapshot) liteRef.current?.update(snapshot);
    }, [snapshot]);
    useEffect(() => liteRef.current?.setFounders(founders), [founders]);
    useEffect(() => liteRef.current?.setHearts(hearts), [hearts]);
    useEffect(() => liteRef.current?.set3dReady(ready3d), [ready3d]);

    return <div ref={hostRef} className="absolute inset-0 z-[3]" />;
}
