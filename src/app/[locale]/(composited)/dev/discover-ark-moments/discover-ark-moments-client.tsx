"use client";

import {useState} from "react";
import ArkMomentPost from "@/components/ark-moments/ark-moment-post";
import {parseArkMoments, type ArkMoment, type ArkMomentWords} from "@/lib/ark-moments";

/** Real living animals on production (contract "Fixture ids", read 2026-11-18). */
const FIXTURE_CRANE = "6dddabbf-de32-4ad2-bf8e-16e0f5ae6a93";
const FIXTURE_SPARROW = "695b894f-3c64-46d4-b869-cfb72ec24e7f";

/** The contract's two fixture rows, as `discover_feed_ark_moments_v1` would return them. */
function fixtureRows(focus: string | null) {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600e3).toISOString();
    return [
        {
            moment_id: "0b6d7a51-3c1e-4f0a-9d2b-000000000001", kind: "your_young", tier: "own", slot: 5, happened_at: hoursAgo(2),
            ark_day: 210, species_profile_id: "89f5c961-dc56-4a58-af01-a95a049df97c", species_name: "Grey Crowned Crane", species_slug: "grey-crowned-crane",
            model_slug: "grey-crowned-crane", zone: "wetland", focus_animal_id: focus ?? FIXTURE_CRANE, facts: {young: 2, from_egg: true}, credit: null
        },
        {
            moment_id: "0b6d7a51-3c1e-4f0a-9d2b-000000000002", kind: "first_aboard", tier: "public", slot: 18, happened_at: hoursAgo(5),
            ark_day: 210, species_profile_id: "c4f343ba-f174-4f86-b2c1-f4b9ed9f0b91", species_name: "Song Sparrow", species_slug: "song-sparrow", model_slug: "song-sparrow",
            zone: "farm_garden", focus_animal_id: FIXTURE_SPARROW, facts: {}, credit: {display_name: "Lena", handle: "lena"}
        }
    ];
}

export default function DiscoverArkMomentsClient({locale, words, view, focus}: {locale: string; words: ArkMomentWords; view: "own" | "public" | "all"; focus: string | null}) {
    const [moments] = useState<ArkMoment[]>(() => parseArkMoments(fixtureRows(focus)));
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
    const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
    const shown = moments.filter((m) => !hidden.has(m.id) && (view === "all" || m.tier === view));
    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center gap-6 overflow-auto bg-neutral-950" data-seen={Array.from(seen).join(",")}>
            {shown.map((moment) => (
                <div key={moment.id} className="relative h-[844px] w-[390px] shrink-0 overflow-hidden bg-black">
                    <ArkMomentPost
                        moment={moment}
                        words={words}
                        locale={locale}
                        onSeen={(m) => setSeen((current) => new Set(current).add(m.id))}
                        onDismiss={(m) => setHidden((current) => new Set(current).add(m.id))}
                    />
                </div>
            ))}
        </div>
    );
}
