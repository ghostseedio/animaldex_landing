import Script from "next/script";
import {Suspense} from "react";
import {GA_MEASUREMENT_ID, isGoogleAnalyticsEnabled} from "@/lib/analytics";
import GoogleAnalyticsRouteTracker from "@/components/analytics/google-analytics-route-tracker";

export default function GoogleAnalytics() {
    if (!isGoogleAnalyticsEnabled()) {
        return null;
    }

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', {
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
