"use client";

import {useState} from "react";
import Image from "next/image";

type FeaturedSpeciesImageCarouselSlide = {
    captureId: string | null;
    src: string;
    alt: string;
    attribution: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
};

type FeaturedSpeciesImageCarouselProps = {
    slides: FeaturedSpeciesImageCarouselSlide[];
    rarityLabel: string;
    battleTierLabel: string | null;
};

export default function FeaturedSpeciesImageCarousel({
    slides,
    rarityLabel,
    battleTierLabel
}: FeaturedSpeciesImageCarouselProps) {
    const [index, setIndex] = useState(0);
    const activeSlide = slides[index] ?? slides[0];

    if (!activeSlide) {
        return null;
    }

    const showControls = slides.length > 1;
    const activeLocationLabel = activeSlide.captureId ? activeSlide.locationDisplayLabel : null;

    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-3 md:p-4">
            <div className="relative overflow-hidden rounded-[2rem]">
                <div className="relative overflow-hidden bg-surface-800/60 aspect-[4/3] rounded-[2rem]">
                    <Image
                        key={activeSlide.captureId ?? activeSlide.src}
                        src={activeSlide.src}
                        alt={activeSlide.alt}
                        fill
                        unoptimized
                        priority
                        sizes="(min-width: 1280px) 960px, (min-width: 768px) 80vw, 100vw"
                        className="object-cover"
                    />
                </div>

                <div className="absolute left-4 top-4 md:left-5 md:top-5 flex max-w-[calc(100%-2rem)] md:max-w-[calc(100%-2.5rem)] flex-col items-start gap-2">
                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-amber-200/30 bg-gradient-to-r from-amber-500/70 via-orange-400/65 to-rose-500/70 backdrop-blur px-4 py-2 text-sm md:text-base font-semibold text-white shadow-[0_12px_30px_rgba(245,158,11,0.28)]">
                            {rarityLabel}
                        </span>
                        {battleTierLabel ? (
                            <span className="rounded-full border border-cyan-200/30 bg-gradient-to-r from-sky-500/70 via-cyan-500/65 to-teal-500/70 backdrop-blur px-4 py-2 text-sm md:text-base font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.24)]">
                                {battleTierLabel}
                            </span>
                        ) : null}
                    </div>
                    {activeSlide.contextLabel && activeLocationLabel ? (
                        <span className="max-w-[min(68vw,26rem)] truncate rounded-full border border-emerald-200/25 bg-gradient-to-r from-emerald-500/62 via-green-500/58 to-lime-500/58 px-3 py-1.5 text-xs md:text-sm font-medium text-white shadow-[0_10px_28px_rgba(34,197,94,0.2)] backdrop-blur">
                            {activeLocationLabel}
                        </span>
                    ) : null}
                </div>

                {activeSlide.contextLabel ? (
                    <div className="absolute right-4 top-4 md:right-5 md:top-5">
                        <span className="rounded-full border border-fuchsia-200/30 bg-gradient-to-r from-fuchsia-500/70 via-violet-500/65 to-indigo-500/70 backdrop-blur px-4 py-2 text-sm md:text-base font-semibold uppercase tracking-[0.12em] text-white shadow-[0_12px_30px_rgba(168,85,247,0.24)]">
                            {activeSlide.contextLabel}
                        </span>
                    </div>
                ) : null}
                {!activeSlide.contextLabel && activeLocationLabel ? (
                    <div className="absolute right-4 top-4 md:right-5 md:top-5 max-w-[min(75vw,32rem)]">
                        <span className="block truncate rounded-full border border-emerald-200/25 bg-gradient-to-r from-emerald-500/62 via-green-500/58 to-lime-500/58 px-3 py-1.5 text-xs md:text-sm font-medium text-white shadow-[0_10px_28px_rgba(34,197,94,0.2)] backdrop-blur">
                            {activeLocationLabel}
                        </span>
                    </div>
                ) : null}

                {showControls ? (
                    <>
                        <button
                            type="button"
                            aria-label="Previous image"
                            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-surface-950/70 backdrop-blur px-3 py-2 text-lg font-semibold text-white transition-colors hover:bg-surface-950/85"
                            onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            aria-label="Next image"
                            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-surface-950/70 backdrop-blur px-3 py-2 text-lg font-semibold text-white transition-colors hover:bg-surface-950/85"
                            onClick={() => setIndex((current) => (current + 1) % slides.length)}
                        >
                            ›
                        </button>
                        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                            {slides.map((slide, slideIndex) => (
                                <button
                                    key={slide.captureId ?? slide.src}
                                    type="button"
                                    aria-label={`Show image ${slideIndex + 1}`}
                                    className={`h-2.5 rounded-full transition-all ${
                                        slideIndex === index
                                            ? "w-8 bg-white"
                                            : "w-2.5 bg-white/45 hover:bg-white/70"
                                    }`}
                                    onClick={() => setIndex(slideIndex)}
                                />
                            ))}
                        </div>
                    </>
                ) : null}
            </div>

            {activeSlide.attribution ? (
                <div className="px-2 pt-3">
                    <p className="text-sm md:text-base text-ink-300">
                        {activeSlide.attribution}
                    </p>
                </div>
            ) : null}
        </section>
    );
}
