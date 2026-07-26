"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";

type ComparisonPageNavigationProps = {
    title: string;
    labels: {
        compareAnother: string;
        meetAnimals: string;
        jumpStats: string;
        share: string;
        overview: string;
        winner: string;
        stats: string;
        scenarios: string;
        faq: string;
        related: string;
    };
};

export default function ComparisonPageNavigation({title, labels}: ComparisonPageNavigationProps) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const updateProgress = () => {
            const available = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(available > 0 ? Math.min(100, Math.max(0, (window.scrollY / available) * 100)) : 0);
        };

        updateProgress();
        window.addEventListener("scroll", updateProgress, {passive: true});
        window.addEventListener("resize", updateProgress);
        return () => {
            window.removeEventListener("scroll", updateProgress);
            window.removeEventListener("resize", updateProgress);
        };
    }, []);

    const share = async () => {
        if (navigator.share) {
            await navigator.share({title, url: window.location.href}).catch(() => undefined);
            return;
        }
        await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    };

    const navigation = [
        ["overview", labels.overview],
        ["winner", labels.winner],
        ["stats", labels.stats],
        ["scenarios", labels.scenarios],
        ["faq", labels.faq],
        ["related", labels.related]
    ];

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <Link href="/comparisons" className="rounded-full bg-primary-500 px-4 py-2.5 text-sm font-bold text-surface-950 transition hover:bg-primary-300">
                    {labels.compareAnother}
                </Link>
                <a href="#meet-animals" className="rounded-full border border-line-300 bg-surface-900/70 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-primary-500/50">
                    {labels.meetAnimals}
                </a>
                <a href="#stats" className="rounded-full border border-line-300 bg-surface-900/70 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-primary-500/50">
                    {labels.jumpStats}
                </a>
                <button type="button" onClick={share} className="rounded-full border border-line-300 bg-surface-900/70 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-primary-500/50">
                    {labels.share}
                </button>
            </div>

            <div className="sticky top-[4.75rem] z-30 -mx-2 overflow-hidden rounded-2xl border border-line-300/80 bg-surface-950/90 shadow-2xl backdrop-blur-xl md:top-[5.25rem]">
                <nav aria-label={labels.overview} className="flex items-center gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none]">
                    {navigation.map(([id, label]) => (
                        <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold text-ink-200 transition hover:bg-surface-800 hover:text-white md:text-sm">
                            {label}
                        </a>
                    ))}
                </nav>
                <div className="h-0.5 bg-surface-800">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-emerald-300 transition-[width] duration-150" style={{width: `${progress}%`}} />
                </div>
            </div>
        </>
    );
}
