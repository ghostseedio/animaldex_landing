/* eslint-disable @next/next/no-img-element -- the species icon is a small API image, like the feed's avatars */
import Link from "@/app/[locale]/_components/link";
import PostSpeakButton from "@/app/[locale]/p/[postId]/post-speak-button";
import StoreLink from "@/components/store/store-link";
import type {DiscoverPostAnimal} from "@/lib/discover-post";
import {storeLinks} from "@/lib/store-links";

/**
 * What a shared post offers somebody who arrived from a link: the app, and
 * when the post is about one animal, its species page and a conversation with
 * it. A band above the feed on phones, a panel beside it on desktop. Both are
 * about the post that was shared, whichever post is on screen.
 */

export type PostShareLabels = {
    sharedFrom: string;
    appLine: string;
    /** "Speak to the {animal}", already filled in. */
    speak: string;
    /** "More about the {animal}", already filled in. */
    moreAbout: string;
    /** Phones have room for less: "Get AnimalDex" beside the store buttons… */
    getApp: string;
    /** …and "Field Guide" beside "Speak to the …". */
    fieldGuide: string;
};

type PostShareCtaProps = {
    labels: PostShareLabels;
    animal: (DiscoverPostAnimal & {avatarUrl: string}) | null;
};

function StoreGlyph({store, className}: {store: "app_store" | "google_play"; className: string}) {
    if (store === "app_store") {
        return (
            <svg aria-hidden="true" viewBox="0 0 32 32" className={`${className} fill-current`}>
                <path d="M21.8 4.2c.1 1.4-.4 2.8-1.3 3.8-.9 1.1-2.4 1.9-3.8 1.8-.2-1.3.4-2.8 1.2-3.7.9-1.1 2.5-1.9 3.9-1.9Zm4.7 19.2c-.6 1.4-.9 2.1-1.7 3.3-1.1 1.7-2.7 3.8-4.7 3.8-1.8 0-2.2-1.1-4.6-1.1s-2.9 1.1-4.6 1.2c-2 0-3.5-1.9-4.7-3.6-3.2-4.9-3.6-10.6-1.6-13.7 1.4-2.2 3.6-3.4 5.7-3.4 2.1 0 3.5 1.2 5.3 1.2 1.7 0 2.8-1.2 5.3-1.2 1.9 0 3.9 1 5.3 2.8-4.7 2.6-3.9 9.3.3 10.7Z" />
            </svg>
        );
    }
    return (
        <svg aria-hidden="true" viewBox="0 0 42 42" className={`${className} fill-current`}>
            <path fillRule="evenodd" clipRule="evenodd" d="M21.5435 24.9506C20.8295 24.234 19.6675 24.234 18.9547 24.9506C17.0825 26.8266 5.34416 38.5968 3.76343 40.1699C5.59743 42.1248 8.91926 42.5982 11.2471 41.1779L28.1031 31.5178C26.5478 29.9677 23.1204 26.5326 21.5435 24.9506Z" />
            <path fillRule="evenodd" clipRule="evenodd" d="M18.9544 17.1818C19.6684 17.8983 20.8291 17.8983 21.5431 17.1818L25.4797 13.2363L25.4759 13.2338L28.155 10.5572L11.3129 0.859026C8.93803 -0.627523 5.51693 -0.11843 3.67529 1.87466C5.21911 3.40958 17.114 15.3401 18.9544 17.1818Z" />
            <path fillRule="evenodd" clipRule="evenodd" d="M16.3722 22.3631C17.0874 21.6453 17.0874 20.4846 16.3722 19.7668L5.82886 9.19418L2.04249 5.4129C2.01576 5.63436 1.99667 5.8749 2.00049 6.10909L2.00303 35.9533C2.01194 36.2333 2.05267 36.5592 2.09594 36.8404C4.58922 34.3993 13.7656 25.0193 16.3722 22.3631Z" />
            <path fillRule="evenodd" clipRule="evenodd" d="M37.0414 15.6736L31.4388 12.4473C29.797 14.0764 25.8045 18.0906 24.127 19.7693C23.4105 20.4871 23.4105 21.6478 24.127 22.3657C25.8146 24.0457 29.7385 27.9988 31.3905 29.6368L36.9892 26.4295C41.2223 24.3295 41.2541 17.8105 37.0414 15.6736Z" />
        </svg>
    );
}

