"use client";

import {createContext, ReactNode, useEffect, useState} from "react";
import CloseIcon from "@/app/[locale]/(composited)/_assets/ic_close.svg";
import OpenIcon from "@/app/[locale]/(composited)/_assets/ic_menu.svg";
import Image from "next/image";

export const MenuContext = createContext({
    open: false,
    setOpen: (_: boolean) => {}
})

export default function HeaderMenu({children}: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";

        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    return (
        <MenuContext.Provider value={{
            open,
            setOpen
        }}>
            <button type="button" className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-line-300 bg-surface-900 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
                <Image src={OpenIcon} alt="Open menu" width={32} height={32} />
            </button>
            <nav
                aria-label="Primary navigation"
                className={`fixed inset-0 z-10 flex h-screen w-screen flex-col items-center justify-center gap-7 bg-canvas-900 text-center text-3xl
                transition-transform duration-300 ease-in-out md:static md:h-auto md:w-auto md:translate-y-0 md:flex-row md:justify-end md:gap-5 md:bg-transparent md:text-base
                ${open ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <button type="button" className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-line-300 bg-surface-900 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
                    <Image src={CloseIcon} alt="Close menu" width={32} height={32} />
                </button>
                {children}
            </nav>
             <div className={`md:hidden ${open ? 'translate-y-full' : '-translate-y-full'} absolute inset-0 h-screen w-screen bg-surface-800 transition-all duration-300 ease-in-out`} />
        </MenuContext.Provider>
    )
}
