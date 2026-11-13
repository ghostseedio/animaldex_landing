"use client";

import {useEffect, useState} from "react";
import StoreLink from "@/components/store/store-link";
import {detectStorePlatform, orderedStores, type AppStoreName, type StorePlacement} from "@/lib/store-links";

type InstallButtonsProps = {
    placement: StorePlacement;
    /** A fixed `utm_content` on both store links ("tierlist_strongest-animals"). */
    utmContent: string;
    /** GA4 `ui_source` of the click ("tierlist"). */
    uiSource: string;
    title: string;
    body?: string | null;
    labels: {appStore: string; googlePlay: string};
    /** Where on the page this block is, for GA (`position`): "top" or "after_first". */
    position?: string;
    className?: string;
};

const STORE_LABEL: Record<AppStoreName, keyof InstallButtonsProps["labels"]> = {
    app_store: "appStore",
    google_play: "googlePlay"
};

/**
 * Both store buttons, square, the reader's own store first and filled once
 * the browser has said which it is (after hydration: the pages this sits on
 * are static). On a desktop both stay equal.
 */
export default function InstallButtons({placement, utmContent, uiSource, title, body = null, labels, position = "top", className = ""}: InstallButtonsProps) {
    const [platform, setPlatform] = useState<AppStoreName | null>(null);
    useEffect(() => {
        setPlatform(detectStorePlatform(navigator.userAgent, navigator.maxTouchPoints));
    }, []);
    const stores = orderedStores(platform);
    return (
        <section
            aria-label={title}
            data-install-buttons={position}
            className={`border border-white/10 light:border-line-200 bg-surface-900/60 light:bg-surface-900 p-4 md:p-5 ${className}`}
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <p className="font-display text-xl font-bold leading-tight text-white md:text-2xl">{title}</p>
                    {body ? <p className="mt-1 text-sm leading-6 text-ink-300">{body}</p> : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    {stores.map((store, index) => {
                        const primary = platform ? index === 0 : true;
                        return (
                            <StoreLink
                                key={store}
                                store={store}
                                placement={placement}
                                utmContent={utmContent}
                                uiSource={uiSource}
                                data-position={position}
                                className={primary
                                    ? "inline-flex min-h-12 items-center justify-center bg-primary-400 px-6 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500"
                                    : "inline-flex min-h-12 items-center justify-center border border-white/20 light:border-line-300 px-6 text-sm font-bold text-white transition-colors hover:border-primary-300/60 hover:text-primary-100"}
                            >
                                {labels[STORE_LABEL[store]]}
                            </StoreLink>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