function StoreButtons({compact}: {compact: boolean}) {
    return (
        <>
            {storeLinks.map((link) => (
                <StoreLink
                    key={link.store}
                    store={link.store}
                    placement="post"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                        compact
                            ? "flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 text-xs font-bold text-white transition-colors hover:border-primary-300/60"
                            : "flex h-10 items-center justify-center gap-2 border border-white/15 bg-white/[0.04] px-3 text-sm font-bold text-white transition-colors hover:border-primary-300/60 hover:bg-white/[0.07]"
                    }
                >
                    <StoreGlyph store={link.store} className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    {link.name}
                </StoreLink>
            ))}
        </>
    );
}

function AnimalIcon({src, size}: {src: string; size: "sm" | "md"}) {
    return (
        <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className={`${size === "sm" ? "h-6 w-6" : "h-7 w-7"} shrink-0 rounded-full border border-white/15 bg-white/[0.06] object-cover`}
        />
    );
}

/** Phones: under the feed's top bar. */
export function PostShareBand({labels, animal}: PostShareCtaProps) {
    return (
        <div className="shrink-0 border-b border-white/[0.07] bg-[#0b0d0c] px-4 py-2.5 lg:hidden">
            <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-bold text-primary-200">{labels.getApp}</p>
                <div className="flex shrink-0 gap-1.5">
                    <StoreButtons compact />
                </div>
            </div>
            {animal ? (
                <div className="mt-2 flex items-center gap-2">
                    <PostSpeakButton className="flex min-w-0 items-center gap-2 rounded-full border border-primary-300/30 bg-primary-400/[0.08] py-1 pl-1 pr-3 text-xs font-bold text-white transition-colors hover:border-primary-300/60">
                        <AnimalIcon src={animal.avatarUrl} size="sm" />
                        <span className="truncate">{labels.speak}</span>
                    </PostSpeakButton>
                    <Link
                        href={animal.href}
                        aria-label={labels.moreAbout}
                        className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:text-white"
                    >
                        {labels.fieldGuide}
                        <span aria-hidden="true">›</span>
                    </Link>
                </div>
            ) : null}
        </div>
    );
}

/** Desktop: the top of the column beside the feed. */
export function PostSharePanel({labels, animal}: PostShareCtaProps) {
    return (
        <section className="shrink-0 border border-white/[0.08] bg-[#121212]/90 p-4 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)]">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-primary-200/85">{labels.sharedFrom}</p>
            <p className="mt-2 text-sm leading-6 text-white/65">{labels.appLine}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
                <StoreButtons compact={false} />
            </div>
            {animal ? (
                <div className="mt-4 border-t border-white/[0.06] pt-2">
                    <PostSpeakButton className="flex w-full items-center gap-3 py-2 text-left text-sm font-bold text-white transition-colors hover:text-primary-200">
                        <AnimalIcon src={animal.avatarUrl} size="md" />
                        <span className="min-w-0 flex-1">{labels.speak}</span>
                        <span aria-hidden="true" className="text-white/40">›</span>
                    </PostSpeakButton>
                    <Link
                        href={animal.href}
                        className="flex w-full items-center gap-3 py-2 text-sm font-semibold text-white/75 transition-colors hover:text-white"
                    >
                        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-primary-200">
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 4.5c2.5-1 4.5-.8 7 .8 2.5-1.6 4.5-1.8 7-.8v11c-2.5-1-4.5-.8-7 .8-2.5-1.6-4.5-1.8-7-.8v-11Z" />
                                <path d="M10 5.3v11" />
                            </svg>
                        </span>
                        <span className="min-w-0 flex-1">{labels.moreAbout}</span>
                        <span aria-hidden="true" className="text-white/40">›</span>
                    </Link>
                </div>
            ) : null}
        </section>
    );
}
