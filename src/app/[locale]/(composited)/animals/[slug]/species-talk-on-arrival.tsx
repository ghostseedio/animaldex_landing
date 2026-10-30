"use client";

import {useEffect, useRef} from "react";
import {useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";

/**
 * `?talk=1` on a species page opens the animal's chat as the page loads: the
 * home page's and the signed-out web app's "Try talking to one now" (newcomer
 * UX vet, 2026-10-30). Anyone can talk to it here, signed in or not.
 *
 * The page is static, so the address is read in the browser. The parameter is
 * taken off the address once used, so reloading or sharing the page doesn't
 * open the chat again. Rendered after the page's `AskSubjectBridge`, so the
 * chat opens on this animal.
 */
export default function SpeciesTalkOnArrival() {
    const {open} = useAskAnimalDex();
    const done = useRef(false);

    useEffect(() => {
        if (done.current) return;
        done.current = true;
        const url = new URL(window.location.href);
        if (url.searchParams.get("talk") !== "1") return;
        url.searchParams.delete("talk");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        open();
    }, [open]);

    return null;
}
