"use client";

import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import {INSTAGRAM_IMPORT_USE_CASE_PATH} from "@/lib/instagram-import";

export default function HomeArchiveModule({
    line,
    cta
}: {
    line: string;
    cta: string;
}) {
    return (
        <p className="text-sm leading-6 text-ink-400 md:text-base">
            {line}{" "}
            <Link
                href={INSTAGRAM_IMPORT_USE_CASE_PATH}
                onClick={() => trackEvent("homepage_archive_to_import", {
                    source: "homepage_archive",
                    cta,
                    href: INSTAGRAM_IMPORT_USE_CASE_PATH
                })}
                className="font-semibold text-primary-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
            >
                {cta}
            </Link>
        </p>
    );
}
