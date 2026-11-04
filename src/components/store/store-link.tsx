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
    children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;

/** A link to the App Store or Google Play that says where on the site it was clicked. */
export default function StoreLink({store, placement, inheritPlacement = false, onClick, children, ...props}: StoreLinkProps) {
    return (
        <a
            {...props}
            href={storeHref(store, placement)}
            onClick={(event) => {
                onClick?.(event);
                const effective = (inheritPlacement ? referringStorePlacement() : null) ?? placement;
                // A shared link's `?ref=`, kept for the tab, and the page itself: Play carries both to the app.
                const href = storeHref(store, effective, referringShareReferral(), window.location.pathname);
                if (event.currentTarget.href !== href) event.currentTarget.href = href;
                trackEvent("store_link_clicked", {
                    store,
                    placement: effective,
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
