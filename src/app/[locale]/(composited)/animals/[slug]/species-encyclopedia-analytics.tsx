"use client";

import {useEffect} from "react";
import {trackEvent} from "@/lib/analytics";
import {SPECIES_ASK_FUNNEL_EVENTS} from "@/lib/species-ask";

export default function SpeciesEncyclopediaAnalytics({slug}: {slug: string}) {
    useEffect(() => {
        trackEvent(SPECIES_ASK_FUNNEL_EVENTS.pageViewed, {species_slug: slug});
    }, [slug]);

    return null;
}
