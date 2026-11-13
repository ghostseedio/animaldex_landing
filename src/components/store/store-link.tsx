"use client";

import type {AnchorHTMLAttributes, ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import {
    referringShareReferral,
    referringStorePlacement,
    rememberStorePlacement,
    storeHref,
    type AppStoreName,
    type StoreLinkOptions,
    type StorePlacement
} from "@/lib/store-links";

type StoreLinkProps = {
    store: AppStoreName;
    placement: StorePlacement;
    /**
     * The home page's download section: credit the page that sent the reader
     * there (a "Get the app" link elsewhere), when there is one.
     */
    inheritPlacement?: boolean;
    /** A fixed `utm_content` ("tierlist_<slug>", "ask_limit") instead of the page path (CC 2). */
    utmContent?: string | null;
    /** GA4 `ui_source` on the click ("tierlist", "ask_limit"); the placement when unset. */
    uiSource?: string | null;
    /** A web Ask hand-off id, carried in the Play install referrer (lib/ask-handoff). */
    handoff?: string | null;
    children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;

/**
 * GA4 parameters of one store tap. `ui_source` is the parameter name (never
 * `source`, which GA4 reads as traffic attribution: analytics.ts), and the
 * page path goes along so a report can name the page the tap came from.
 */
export function storeLinkClickedParameters(input: {
    store: AppStoreName;
    placement: StorePlacement;
    effective: StorePlacement;
    uiSource?: string | null;
    pagePath: string;
}) {
    return {
        store: input.store,
        placement: input.effective,
        ...(input.effective !== input.placement ? {via: input.placement} : {}),
        ui_source: input.uiSource?.trim() || input.effective,
        page_path: input.pagePath.slice(0, 300)
    };
}

/** A link to the App Store or Google Play that says where on the site it was clicked. */
export default function StoreLink({store, placement, inheritPlacement = false, utmContent = null, uiSource = null, handoff = null, onClick, children, ...props}: StoreLinkProps) {
    const options: StoreLinkOptions = {content: utmContent, handoff};
    return (
        <a
            {...props}
            href={storeHref(store, placement, null, null, options)}
            onClick={(event) => {
                onClick?.(event);
                const effective = (inheritPlacement ? referringStorePlacement() : null) ?? placement;
                // A shared link's `?ref=`, kept for the tab, and the page itself: Play carries both to the app.
                const href = storeHref(store, effective, referringShareReferral(), window.location.pathname, options);
                if (event.currentTarget.href !== href) event.currentTarget.href = href;
                trackEvent("store_link_clicked", storeLinkClickedParameters({
                    store,
                    placement,
                    effective,
                    uiSource,
                    pagePath: window.location.pathname
                }));
            }}
        >
            {children}
        </a>
    );
}

/** "Get the app" that goes to the home page's download section, remembering where it was clicked. */
export function AppDownloadLink({placement, className, children}: {
    placement: StorePlacement;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Link href="/#download" className={className} onClick={() => rememberStorePlacement(placement)}>
            {children}
        </Link>
    );
}
