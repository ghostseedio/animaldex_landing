"use client";

/**
 * The hero test's client half (lib/hero-variant). On a full page load the
 * inline boot script has already marked <html> with the variant; a client
 * navigation to the home page runs no inline script, so the same rule runs
 * here before the paint. Then: a newly drawn variant is kept in the
 * first-touch cookie, a `?hero=` view is marked as QA, and the view is
 * counted (`hero_view`).
 */

import {useEffect, useLayoutEffect} from "react";
import {
    HERO_VARIANT_ATTRIBUTE,
    resolveHeroAssignment,
    shownHeroVariant,
    type HeroAssignment
} from "@/lib/hero-variant";
import {keepHeroAssignment, markHeroQaSession, trackFunnel} from "@/lib/web-funnel-client";

/** Before the paint in the browser; a plain effect on the server, where there is none. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

declare global {
    interface Window {
        /** The boot script's result (lib/hero-variant HERO_BOOT_GLOBAL). */
        __adxHero?: HeroAssignment;
    }
}

export default function HeroVariantGate({splitB}: {splitB: number}) {
    useIsomorphicLayoutEffect(() => {
        const booted = window.__adxHero;
        // Read once: a later client navigation back here reads the cookie the first view wrote.
        delete window.__adxHero;
        const assignment = booted ?? resolveHeroAssignment({
            search: window.location.search,
            cookie: document.cookie,
            splitB,
            random: Math.random()
        });
        document.documentElement.setAttribute(HERO_VARIANT_ATTRIBUTE, shownHeroVariant(assignment));
        if (assignment.override) {
            markHeroQaSession();
            return;
        }
        keepHeroAssignment(assignment.variant);
        trackFunnel("hero_view");
    }, [splitB]);
    return null;
}
