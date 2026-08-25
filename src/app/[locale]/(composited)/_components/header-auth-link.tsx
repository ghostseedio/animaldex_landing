"use client";

import Link from "@/app/[locale]/_components/link";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {useContext} from "react";

type HeaderAuthLinkProps = {
    /** Shown to signed-out visitors: this is a doorway to the web app, not a login wall. */
    webAppLabel: string;
    myAnimalsLabel: string;
    mobile?: boolean;
};

export default function HeaderAuthLink({webAppLabel, myAnimalsLabel, mobile = false}: HeaderAuthLinkProps) {
    const {setOpen} = useContext(MenuContext);
    const {session} = useHeaderAuth();

    const href = "/app";
    const label = session.user
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
