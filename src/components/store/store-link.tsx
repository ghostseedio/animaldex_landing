"use client";

import type {AnchorHTMLAttributes, ReactNode} from "react";
import {usePathname} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import {
    buildStoreUrl,
    referringShareReferral,
    referringStorePlacement,
    rememberStorePlacement,
    storeLinkPage,
    type AppStoreName,
    type StorePlacement
} from "@/lib/store-links";

type StoreLinkProps = {
    store: AppStoreName;
    placement: StorePlacement;
    /** The button, for Play's `utm_content` and the click event: `badge`, `text_link`, `tierlist_<slug>`... */
    button?: string;
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

/**
 * A link to the App Store or Google Play that says where on the site it was
 * clicked (`buildStoreUrl`): the surface, the page and the button are in the
 * store URL, and the click is `store_link_clicked` with `ui_source` and the
 * page path. A fixed `utmContent` names the button ("tierlist_<slug>",
 * "ask_limit"); a hand-off id rides the Play install referrer.
 */
export default function StoreLink({store, placement, button = "link", inheritPlacement = false, utmContent = null, uiSource = null, handoff = null, onClick, children, ...props}: StoreLinkProps) {
    const page = storeLinkPage(usePathname());
    const named = utmContent?.trim() || button;
    return (
        <a
            {...props}
            href={buildStoreUrl({store, surface: placement, page, button: named, handoff})}
            onClick={(event) => {
                onClick?.(event);
                const effective = (inheritPlacement ? referringStorePlacement() : null) ?? placement;
                // A shared link's `?ref=`, kept for the tab: Play carries it to the app.
                const href = buildStoreUrl({store, surface: effective, page, button: named, referral: referringShareReferral(), handoff});
                if (event.currentTarget.href !== href) event.currentTarget.href = href;
                trackEvent("store_link_clicked", {
                    ...storeLinkClickedParameters({store, placement, effective, uiSource, pagePath: page}),
                    page,
                    button: named
                });
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
