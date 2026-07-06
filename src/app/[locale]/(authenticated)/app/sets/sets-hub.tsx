"use client";

import {useMemo, useState} from "react";
import {AppEmpty, AppSectionTitle} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import PowerSetCard from "@/app/[locale]/(authenticated)/app/sets/power-set-card";
import type {PowerSetAlbum} from "@/data/power-sets";

const PAGE_SIZE = 8;

function setSortRank(album: PowerSetAlbum) {
    if (album.isCompleted) return 2;
    if (album.progressPercent >= 80 || album.isNearComplete) return 0;
    return 1;
}

function sortActiveSets(albums: PowerSetAlbum[]) {
    return [...albums].sort((left, right) => {
        const leftRank = setSortRank(left);
        const rightRank = setSortRank(right);

        if (leftRank !== rightRank) {
            return leftRank - rightRank;
        }

        if (left.progressPercent !== right.progressPercent) {
            return right.progressPercent - left.progressPercent;
        }

        return left.title.localeCompare(right.title);
    });
}

export default function SetsHub({activeSets, completedSets}: {activeSets: PowerSetAlbum[]; completedSets: PowerSetAlbum[]}) {
    const [visibleActiveCount, setVisibleActiveCount] = useState(PAGE_SIZE);
    const [visibleCompletedCount, setVisibleCompletedCount] = useState(PAGE_SIZE);

    const sortedActive = useMemo(() => sortActiveSets(activeSets), [activeSets]);
    const sortedCompleted = useMemo(
        () => [...completedSets].sort((left, right) => right.found - left.found || left.title.localeCompare(right.title)),
        [completedSets]
    );

    if (sortedActive.length === 0 && sortedCompleted.length === 0) {
        return (
            <AppEmpty
                icon="sets"
                title="No power sets yet"
                detail="Capture animals, build your Wild Profile, or browse Collection → Powers to unlock quality-based sets like Protection or Focus."
            />
        );
    }

    return (
        <>
            {sortedActive.length > 0 ? (
                <section className="space-y-4">
                    <AppSectionTitle icon="sets" title="In progress" detail="Sets surfaced from your Apex path, Best For chart, and starter powers." />
                    <div className="grid gap-4 lg:grid-cols-2">
                        {sortedActive.slice(0, visibleActiveCount).map((album) => (
                            <PowerSetCard key={album.key} album={album} />
                        ))}
                    </div>
                    {visibleActiveCount < sortedActive.length ? (
                        <button
                            type="button"
                            onClick={() => setVisibleActiveCount((count) => Math.min(sortedActive.length, count + PAGE_SIZE))}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-primary-200 transition hover:border-white/20"
                        >
                            Load more ({sortedActive.length - visibleActiveCount} remaining)
                        </button>
                    ) : null}
                </section>
            ) : null}

            {sortedCompleted.length > 0 ? (
                <section className="space-y-4">
                    <AppSectionTitle icon="check" title="Completed" detail="Silver sets stay here. Gold mastered sets show a crown badge on the card." />
                    <div className="grid gap-4 lg:grid-cols-2">
                        {sortedCompleted.slice(0, visibleCompletedCount).map((album) => (
                            <PowerSetCard key={album.key} album={album} />
                        ))}
                    </div>
                    {visibleCompletedCount < sortedCompleted.length ? (
                        <button
                            type="button"
                            onClick={() => setVisibleCompletedCount((count) => Math.min(sortedCompleted.length, count + PAGE_SIZE))}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-primary-200 transition hover:border-white/20"
                        >
                            Load more ({sortedCompleted.length - visibleCompletedCount} remaining)
                        </button>
                    ) : null}
                </section>
            ) : null}
        </>
    );
}
