"use client";

import {useRouter} from "next/navigation";

/**
 * The Collection could not be read (iOS `retryCard`, d428026e): the paw, the
 * reason in plain words (UserFacingError, never a table name, JRN-22) and
 * Retry. Never shown as an empty collection.
 */
export default function CollectionRetry({title, message, retryLabel}: {title: string; message: string; retryLabel: string}) {
    const router = useRouter();
    return (
        <section className="relative overflow-hidden border-y border-white/[0.08] bg-[#121212] px-5 py-8" role="alert" data-testid="collection-retry">
            <span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-4 select-none text-[7rem] leading-none text-white/[0.04]">🐾</span>
            <h2 className="font-display text-2xl font-black text-white">{title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">{message}</p>
            <button
                type="button"
                onClick={() => router.refresh()}
                className="mt-5 inline-flex min-h-12 w-full max-w-sm items-center justify-center bg-primary-400 px-6 text-base font-black text-black/90"
            >
                {retryLabel}
            </button>
        </section>
    );
}
