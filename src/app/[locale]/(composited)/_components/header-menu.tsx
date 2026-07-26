"use client";

import {createContext, ReactNode, useContext, useEffect, useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import CloseIcon from "@/app/[locale]/(composited)/_assets/ic_close.svg";
import OpenIcon from "@/app/[locale]/(composited)/_assets/ic_menu.svg";

export const MenuContext = createContext({
    open: false,
    setOpen: (_: boolean) => {}
});

type HeaderMenuProps = {
    logoHref?: string;
    logoLabel: string;
    brandTitle: string;
    children: ReactNode;
    mobileLinks: ReactNode;
    mobileAuth: ReactNode;
    getAppLabel: string;
};

export default function HeaderMenu({
    logoHref = "/",
    logoLabel,
    brandTitle,
    children,
    mobileLinks,
    mobileAuth,
    getAppLabel
}: HeaderMenuProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    return (
        <MenuContext.Provider value={{open, setOpen}}>
            <button
                type="button"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-line-300 bg-surface-900 md:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
            >
                <Image src={OpenIcon} alt="" width={32} height={32} />
            </button>

            {/* Desktop nav */}
            <nav
                aria-label="Primary navigation"
                className="hidden items-center justify-end gap-5 md:flex"
            >
                {children}
            </nav>

            {/* Mobile drawer */}
            <div
                className={`fixed inset-0 z-50 md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
                aria-hidden={!open}
            >
                <button
                    type="button"
                    className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                />
                <nav
                    aria-label="Mobile navigation"
                    className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-canvas-900 shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
                >
                    <div className="flex items-center justify-between border-b border-line-400 px-4 py-4">
                        <Link
                            href={logoHref}
                            className="flex min-w-0 items-center gap-3"
                            aria-label={logoLabel}
                            onClick={() => setOpen(false)}
                        >
                            <img
                                src="/images/logo.webp"
                                alt=""
                                aria-hidden="true"
                                width={40}
                                height={40}
                                className="h-10 w-10"
                            />
                            <span className="truncate font-display text-xl font-bold tracking-tight text-white">
                                {brandTitle}
                            </span>
                        </Link>
                        <button
                            type="button"
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-line-300 bg-surface-900"
                            onClick={() => setOpen(false)}
                            aria-label="Close menu"
                        >
                            <Image src={CloseIcon} alt="" width={32} height={32} />
                        </button>
                    </div>

                    <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
                        {mobileLinks}
                    </div>

                    <div className="mt-auto space-y-3 border-t border-line-400 px-4 py-5">
                        {mobileAuth}
                        <Link
                            href="/#download"
                            onClick={() => setOpen(false)}
                            className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 text-base font-bold text-canvas-950 shadow-[0_0_32px_rgba(27,196,81,0.28)] transition hover:bg-primary-300 active:scale-[0.98]"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                aria-hidden="true"
                            >
                                <path d="M12 3v12" strokeLinecap="round" />
                                <path d="m7.5 10.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M5 20h14" strokeLinecap="round" />
                            </svg>
                            {getAppLabel}
                        </Link>
                    </div>
                </nav>
            </div>
        </MenuContext.Provider>
    );
}

export function useHeaderMenu() {
    return useContext(MenuContext);
}
