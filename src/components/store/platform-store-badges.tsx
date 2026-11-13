"use client";

import {useEffect, useState} from "react";
import StoreLink from "@/components/store/store-link";
import {otherStore, storePlatformFromUserAgent} from "@/lib/store-platform";
import type {AppStoreName, StorePlacement} from "@/lib/store-links";

export type PlatformStoreBadgeWords = {
    appStore: string;
    googlePlay: string;
    /** The text link to the other store once the device's own is known: "Also on Google Play". */
    alsoAppStore: string;
    alsoGooglePlay: string;
};

type Props = {
    locale: string;
    placement: StorePlacement;
    inheritPlacement?: boolean;
    /** The folder of the official badges (`badge-app-store.svg`, `badge-google-play-<en|id>.png`). */
    art: string;
    words: PlatformStoreBadgeWords;
};

const badgeClass = "block rounded-[9px] transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300";

/**
 * The official store badges (Apple's and Google's own artwork). The server
 * renders both; after hydration the visitor's own store (from the user agent)
 * leads and the other becomes a text link, so a phone sees one button. A
 * desktop, or an unknown device, keeps both badges.
 */
export default function PlatformStoreBadges({locale, placement, inheritPlacement = false, art, words}: Props) {
    const [platform, setPlatform] = useState<AppStoreName | null>(null);
    useEffect(() => {
        setPlatform(storePlatformFromUserAgent(navigator.userAgent, navigator.maxTouchPoints));
    }, []);

    const badge = (store: AppStoreName) => (
        <StoreLink key={store} store={store} placement={placement} button="badge" inheritPlacement={inheritPlacement} target="_blank" rel="noopener noreferrer" aria-label={store === "app_store" ? words.appStore : words.googlePlay} className={badgeClass}>
            {store === "app_store" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${art}/badge-app-store.svg`} alt="" width={132} height={44} className="h-11 w-auto" />
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${art}/badge-google-play-${locale === "id" ? "id" : "en"}.png`} alt="" width={148} height={44} className="h-11 w-auto" />
            )}
        </StoreLink>
    );

    if (!platform) {
        return <div className="flex flex-wrap items-center gap-3">{badge("app_store")}{badge("google_play")}</div>;
    }
    const other = otherStore(platform);
    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {badge(platform)}
            <StoreLink store={other} placement={placement} button="text_link" inheritPlacement={inheritPlacement} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold text-white underline decoration-white/40 underline-offset-[6px] transition-colors hover:decoration-primary-400">
                {other === "app_store" ? words.alsoAppStore : words.alsoGooglePlay}
            </StoreLink>
        </div>
    );
}
