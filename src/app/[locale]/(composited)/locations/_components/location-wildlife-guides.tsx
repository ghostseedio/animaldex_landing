"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {GuideRow} from "@/components/wildlife-guides/guide-ui";
import {guidePath, type GuideCard} from "@/lib/virtual-wildlife-guides";

type State =
    | {status: "loading"}
    | {status: "ready"; guides: GuideCard[]; total: number}
    | {status: "error"};

type Labels = {
    checking: string;
    found: string;
    none: string;
    unavailable: string;
    browseAll: string;
};

/**
 * Location pages are static and never revalidate, so live guides are read at
 * view time. The server HTML only says "checking", never "none", so it cannot
 * go stale into a false claim.
 */
export default function LocationWildlifeGuides({slug, locale, labels}: {slug: string; locale: string; labels: Labels}) {
    const [state, setState] = useState<State>({status: "loading"});

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/locations/wildlife-guides?slug=${encodeURIComponent(slug)}`, {signal: controller.signal})
            .then(async (response) => {
                if (!response.ok) throw new Error(String(response.status));
                const body = (await response.json()) as {guides?: GuideCard[]; total?: number};
                const guides = Array.isArray(body.guides) ? body.guides : [];
                setState({status: "ready", guides, total: typeof body.total === "number" ? body.total : guides.length});
            })
            .catch(() => {
                if (!controller.signal.aborted) setState({status: "error"});
            });
        return () => controller.abort();
    }, [slug]);

    if (state.status === "loading") {
        return <p className="text-base leading-7 text-ink-300" aria-live="polite">{labels.checking}</p>;
    }

    if (state.status === "error" || state.guides.length === 0) {
        return (
            <p className="text-base leading-7 text-ink-200" aria-live="polite">
                {state.status === "error" ? labels.unavailable : labels.none}{" "}
                <Link href="/wildlife-guides" className="font-semibold text-primary-200 hover:text-primary-100" underline>
                    {labels.browseAll}
                </Link>
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4" aria-live="polite">
            <p className="text-lg leading-8 text-white">{labels.found}</p>
            <div className="border-t border-white/10">
                {state.guides.map((guide) => (
                    <GuideRow key={guide.id} card={guide} href={guidePath(guide)} locale={locale} />
                ))}
            </div>
            {state.total > state.guides.length ? (
                <Link href={`/wildlife-guides/${slug}`} className="w-fit text-sm font-semibold text-primary-200 hover:text-primary-100" underline>
                    {labels.browseAll}
                </Link>
            ) : null}
        </div>
    );
}
