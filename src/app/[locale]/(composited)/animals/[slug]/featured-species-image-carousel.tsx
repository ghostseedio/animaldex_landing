"use client";

import {useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import CaptureGradeBadge from "@/app/[locale]/(authenticated)/app/_components/capture-grade-badge";
import type {CaptureGradeBreakdown} from "@/lib/capture-grade";

type FeaturedSpeciesImageCarouselSlide = {
    captureId: string | null;
    src: string;
    alt: string;
    gradeLabel: string | null;
    grade: number | null;
    gradeBreakdown: CaptureGradeBreakdown | null;
    attribution: string | null;
    username: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
};

type FeaturedSpeciesImageCarouselProps = {
    slides: FeaturedSpeciesImageCarouselSlide[];
    rarityLabel: string;
};

export default function FeaturedSpeciesImageCarousel({
    slides,
    rarityLabel
}: FeaturedSpeciesImageCarouselProps) {
    const [index, setIndex] = useState(0);
    const activeSlide = slides[index] ?? slides[0];

    if (!activeSlide) {
        return null;
    }

    const showControls = slides.length > 1;
    const activeLocationLabel = activeSlide.captureId ? activeSlide.locationDisplayLabel : null;

    return (
        <section className="rounded-[2rem] border border-white/10 bg-black/20 p-3 shadow-2xl shadow-black/30">
            <div className="relative overflow-hidden rounded-[2rem]">
                <div className="relative overflow-hidden bg-surface-800/60 aspect-[4/3] rounded-[2rem]">
                    <Image
                        key={activeSlide.captureId ?? activeSlide.src}
                        src={activeSlide.src}
                        alt={activeSlide.alt}
                        fill
                        unoptimized
                        priority
                        sizes="(min-width: 1024px) 40vw, 100vw"
                        className="object-cover"
                    />
                </div>

                <div className="absolute left-4 top-4 md:left-5 md:top-5 flex max-w-[calc(100%-2rem)] md:max-w-[calc(100%-2.5rem)] flex-col items-start gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-amber-200/25 bg-amber-950/65 backdrop-blur px-3 py-1.5 text-sm font-semibold text-amber-100">
                            {rarityLabel}
                        </span>
                        {activeSlide.grade != null ? (
                            <CaptureGradeBadge
                                grade={activeSlide.grade}
                                breakdown={activeSlide.gradeBreakdown}
                            />
                        ) : activeSlide.gradeLabel ? (
                            <span className="rounded-full border border-white/15 bg-black/55 backdrop-blur px-3 py-1.5 text-sm font-semibold text-white">
                                {activeSlide.gradeLabel}
                            </span>
                        ) : null}
                    </div>
                    {activeSlide.contextLabel && activeLocationLabel ? (
                        <span className="max-w-[min(68vw,26rem)] truncate rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs md:text-sm font-medium text-white backdrop-blur">
                            {activeLocationLabel}
                        </span>
                    ) : null}
                </div>

                {activeSlide.contextLabel ? (
                    <div className="absolute right-4 top-4 md:right-5 md:top-5 flex flex-col items-end gap-2">
                        <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                            {activeSlide.contextLabel}
                        </span>
                    </div>
                ) : null}
                {!activeSlide.contextLabel && activeLocationLabel ? (
                    <div className="absolute right-4 top-4 md:right-5 md:top-5 max-w-[min(75vw,32rem)]">
                        <span className="block truncate rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs md:text-sm font-medium text-white backdrop-blur">
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
                        {activeSlide.username ? (
                            <Link href={`/u/${encodeURIComponent(activeSlide.username)}`} className="hover:text-primary-100">
                                {activeSlide.attribution}
                            </Link>
                        ) : activeSlide.attribution}
                    </p>
                </div>
            ) : null}
        </section>
    );
}
