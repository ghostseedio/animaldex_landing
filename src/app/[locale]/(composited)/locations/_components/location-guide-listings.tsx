"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import GuideCard from "@/components/guides/guide-card";
import type {PublicGuideListing} from "@/lib/guide-marketplace-core";

type State =
    | {status: "loading"}
    | {status: "ready"; listings: PublicGuideListing[]}
    | {status: "error"};

type Labels = {
    checking: string;
    found: string;
    none: string;
    unavailable: string;
    browseAll: string;
};

/**
 * Location pages are static and never revalidate, so live Guide inventory is read at
 * view time. The server HTML only says "checking", never "none", so it cannot go stale
 * into a false claim.
 */
export default function LocationGuideListings({slug, locale, labels}: {slug: string; locale: string; labels: Labels}) {
    const [state, setState] = useState<State>({status: "loading"});

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/locations/guide-listings?slug=${encodeURIComponent(slug)}`, {signal: controller.signal})
            .then(async (response) => {
                if (!response.ok) throw new Error(String(response.status));
                const body = (await response.json()) as {listings?: PublicGuideListing[]};
                setState({status: "ready", listings: Array.isArray(body.listings) ? body.listings : []});
            })
            .catch(() => {
                if (!controller.signal.aborted) setState({status: "error"});
            });
        return () => controller.abort();
    }, [slug]);

    if (state.status === "loading") {
        return <p className="text-base leading-7 text-ink-300" aria-live="polite">{labels.checking}</p>;
    }

    if (state.status === "error") {
        return (
            <p className="text-base leading-7 text-ink-200" aria-live="polite">
                {labels.unavailable}{" "}
                <Link href="/wildlife-experiences" className="font-semibold text-primary-200 hover:text-primary-100" underline>
                    {labels.browseAll}
                </Link>
            </p>
        );
    }

    if (state.listings.length === 0) {
        return <p className="text-lg leading-8 text-white" aria-live="polite">{labels.none}</p>;
    }

    return (
        <div className="flex flex-col gap-5" aria-live="polite">
            <p className="text-lg leading-8 text-white">{labels.found}</p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {state.listings.map((listing) => (
                    <GuideCard key={listing.id} listing={listing} locale={locale} />
                ))}
            </div>
            <Link href="/wildlife-experiences" className="w-fit text-sm font-semibold text-primary-200 hover:text-primary-100" underline>
                {labels.browseAll}
            </Link>
        </div>
    );
}
