"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";

type HeaderAuthLinkProps = {
    signInLabel: string;
    myAnimalsLabel: string;
};

type SessionResponse = {
    user: {id: string; email: string | null} | null;
    username: string | null;
    displayName: string | null;
};

export default function HeaderAuthLink({signInLabel, myAnimalsLabel}: HeaderAuthLinkProps) {
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
            <span className="hidden h-10 w-24 rounded-2xl border border-white/10 bg-white/5 md:inline-flex" aria-hidden="true" />
        );
    }

    if (session?.user) {
        const label = session.username
            ? `@${session.username}`
            : session.displayName ?? myAnimalsLabel;

        return (
            <Link
                href="/app"
                className="hidden rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-100 md:inline-flex"
            >
                {label}
            </Link>
        );
    }

    return (
        <Link
            href="/app"
            className="hidden rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-100 md:inline-flex"
        >
            {signInLabel}
        </Link>
    );
}
