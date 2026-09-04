"use client";

import Link, {LinkProps} from "@/app/[locale]/_components/link";
import {ReactNode, useContext} from "react";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";

export type HeaderLinkProps = {
    href: string;
    children: string;
    mobile?: boolean;
    child?: boolean;
    topLevel?: boolean;
    icon?: ReactNode;
} & LinkProps;

export default function HeaderLink({href, children, mobile = false, child = false, topLevel = false, icon, ...props}: HeaderLinkProps) {
    const {setOpen} = useContext(MenuContext);

    if (mobile) {
        if (child) {
            return (
                <Link
                    href={href}
                    className="flex min-h-11 items-center rounded-md px-2 py-2 text-left text-[15px] font-medium leading-snug text-ink-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300"
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
                className={`flex min-h-12 items-center justify-between gap-3 px-1 py-2 text-left text-[17px] font-bold leading-snug text-white transition-colors hover:text-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 ${topLevel ? "border-b border-white/[0.06]" : ""}`}
                onClick={() => setOpen(false)}
                {...props}
            >
                <span className="flex min-w-0 items-center gap-3">
                    {icon ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-500/10 text-primary-200">{icon}</span> : null}
                    <span className="min-w-0 whitespace-normal">{children}</span>
                </span>
            </Link>
        );
    }

    return (
        <Link
            href={href}
            className="hidden rounded-md px-2 py-2 text-ink-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100 xl:block"
            onClick={() => setOpen(false)}
            {...props}
        >
            {children}
        </Link>
    );
}
