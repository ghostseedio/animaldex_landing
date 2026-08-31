"use client";

import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import {INSTAGRAM_IMPORT_USE_CASE_PATH} from "@/lib/instagram-import";

export default function HomeArchiveModule({
    eyebrow,
    title,
    body,
    cta
}: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
}) {
    return (
        <section
            aria-labelledby="home-archive-heading"
            className="relative mx-auto mb-6 mt-4 w-full max-w-4xl px-4 md:mb-8 md:mt-6 md:px-8"
        >
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
                <div className="min-w-0">
                    <p className="text-xs font-semibold leading-5 text-primary-200">
                        {eyebrow}
                    </p>
                    <h2
                        id="home-archive-heading"
                        className="mt-1 font-display text-xl font-bold leading-snug text-white sm:text-2xl"
                    >
                        {title}
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-ink-300">
                        {body}
                    </p>
                </div>
                <Link
                    href={INSTAGRAM_IMPORT_USE_CASE_PATH}
                    onClick={() => trackEvent("homepage_archive_to_import", {
                        source: "homepage_archive",
                        cta,
                        href: INSTAGRAM_IMPORT_USE_CASE_PATH
                    })}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-primary-400/30 bg-primary-400/10 px-5 py-2.5 text-sm font-black text-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
                >
                    {cta}
                </Link>
            </div>
        </section>
    );
}
