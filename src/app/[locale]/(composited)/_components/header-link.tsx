"use client";

import Link, {LinkProps} from "@/app/[locale]/_components/link";
import {ReactNode, useContext} from "react";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";

export type HeaderLinkProps = {
    href: string;
    children: string;
    mobile?: boolean;
    icon?: ReactNode;
} & LinkProps;

export default function HeaderLink({href, children, mobile = false, icon, ...props}: HeaderLinkProps) {
    const {setOpen} = useContext(MenuContext);

    if (mobile) {
        return (
            <Link
                href={href}
                className="group flex min-h-12 items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-ink-100 transition-colors hover:bg-white/[0.055] hover:text-primary-100 focus-visible:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 md:hidden"
                onClick={() => setOpen(false)}
                {...props}
            >
                <span className="flex min-w-0 items-center gap-3">
                    {icon ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-500/10 text-primary-200 transition-colors group-hover:bg-primary-500/15">{icon}</span> : null}
                    <span className="truncate">{children}</span>
                </span>
                <span aria-hidden="true" className="text-lg text-ink-600 transition group-hover:translate-x-0.5 group-hover:text-primary-300">›</span>
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
