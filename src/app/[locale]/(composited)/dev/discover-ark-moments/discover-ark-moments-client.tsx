"use client";

import {useState} from "react";
import ArkMomentPost from "@/components/ark-moments/ark-moment-post";
import {parseArkMoments, type ArkMoment, type ArkMomentWords} from "@/lib/ark-moments";

const FIXTURE_ANIMAL = "5b0f2a9e-0f6e-4c1a-9a43-3a2d4f1b7c11";

/** The contract's two fixture rows, as `discover_feed_ark_moments_v1` would return them. */
function fixtureRows(focus: string | null) {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600e3).toISOString();
    return [
        {
            moment_id: "0b6d7a51-3c1e-4f0a-9d2b-000000000001", kind: "your_young", tier: "own", slot: 5, happened_at: hoursAgo(2),
            ark_day: 210, species_profile_id: null, species_name: "Grey Crowned Crane", species_slug: "grey-crowned-crane",
            model_slug: "grey-crowned-crane", zone: "wetland", focus_animal_id: focus ?? FIXTURE_ANIMAL, facts: {young: 2, from_egg: true}, credit: null
        },
        {
            moment_id: "0b6d7a51-3c1e-4f0a-9d2b-000000000002", kind: "first_aboard", tier: "public", slot: 18, happened_at: hoursAgo(5),
            ark_day: 210, species_profile_id: null, species_name: "Song Sparrow", species_slug: "song-sparrow", model_slug: "song-sparrow",
            zone: "woodland", focus_animal_id: "5b0f2a9e-0f6e-4c1a-9a43-3a2d4f1b7c12", facts: {}, credit: {display_name: "Lena", handle: "lena"}
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
