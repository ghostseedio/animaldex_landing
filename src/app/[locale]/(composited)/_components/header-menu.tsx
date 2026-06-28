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
            <button type="button" className="md:hidden cursor-pointer" onClick={() => setOpen(true)} aria-label="Open menu">
                <Image src={OpenIcon} alt="Open menu" width={32} height={32} />
            </button>
            <nav
                aria-label="Primary navigation"
                className={`flex md:opacity-100 items-center md:bg-transparent fixed md:static gap-8 md:text-2xl text-3xl
                inset-0 w-screen md:w-auto h-screen md:h-auto flex-col md:flex-row justify-center bg-canvas-900 text-center z-10
                ${open ? 'translate-y-0' : '-translate-y-full'} md:translate-y-0 transition-transform duration-700 ease-in-out`}
            >
                <button type="button" className="absolute top-4 right-8 md:hidden cursor-pointer" onClick={() => setOpen(false)} aria-label="Close menu">
                    <Image src={CloseIcon} alt="Close menu" width={32} height={32} />
                </button>
                {children}
            </nav>
             <div className={`md:hidden ${open ? 'translate-y-full' : '-translate-y-full'} bg-surface-800 w-screen 
             transition-all duration-700 ease-in-out h-screen inset-0 absolute`} />
        </MenuContext.Provider>
    )
}
