"use client";

/**
 * Founders on the Ark's cards (founders contract, section 5): "Brought by
 * {name}" with the name linked to the founder's profile and their photo when
 * they have one, and "How it got aboard" when they shared it. A Voyager
 * stays plain text. Used by /ark's tap card and the chat's Ark panel.
 */

import React from "react";
import Link from "@/app/[locale]/_components/link";
import {arkFounderPath, type ArkFounder, type ArkFounderStory} from "@/lib/ark-founders";
import {arkBringerLabel} from "@/lib/ark-life";

export function ArkFounderAvatar({founder, size = 18, className = ""}: {founder: ArkFounder; size?: number; className?: string}) {
    if (!founder.avatar_url) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={founder.avatar_url}
            alt=""
            width={size}
            height={size}
            style={{width: size, height: size}}
            className={`inline-block shrink-0 rounded-full bg-white/10 object-cover ${className}`}
            data-testid="ark-founder-avatar"
            onError={(event) => {
                event.currentTarget.style.display = "none";
            }}
        />
    );
}

const NAME_LINK = "min-w-0 truncate font-semibold text-ink-100 underline decoration-white/25 underline-offset-[3px] transition-colors hover:text-primary-200 hover:decoration-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300";

/** The founder's name, linked to their profile. */
export function ArkFounderLink({founder, className = NAME_LINK}: {founder: ArkFounder; className?: string}) {
    return (
        <Link href={arkFounderPath(founder)} className={className} data-testid="ark-founder-link">
            {founder.display_name}
        </Link>
    );
}

/** A template ("Brought by {name}") with `{key}` filled by a node: what comes before and after stay the reader's language. */
export function arkTemplateParts(template: string, key: string): [string, string] {
    const at = template.indexOf(`{${key}}`);
    if (at < 0) return [template, ""];
    return [template.slice(0, at), template.slice(at + key.length + 2)];
}

/** "Brought by {name}" with the avatar and the linked name. */
export function ArkBroughtByFounder({template, founder, className = "", textClassName = "text-ink-400"}: {template: string; founder: ArkFounder; className?: string; textClassName?: string}) {
    const [before, after] = arkTemplateParts(template, "name");
    return (
        <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`} data-testid="ark-brought-by-founder">
            {before.trim() ? <span className={`shrink-0 ${textClassName}`}>{before.trim()}</span> : null}
            <ArkFounderAvatar founder={founder} />
            <ArkFounderLink founder={founder} />
            {after.trim() ? <span className={`shrink-0 ${textClassName}`}>{after.trim()}</span> : null}
        </span>
    );
}

export type ArkBringerEntry = {label: string; founder: ArkFounder | null};

/** Bringers joined in the reader's language ("Maya Chen and Voyager 5"), the named ones linked. */
export function ArkBringerNames({entries, locale, former}: {entries: ArkBringerEntry[]; locale: string; former: string}) {
    const seen = new Set<string>();
    const unique = entries
        .map((entry) => ({...entry, label: entry.founder ? entry.founder.display_name : arkBringerLabel(entry.label, former)}))
        .filter((entry) => entry.label && !seen.has(entry.label) && Boolean(seen.add(entry.label)));
    let parts: Array<{type: string; value: string}>;
    try {
        parts = new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).formatToParts(unique.map((entry) => entry.label));
    } catch {
        parts = unique.flatMap((entry, index) => (index ? [{type: "literal", value: " & "}, {type: "element", value: entry.label}] : [{type: "element", value: entry.label}]));
    }
    let element = 0;
    return (
        <>
            {parts.map((part, index) => {
                if (part.type !== "element") return <React.Fragment key={index}>{part.value}</React.Fragment>;
                const entry = unique[element++];
                return entry?.founder ? <ArkFounderLink key={index} founder={entry.founder} /> : <React.Fragment key={index}>{part.value}</React.Fragment>;
            })}
        </>
    );
}

/** "How it got aboard": what the founder did, and the problem in quotes under it when they gave one. */
export function ArkFounderStoryBlock({story, title, className = "", clamp = true}: {story: ArkFounderStory; title: string; className?: string; clamp?: boolean}) {
    return (
        <div className={`text-[13px] leading-snug ${className}`} data-testid="ark-founder-story">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-primary-300">{title}</p>
            <p className={`mt-0.5 text-ink-100 ${clamp ? "line-clamp-3" : ""}`}>{story.step}</p>
            {story.problem ? <p className={`mt-0.5 italic text-ink-300 ${clamp ? "line-clamp-2" : ""}`}>{`“${story.problem}”`}</p> : null}
        </div>
    );
}
