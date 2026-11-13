"use client";

/**
 * The limit moment as the install moment (CC 2, Nov 2026). When today's
 * messages are spent (`species_ask_limit_reached`), the conversation shows
 * this one panel with two actions:
 *
 *   - "Keep talking in the app, free": the store for this phone (the App
 *     Store on iPhone and iPad, Google Play on Android, the App Store with a
 *     Play link beside it on a desktop), with `utm_content=ask_limit`. The
 *     last three turns are kept server-side as a hand-off (lib/ask-handoff,
 *     /api/ask/handoff) whose id rides in the Play install referrer, in the
 *     deep link (animaldex://talk?species=…&handoff=…) under the button for
 *     someone who already has the app, and in the https twin on
 *     animaldex.app/talk/<slug>, for the apps to redeem later.
 *   - "Pro for a week": the web Pro checkout (Paddle), the yearly price when
 *     it is configured, else the monthly; signed out it goes through sign-in
 *     to the Pro page; with no price configured it goes to /checkout.
 *
 * Square, as everything in the chat is.
 */

import {useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import StoreLink from "@/components/store/store-link";
import {trackEvent} from "@/lib/analytics";
import {
    ASK_HANDOFF_ENDPOINT,
    askHandoffLinks,
    askHandoffRequestBody,
    askLimitProAction,
    isAskHandoffId,
    type AskLimitProPlan
} from "@/lib/ask-handoff";
import type {AskMessage} from "@/lib/ask-animaldex/thread";
import {detectStorePlatform, type AppStoreName} from "@/lib/store-links";
import {trackFunnel} from "@/lib/web-funnel-client";

export type AskLimitPanelLabels = {
    limitTitle: string;
    limitPanelBody: string;
    limitAppFree: string;
    limitProWeek: string;
    limitProNote: string;
    limitOpenApp: string;
    limitHandoffNote: string;
};

type AskLimitPanelProps = {
    slug: string | null;
    speciesProfileId: string | null;
    messages: ReadonlyArray<AskMessage>;
    signedIn: boolean;
    /** From /api/ask/context: which Pro plan the website can sell, if any. */
    webProPlan: AskLimitProPlan | null | undefined;
    labels: AskLimitPanelLabels;
    /** The existing limit-step funnel event (`species_ask_collect_clicked`), with the step's name. */
    onStep: (source: string) => void;
};

const STORE_NAME: Record<AppStoreName, string> = {app_store: "App Store", google_play: "Google Play"};

export default function AskLimitPanel({slug, speciesProfileId, messages, signedIn, webProPlan, labels, onStep}: AskLimitPanelProps) {
    const [platform, setPlatform] = useState<AppStoreName | null>(null);
    const [handoffId, setHandoffId] = useState<string | null>(null);
    const [proBusy, setProBusy] = useState(false);
    const [proError, setProError] = useState<string | null>(null);
    const requested = useRef<string | null>(null);

    useEffect(() => {
        setPlatform(detectStorePlatform(navigator.userAgent, navigator.maxTouchPoints));
    }, []);

    // One hand-off per limit moment per animal: kept as soon as the panel shows,
    // so the id is on the links before the tap. Without one the links still
    // name the species, and the store opens all the same.
    useEffect(() => {
        if (!slug || requested.current === slug || navigator.webdriver) return;
        requested.current = slug;
        const body = JSON.stringify(askHandoffRequestBody({slug, speciesProfileId, messages, path: window.location.pathname}));
        fetch(ASK_HANDOFF_ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json"}, body, keepalive: true})
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {id?: unknown} | null) => {
                if (payload && isAskHandoffId(payload.id)) setHandoffId(payload.id);
            })
            .catch(() => undefined);
        // The turns are read once, when the limit comes up.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, speciesProfileId]);

    const primaryStore: AppStoreName = platform ?? "app_store";
    const links = slug ? askHandoffLinks({slug, handoffId}) : null;
    const proAction = askLimitProAction({plan: webProPlan, signedIn});

    const onStoreTap = (store: AppStoreName) => {
        onStep("limit_panel_app");
        trackFunnel("store_click_ask_limit");
        trackEvent("ask_limit_handoff", {species_slug: slug ?? "", store, has_handoff: Boolean(handoffId)});
    };

    const startPro = async () => {
        onStep("limit_panel_pro");
        if (proAction.kind !== "checkout") return;
        setProBusy(true);
        setProError(null);
        try {
            const {startWebCheckout} = await import("@/lib/web-checkout-client");
            await startWebCheckout(proAction.plan, "/app/credits", "ask_limit");
        } catch (error) {
            setProError(error instanceof Error && error.message ? error.message : "Checkout could not start.");
        } finally {
            setProBusy(false);
        }
    };

    const proButtonClass = "inline-flex min-h-11 w-full items-center justify-center border border-white/20 px-4 text-sm font-bold text-white transition-colors hover:border-primary-300/60 hover:text-primary-100 disabled:opacity-50 sm:w-auto";

    return (
        <div data-ask-limit-panel="" className="text-left">
            <p className="text-sm font-semibold text-white">{labels.limitTitle}</p>
            <p className="mt-1.5 text-sm leading-6 text-ink-100">{labels.limitPanelBody}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <StoreLink
                    store={primaryStore}
                    placement="ask_limit"
                    utmContent="ask_limit"
                    uiSource="ask_limit"
                    handoff={handoffId}
                    data-ask-limit-action="app"
                    onClick={() => onStoreTap(primaryStore)}
                    className="inline-flex min-h-11 w-full items-center justify-center bg-primary-400 px-4 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500 sm:w-auto"
                >
                    {labels.limitAppFree}
                </StoreLink>
                {proAction.kind === "checkout" ? (
                    <button type="button" disabled={proBusy} onClick={() => void startPro()} data-ask-limit-action="pro" className={proButtonClass}>
                        {labels.limitProWeek}
                    </button>
                ) : (
                    <Link href={proAction.href} onClick={() => void startPro()} data-ask-limit-action="pro" className={proButtonClass}>
                        {labels.limitProWeek}
                    </Link>
                )}
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-300">{labels.limitProNote}</p>
            {platform === null ? (
                // A desktop: the other store, as text, so the button stays one action.
                <p className="mt-1 text-xs text-ink-400">
                    <StoreLink
                        store="google_play"
                        placement="ask_limit"
                        utmContent="ask_limit"
                        uiSource="ask_limit"
                        handoff={handoffId}
                        onClick={() => onStoreTap("google_play")}
                        className="underline-offset-2 hover:text-primary-100 hover:underline"
                    >
                        {STORE_NAME.google_play}
                    </StoreLink>
                </p>
            ) : null}
            {links ? (
                <p className="mt-2 text-xs leading-5 text-ink-400">
                    <a
                        href={links.deepLink}
                        data-web-link={links.webLink}
                        onClick={() => onStep("limit_panel_open_app")}
                        className="font-semibold text-primary-200 underline-offset-2 hover:text-primary-100 hover:underline"
                    >
                        {labels.limitOpenApp}
                    </a>
                    {handoffId ? <span> · {labels.limitHandoffNote}</span> : null}
                </p>
            ) : null}
            {proError ? <p className="mt-2 text-xs text-red-300" role="alert">{proError}</p> : null}
        </div>
    );
}
