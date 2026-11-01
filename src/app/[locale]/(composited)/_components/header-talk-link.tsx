"use client";

import {usePathname} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {stripNavLocale} from "@/lib/nav-active";
import {speciesTalkHref} from "@/lib/species-talk-href";

/**
 * On a species page the header's Talk button talks to that animal
 * (`/talk/<slug>`, JRN-5); everywhere else it opens the picker. Read from the
 * path on the client, because the header is shared by every page and a
 * server component in the layout never learns which page it wraps.
 */
export function useTalkHref(fallback: string): string {
    const pathname = usePathname();
    return speciesTalkHref(stripNavLocale(pathname || "/")) ?? fallback;
}

export default function HeaderTalkLink({
    href,
    className,
    children,
    onClick
}: {
    href: string;
    className: string;
    children: string;
    onClick?: () => void;
}) {
    const resolved = useTalkHref(href);
    return (
        <Link href={resolved} className={className} onClick={onClick}>
            {children}
        </Link>
    );
}
