"use client";

import Link, {LinkProps} from "@/app/[locale]/_components/link";
import {useContext} from "react";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";

export type HeaderLinkProps = {
    href: string;
    children: string;
    mobile?: boolean;
} & LinkProps;

export default function HeaderLink({href, children, mobile = false, ...props}: HeaderLinkProps) {
    const {setOpen} = useContext(MenuContext);

    if (mobile) {
        return (
            <Link
                href={href}
                className="rounded-2xl px-4 py-3.5 text-left text-lg font-semibold text-white transition-colors hover:bg-white/[0.05] hover:text-primary-100 md:hidden"
                onClick={() => setOpen(false)}
                {...props}
            >
                {children}
            </Link>
        );
    }

    return (
        <Link
            href={href}
            className="hidden rounded-md px-2 py-2 text-ink-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100 md:block"
            onClick={() => setOpen(false)}
            {...props}
        >
            {children}
        </Link>
    );
}
