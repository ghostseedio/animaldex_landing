"use client";

import Script from "next/script";
import {Suspense, useEffect, useState} from "react";
import {analyticsGate, hasSupabaseSessionCookie} from "@/lib/analytics-bot-gate";
import GoogleAnalyticsRouteTracker from "@/components/analytics/google-analytics-route-tracker";

// Loads the GA tag only for visits that pass the bot gate
// (src/lib/analytics-bot-gate.ts). It runs in the browser because the layout
// it sits in is static: reading headers on the server would make every public
// page dynamic. Until the effect has run nothing is loaded, so a crawler that
// never runs JavaScript (most of them) gets no tag either, as before.

export default function GoogleAnalyticsLoader({measurementId}: {measurementId: string}) {
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        let verdict = {load: true};
        try {
            verdict = analyticsGate({
                userAgent: navigator.userAgent,
                webdriver: navigator.webdriver === true,
                pathname: window.location.pathname,
                referrer: document.referrer,
                hasSession: hasSupabaseSessionCookie(document.cookie)
            });
        } catch {
            // A browser that throws on any of these is still a browser: measure it.
        }
        if (verdict.load) setAllowed(true);
    }, []);

    if (!allowed) return null;

    return (
        <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="lazyOnload" />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', '${measurementId}', {
                        send_page_view: true
                    });
                `}
            </Script>
            <Suspense fallback={null}>
                <GoogleAnalyticsRouteTracker />
            </Suspense>
        </>
    );
}
