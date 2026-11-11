"use client";

/**
 * Bringers on the Ark's cards (founders contract, section 5; owner,
 * 2026-11-11): every person with a handle shows as their @username, linked to
 * their profile, with their photo when they have one, and their display name
 * beside it where there is room ("Ada Lovelace · @ada"). Only a stored
 * under-18, no handle or a system account stays a plain "Voyager N". "How it
 * got aboard" / "How they keep it thriving" when they shared a story. Used by
 * /ark's tap card and replay, the chat's Ark panel, and Settings' preview.
 */

import React from "react";
import {useParams} from "next/navigation";
import {arkFounderDisplayName, arkHandle, type ArkFounder, type ArkFounderStory} from "@/lib/ark-founders";
import {arkProfileHref, postArkOpenProfile} from "@/lib/ark-profile-link";
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

const NAME_LINK = "inline-flex min-w-0 max-w-full items-baseline gap-1 font-semibold text-ink-100 underline decoration-white/25 underline-offset-[3px] transition-colors hover:text-primary-200 hover:decoration-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300";

/**
 * The bringer, linked to their profile: "@ada" always (never cut short), and
 * with `withName` their display name before it when it says more ("Ada
 * Lovelace · @ada"; the name gives way first when space is short).
 *
 * A real link to `/u/{handle}`, never a client-side route change, so that in
 * the apps' WebView the app sees it (it intercepts the navigation); where the
 * app's bridge is there, it is told `{type: "ark:open-profile", handle}` and
 * opens its own profile screen (`lib/ark-profile-link`).
 */
export function ArkFounderLink({founder, className = NAME_LINK, withName = false}: {founder: ArkFounder; className?: string; withName?: boolean}) {
    const name = withName ? arkFounderDisplayName(founder) : null;
    const locale = useParams<{locale?: string}>()?.locale ?? null;
    const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (postArkOpenProfile(window as unknown as Parameters<typeof postArkOpenProfile>[0], founder.handle)) event.preventDefault();
    };
    return (
        <a href={arkProfileHref(founder.handle, locale)} onClick={onClick} className={className} data-testid="ark-founder-link" aria-label={name ? `${name} ${arkHandle(founder)}` : arkHandle(founder)}>
            {name ? (
                <>
                    <span className="min-w-0 truncate">{name}</span>
                    <span aria-hidden="true" className="shrink-0 no-underline">·</span>
                </>
            ) : null}
            <span className="shrink-0" data-testid="ark-founder-handle">{arkHandle(founder)}</span>
        </a>
    );
}

/** A template ("Brought by {name}") with `{key}` filled by a node: what comes before and after stay the reader's language. */
export function arkTemplateParts(template: string, key: string): [string, string] {
    const at = template.indexOf(`{${key}}`);
    if (at < 0) return [template, ""];
    return [template.slice(0, at), template.slice(at + key.length + 2)];
}

/** "Brought by {name}" with the avatar and the linked @username (and the display name beside it, `withName`). */
export function ArkBroughtByFounder({template, founder, className = "", textClassName = "text-ink-400", withName = false}: {template: string; founder: ArkFounder; className?: string; textClassName?: string; withName?: boolean}) {
    const [before, after] = arkTemplateParts(template, "name");
    return (
        <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`} data-testid="ark-brought-by-founder">
            {before.trim() ? <span className={`shrink-0 ${textClassName}`}>{before.trim()}</span> : null}
            <ArkFounderAvatar founder={founder} />
            <ArkFounderLink founder={founder} withName={withName} />
            {after.trim() ? <span className={`shrink-0 ${textClassName}`}>{after.trim()}</span> : null}
        </span>
    );
}

export type ArkBringerEntry = {label: string; founder: ArkFounder | null};

/** Bringers joined in the reader's language ("@mayachen and Voyager 5"), the named ones linked to their profiles. */
export function ArkBringerNames({entries, locale, former}: {entries: ArkBringerEntry[]; locale: string; former: string}) {
    const seen = new Set<string>();
    const unique = entries
        .map((entry) => ({...entry, label: entry.founder ? arkHandle(entry.founder) : arkBringerLabel(entry.label, former)}))
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

/**
 * "How it got aboard" / "How they keep it thriving": what the founder did, and the problem in quotes under it when
 * they gave one. `founder`: whose story it is, their @username linked under it ("— @ada").
 */
export function ArkFounderStoryBlock({story, title, className = "", clamp = true, founder = null}: {story: ArkFounderStory; title: string; className?: string; clamp?: boolean; founder?: ArkFounder | null}) {
    return (
        <div className={`text-[13px] leading-snug ${className}`} data-testid="ark-founder-story">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-primary-300">{title}</p>
            <p className={`mt-0.5 text-ink-100 ${clamp ? "line-clamp-3" : ""}`}>{story.step}</p>
            {story.problem ? <p className={`mt-0.5 italic text-ink-300 ${clamp ? "line-clamp-2" : ""}`}>{`“${story.problem}”`}</p> : null}
            {/* Whose story: their @username, linked, never cut short. */}
            {founder ? (
                <p className="mt-1 text-[12px] text-ink-400" data-testid="ark-founder-story-by">
                    <span aria-hidden="true">— </span>
                    <ArkFounderLink founder={founder} className="font-semibold text-ink-200 underline decoration-white/25 underline-offset-2 hover:text-primary-200" />
                </p>
            ) : null}
        </div>
    );
}
