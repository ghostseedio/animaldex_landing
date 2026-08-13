"use client";

import {useContext, useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";

type HeaderAuthLinkProps = {
    /** Shown to signed-out visitors: this is a doorway to the web app, not a login wall. */
    webAppLabel: string;
    myAnimalsLabel: string;
    mobile?: boolean;
};

type SessionResponse = {
    user: {id: string; email: string | null} | null;
    username: string | null;
    displayName: string | null;
};

export default function HeaderAuthLink({webAppLabel, myAnimalsLabel, mobile = false}: HeaderAuthLinkProps) {
    const {setOpen} = useContext(MenuContext);
    const [session, setSession] = useState<SessionResponse | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function loadSession() {
            try {
                const response = await fetch("/api/auth/session", {cache: "no-store"});
                const payload = await response.json() as SessionResponse;

                if (isMounted) {
                    setSession(payload);
                    setIsReady(true);
                }
            } catch {
                if (isMounted) {
                    setSession({user: null, username: null, displayName: null});
                    setIsReady(true);
                }
            }
        }

        void loadSession();

        return () => {
            isMounted = false;
        };
    }, []);

    if (!isReady) {
        return (
            <span
                className={mobile
                    ? "inline-flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 md:hidden"
                    : "hidden h-10 w-24 rounded-2xl border border-white/10 bg-white/5 md:inline-flex"}
                aria-hidden="true"
            />
        );
    }

    const href = "/app";
    const label = session?.user
        ? (session.username ? `@${session.username}` : session.displayName ?? myAnimalsLabel)
        : webAppLabel;

    if (mobile) {
        return (
            <Link
                href={href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] px-3 text-sm font-bold text-white transition hover:border-primary-400/50 hover:bg-white/[0.07] md:flex"
            >
                {label}
            </Link>
        );
    }

    return (
        <Link
            href={href}
            className="hidden rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-100 md:inline-flex"
        >
            {label}
        </Link>
    );
}
