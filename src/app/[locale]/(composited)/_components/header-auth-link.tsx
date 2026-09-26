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
                className="flex min-h-12 w-full items-center justify-center rounded-[2px] border border-line-100 bg-transparent px-3 text-center text-sm font-bold leading-snug text-ink-100 transition-colors duration-150 hover:border-primary-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
            >
                {label}
            </Link>
        );
    }

    return (
        <Link
            href={href}
            className="hidden h-9 items-center rounded-[2px] border border-line-100 px-3.5 text-[0.8125rem] font-bold leading-none text-ink-100 transition-colors duration-150 hover:border-primary-400 hover:text-white focus-visible:border-primary-400 focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 xl:inline-flex motion-reduce:transition-none"
        >
            {label}
        </Link>
    );
}
