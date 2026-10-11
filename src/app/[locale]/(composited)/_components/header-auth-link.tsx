"use client";

import Link from "@/app/[locale]/_components/link";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";
import {type HeaderAuthSession, useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {useContext, useState} from "react";

type HeaderAuthLinkProps = {
    /** Shown to signed-out visitors: this is a doorway to the web app, not a login wall. */
    webAppLabel: string;
    myAnimalsLabel: string;
    mobile?: boolean;
};

const WEB_APP_HREF = "/app";

function accountName(session: HeaderAuthSession, fallback: string) {
    return session.username ? `@${session.username}` : session.displayName ?? fallback;
}

/**
 * The signed-in person's avatar: their profile photo, or the first letter of
 * their name when there is none (or it fails to load). Round, as avatars are
 * everywhere else on AnimalDex, inside the header's square controls.
 */
export function HeaderAvatar({session, size}: {session: HeaderAuthSession; size: number}) {
    const [failed, setFailed] = useState(false);
    const initial = (session.displayName ?? session.username ?? session.user?.email ?? "?").trim().charAt(0).toUpperCase() || "?";

    if (session.avatarUrl && !failed) {
        return (
            // A Supabase Storage URL of any size; next/image would need the host configured.
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={session.avatarUrl}
                alt=""
                width={size}
                height={size}
                onError={() => setFailed(true)}
                className="shrink-0 rounded-full object-cover ring-1 ring-line-200"
                style={{width: size, height: size}}
            />
        );
    }

    return (
        <span
            aria-hidden="true"
            className="grid shrink-0 place-items-center rounded-full bg-primary-400/15 font-display font-bold text-primary-200 ring-1 ring-primary-400/30"
            style={{width: size, height: size, fontSize: Math.round(size * 0.45)}}
        >
            {initial}
        </span>
    );
}

/**
 * Signed out: "Web app" beside the header CTA (desktop) or in the drawer
 * (mobile). Signed in, the drawer shows the account with its avatar, and the
 * desktop link steps aside for `HeaderAccountButton` at the top right.
 */
export default function HeaderAuthLink({webAppLabel, myAnimalsLabel, mobile = false}: HeaderAuthLinkProps) {
    const {setOpen} = useContext(MenuContext);
    const {session} = useHeaderAuth();

    if (mobile) {
        return (
            <Link
                href={WEB_APP_HREF}
                onClick={() => setOpen(false)}
                className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-[2px] border border-line-100 bg-transparent px-3 text-center text-sm font-bold leading-snug text-ink-100 transition-colors duration-150 hover:border-primary-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
            >
                {session.user ? <HeaderAvatar session={session} size={26} /> : null}
                <span className="truncate">{session.user ? accountName(session, myAnimalsLabel) : webAppLabel}</span>
            </Link>
        );
    }

    if (session.user) return null;

    return (
        <Link
            href={WEB_APP_HREF}
            className="hidden h-9 items-center rounded-[2px] border border-line-100 px-3.5 text-[0.8125rem] font-bold leading-none text-ink-100 transition-colors duration-150 hover:border-primary-400 hover:text-white focus-visible:border-primary-400 focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 xl:inline-flex motion-reduce:transition-none"
        >
            {webAppLabel}
        </Link>
    );
}

/**
 * The signed-in avatar at the header's top right, linking into the web app.
 * Nothing for a signed-out visitor, so the header is unchanged for them.
 * `compact` is the phone bar beside the menu button: the avatar alone, sized
 * to the bar's 44px controls.
 */
export function HeaderAccountButton({myAnimalsLabel, compact = false}: {myAnimalsLabel: string; compact?: boolean}) {
    const {session} = useHeaderAuth();
    if (!session.user) return null;

    const name = accountName(session, myAnimalsLabel);

    if (compact) {
        return (
            <Link
                href={WEB_APP_HREF}
                aria-label={`${name}: open the web app`}
                title={name}
                // The header hides its wordmark on narrow phones while this is
                // shown, so the bar still fits beside the menu button.
                data-account-button=""
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-line-200 bg-white/[0.02] transition-colors duration-150 hover:border-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
            >
                <HeaderAvatar session={session} size={28} />
            </Link>
        );
    }

    return (
        <Link
            href={WEB_APP_HREF}
            aria-label={`${name}: open the web app`}
            title={name}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-line-100 transition-colors duration-150 hover:border-primary-400 focus-visible:border-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
        >
            <HeaderAvatar session={session} size={26} />
        </Link>
    );
}
