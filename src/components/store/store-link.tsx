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
    children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;

/**
 * A link to the App Store or Google Play that says where on the site it was
 * clicked (`buildStoreUrl`): the surface, the page and the button are in the
 * store URL, and the click is `store_link_clicked` with `ui_source` (the
 * surface) and the page path.
 */
export default function StoreLink({store, placement, button = "link", inheritPlacement = false, onClick, children, ...props}: StoreLinkProps) {
    const page = storeLinkPage(usePathname());
    return (
        <a
            {...props}
            href={buildStoreUrl({store, surface: placement, page, button})}
            onClick={(event) => {
                onClick?.(event);
                const effective = (inheritPlacement ? referringStorePlacement() : null) ?? placement;
                // A shared link's `?ref=`, kept for the tab: Play carries it to the app.
                const href = buildStoreUrl({store, surface: effective, page, button, referral: referringShareReferral()});
                if (event.currentTarget.href !== href) event.currentTarget.href = href;
                // `source` is sent as `ui_source` (lib/analytics renames it, so GA never reads it as traffic source).
                trackEvent("store_link_clicked", {
                    store,
                    placement: effective,
                    source: effective,
                    page,
                    button,
                    ...(effective !== placement ? {via: placement} : {})
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
