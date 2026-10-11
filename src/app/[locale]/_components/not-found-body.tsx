"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {THEME_STORAGE_KEY} from "@/lib/theme";
import {animalIcons} from "@/loaders/icons";
import {animalSilhouetteImages} from "@/data/animal-silhouettes";
import IconCanvas from "@/app/[locale]/_components/icon-canvas";
import Link from "@/app/[locale]/_components/link";
import Button from "@/app/[locale]/_components/button";

const notFoundCopy = {
    en: {
        eyebrow: "Off the trail",
        title: "This page wandered off",
        description: "We tracked it as far as we could, but the trail goes cold here. It may have moved, or it never lived in this habitat.",
        button: "Back home",
        explore: "Or pick up a fresh trail",
        links: [
            {href: "/animals", label: "Browse animals"},
            {href: "/rankings", label: "Rankings"},
            {href: "/blog", label: "Blog"}
        ]
    },
    id: {
        eyebrow: "Keluar jalur",
        title: "Halaman ini tersesat",
        description: "Kami sudah melacaknya sejauh mungkin, tetapi jejaknya hilang di sini. Mungkin sudah pindah, atau memang tidak pernah ada di habitat ini.",
        button: "Kembali ke beranda",
        explore: "Atau ikuti jejak baru",
        links: [
            {href: "/animals", label: "Jelajahi hewan"},
            {href: "/rankings", label: "Peringkat"},
            {href: "/blog", label: "Blog"}
        ]
    }
} as const;

export default function NotFoundBody() {
    const pathname = usePathname();
    const locale = pathname === "/id" || pathname.startsWith("/id/") ? "id" : "en";
    const t = notFoundCopy[locale];

    // A 404 is client-rendered after the document has loaded, which rebuilds <html>
    // with the server's data-theme and drops what the boot script applied.
    useEffect(() => {
        try {
            if (localStorage.getItem(THEME_STORAGE_KEY) === "light") {
                document.documentElement.setAttribute("data-theme", "light");
            }
        } catch {
            // Blocked storage: stay on the default theme.
        }
    }, []);

    return (
        <>
            <IconCanvas
                probability={0.02}
                paths={animalIcons}
                imageSources={animalSilhouetteImages}
                color="#21C05E"
            />
            <main className="relative flex min-h-[100svh] w-full flex-col items-center justify-center gap-6 px-4 py-16 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-300 md:text-sm">
                    {t.eyebrow}
                </p>
                <h1 className="font-display text-8xl font-extrabold leading-none tracking-tight text-primary-200 md:text-[10rem]">
                    404
                </h1>
                <div className="flex max-w-md flex-col gap-3 md:max-w-xl">
                    <h2 className="font-display text-3xl font-bold uppercase text-ink-100 md:text-4xl">{t.title}</h2>
                    <p className="text-lg text-ink-300 md:text-xl">{t.description}</p>
                </div>
                <Link href="/" className="mt-2">
                    <Button as="span">
                        {t.button}
                    </Button>
                </Link>
                <nav aria-label={t.explore} className="mt-4 flex flex-col items-center gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">{t.explore}</p>
                    <ul className="flex flex-wrap justify-center gap-2">
                        {t.links.map((link) => (
                            <li key={link.href}>
                                <Link
                                    href={link.href}
                                    className="block rounded-full border border-line-400 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-300 hover:text-primary-200"
                                >
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </main>
        </>
    );
}
