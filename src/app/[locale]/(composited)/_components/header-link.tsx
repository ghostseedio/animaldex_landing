"use client";

import Link, {LinkProps} from "@/app/[locale]/_components/link";
import {ReactNode, useContext} from "react";
import {usePathname} from "next/navigation";
import {MenuContext} from "@/app/[locale]/(composited)/_components/header-menu";
import {isNavHrefActive} from "@/lib/nav-active";

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
    const pathname = usePathname();
    const active = isNavHrefActive(pathname, href);

    if (mobile) {
        if (child) {
            return (
                <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex min-h-11 items-center py-2 pl-4 pr-2 text-left text-[15px] font-medium leading-snug transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary-300 motion-reduce:transition-none ${
                        active ? "text-white" : "text-ink-200"
                    }`}
                    onClick={() => setOpen(false)}
                    {...props}
                >
                    <span
                        aria-hidden="true"
                        className={`absolute inset-y-[3px] left-0 w-[2px] bg-primary-400 transition-opacity duration-150 motion-reduce:transition-none ${
                            active ? "opacity-100" : "opacity-0"
                        }`}
                    />
                    {children}
                </Link>
            );
        }

        return (
            <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[3.25rem] items-center justify-between gap-3 px-1 py-2 text-left text-[17px] font-bold leading-snug transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary-300 motion-reduce:transition-none ${
                    active ? "text-white" : "text-ink-100"
                } ${topLevel ? "border-b border-line-300" : ""}`}
                onClick={() => setOpen(false)}
                {...props}
            >
                <span className="flex min-w-0 items-center gap-3">
                    {icon ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[2px] bg-primary-500/10 text-primary-200">{icon}</span> : null}
                    <span className="min-w-0 whitespace-normal">{children}</span>
                </span>
                <span
                    aria-hidden="true"
                    className={`h-[2px] w-4 shrink-0 bg-primary-400 transition-opacity duration-150 motion-reduce:transition-none ${
                        active ? "opacity-100" : "opacity-0"
                    }`}
                />
            </Link>
        );
    }

    return (
        <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative hidden h-full items-center px-3 text-[0.9375rem] leading-none tracking-[-0.005em] transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-5px] focus-visible:outline-primary-300 xl:flex motion-reduce:transition-none ${
                active ? "text-white" : "text-ink-200"
            }`}
            onClick={() => setOpen(false)}
            {...props}
        >
            {children}
            <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary-400 transition-transform duration-150 ease-out motion-reduce:transition-none ${
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
                }`}
            />
        </Link>
    );
}
