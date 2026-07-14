"use client";

import Link, { LinkProps } from "@/app/[locale]/_components/link";
import {useContext} from "react";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";

export type HeaderLinkProps = {
    href: string;
    children: string;
    mobile?: boolean;
} & LinkProps

export default function HeaderLink({href, children, mobile = false, ...props}: HeaderLinkProps) {
    const {open, setOpen} = useContext(MenuContext);

    return (
        <Link
            href={href}
            className={`rounded-md px-2 py-2 text-ink-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100 ${mobile ? "md:hidden" : "hidden md:block"}`}
            onClick={() => setOpen(false)}
            {...props}
        >
            <span
                className={`md:translate-y-0 ${open ? 'translate-y-0' : 'translate-y-full'} transition-transform duration-300 ease-in-out md:transition-none inline-block`}
            >
                {children}
            </span>
        </Link>
    )
}
