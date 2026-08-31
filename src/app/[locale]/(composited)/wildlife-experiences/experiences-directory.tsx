"use client";

import {useMemo, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import ExperienceCard from "@/app/[locale]/(composited)/wildlife-experiences/experience-card";
import {trackEvent} from "@/lib/analytics";
import {
    GUIDE_CATEGORIES,
    guideAreaServedName,
    guideLocationFilterKey,
    isGuideCategory,
    type GuideCategory,
    type PublicGuideListing
} from "@/lib/guide-marketplace-core";

const DURATION_FILTERS = [
    {id: "any", label: "Any duration"},
    {id: "short", label: "Up to 2 hours"},
    {id: "half", label: "Half day"},
    {id: "full", label: "Full day +"}
] as const;

type DurationId = (typeof DURATION_FILTERS)[number]["id"];

function matchesDuration(minutes: number, filter: DurationId) {
    if (filter === "short") return minutes < 120;
    if (filter === "half") return minutes >= 120 && minutes < 360;
    if (filter === "full") return minutes >= 360;
    return true;
}

export default function ExperiencesDirectory({
    listings,
    locale
}: {
    listings: PublicGuideListing[];
    locale: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const requestedCategory = searchParams.get("category");
    const requestedLocation = searchParams.get("location") ?? "";
    const category = isGuideCategory(requestedCategory) ? requestedCategory : "";
    const [duration, setDuration] = useState<DurationId>("any");

    const locations = useMemo(() => {
        return Array.from(
            new Map(
                listings.map((listing) => [guideLocationFilterKey(listing), guideAreaServedName(listing)])
            ).entries()
        ).sort((a, b) => a[1].localeCompare(b[1]));
    }, [listings]);

    const visible = listings.filter((listing) => {
        if (category && listing.service_category !== category) return false;
        if (requestedLocation && guideLocationFilterKey(listing) !== requestedLocation) return false;
        return matchesDuration(listing.duration_minutes, duration);
    });

    function setParam(key: string, value: string) {
        const next = new URLSearchParams(searchParams.toString());
        if (value) next.set(key, value);
        else next.delete(key);
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}#experiences` : `${pathname}#experiences`);
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6">
                <div className="flex flex-wrap gap-2">
                    <FilterChip
                        active={!category}
                        onClick={() => {
                            trackEvent("wildlife_experience_category_clicked", {service_category: "all"});
                            setParam("category", "");
                        }}
                    >
                        All experiences
                    </FilterChip>
                    {(Object.keys(GUIDE_CATEGORIES) as GuideCategory[]).map((id) => (
                        <FilterChip
                            key={id}
                            active={category === id}
                            onClick={() => {
                                trackEvent("wildlife_experience_category_clicked", {service_category: id});
                                setParam("category", id);
                            }}
                        >
                            {GUIDE_CATEGORIES[id]}
                        </FilterChip>
                    ))}
                </div>
                {(locations.length > 1 || duration !== "any") && (
                    <div className="flex flex-wrap gap-3">
                        {locations.length > 1 ? (
                            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.16em] text-ink-400">
                                Public area
                                <select
                                    value={requestedLocation}
                                    onChange={(event) => setParam("location", event.target.value)}
                                    className="min-h-11 rounded-full border border-white/15 bg-[#07100B] px-4 text-sm normal-case tracking-normal text-white"
                                >
                                    <option value="">Any listed area</option>
                                    {locations.map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.16em] text-ink-400">
                            Duration
                            <select
                                value={duration}
                                onChange={(event) => setDuration(event.target.value as DurationId)}
                                className="min-h-11 rounded-full border border-white/15 bg-[#07100B] px-4 text-sm normal-case tracking-normal text-white"
                            >
                                {DURATION_FILTERS.map((item) => (
                                    <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}
                <p className="text-sm text-ink-400">
                    {visible.length} published {visible.length === 1 ? "experience" : "experiences"}
                    {category ? ` in ${GUIDE_CATEGORIES[category]}` : ""}
                    {requestedLocation ? ` around ${locations.find(([key]) => key === requestedLocation)?.[1] || requestedLocation}` : ""}.
                </p>
            </div>

            {visible.length === 0 ? (
                <DirectoryEmpty
                    category={category}
                    categoryHasInventory={Boolean(category && listings.some((listing) => listing.service_category === category))}
                    onClear={() => {
                        setDuration("any");
                        router.replace(`${pathname}#experiences`);
                    }}
                />
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {visible.map((listing) => (
                        <ExperienceCard key={listing.id} listing={listing} locale={locale} />
                    ))}
                </div>
            )}
        </div>
    );
}

function DirectoryEmpty({
    category,
    categoryHasInventory,
    onClear
}: {
    category: GuideCategory | "";
    categoryHasInventory: boolean;
    onClear: () => void;
}) {
    const label = category ? GUIDE_CATEGORIES[category] : "";
    const scarce = Boolean(category && !categoryHasInventory);
    return (
        <div className="rounded-[1.35rem] border border-white/10 px-6 py-10">
            <h3 className="font-display text-3xl font-bold uppercase text-white">
                {scarce
                    ? `Looking for a ${label.toLowerCase()} experience?`
                    : category
                        ? `No matching ${label.toLowerCase()} experiences`
                        : "No matching experiences"}
            </h3>
            <p className="mt-3 max-w-xl text-ink-300">
                {scarce
                    ? "We’re still growing the Guide network. Nothing is published in this category yet."
                    : "Try another duration or clear the filter to see every published listing."}
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
                <button
                    type="button"
                    onClick={onClear}
                    className="font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-200"
                >
                    Browse all experiences
                </button>
                {scarce ? (
                    <Link
                        href="/become-a-wildlife-guide"
                        className="font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-200"
                    >
                        Become a Wildlife Guide
                    </Link>
                ) : null}
            </div>
        </div>
    );
}

function FilterChip({
    active,
    onClick,
    children
}: {
    active: boolean;
    onClick: () => void;
    children: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                active
                    ? "rounded-full bg-primary-400 px-4 py-2 text-sm font-semibold text-canvas-950"
                    : "rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-primary-300 hover:text-white"
            }
        >
            {children}
        </button>
    );
}
