"use client";

import {useEffect, useState} from "react";
import {DiscoverTimelineCard} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import type {DiscoverCaptureItem} from "@/data/discover-timeline";

/** The chip's one read, answered here: the first post's animal is aboard, the second's is not. */
const ABOARD_CAPTURE = "0a0a0a0a-0000-4000-8000-000000000001";
const ABOARD_ANIMAL = "5b0f2a9e-0f6e-4c1a-9a43-3a2d4f1b7c11";

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {headers: {"content-type": "application/json"}});
}

if (typeof window !== "undefined") {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith("/api/ark/capture-aboard")) {
            return Promise.resolve(jsonResponse({aboard: {[ABOARD_CAPTURE]: ABOARD_ANIMAL}}));
        }
        if (url.startsWith("/api/app/discover/ranking-siblings")) {
            return Promise.resolve(jsonResponse({items: [], hasMore: false, nextOffset: null}));
        }
        return original(input, init);
    };
}

function post(n: number, captureId: string, animalName: string): DiscoverCaptureItem {
    return {
        kind: "capture",
        id: `post-${n}`,
        captureId,
        date: "2026-11-18T01:00:00Z",
        capturedAt: "2026-11-18T01:00:00Z",
        sortRank: 2,
        activityBadge: "NEW",
        activityLine: null,
        title: null,
        notes: null,
        cardStyle: null,
        animalName,
        headlineSupportingName: null,
        lifeStageChip: null,
        sameSpeciesHelper: null,
        speciesSlug: "gray-wolf",
        speciesProfileId: null,
        normalizedIdentityKey: "gray-wolf",
        identityKind: null,
        identityKindLabel: null,
        identityExplanation: null,
        identityEvidenceGuidance: null,
        battleTier: "B",
        isEligibleCapture: true,
        hasUncertaintyFallback: false,
        isZooComparisonBanned: false,
        isChallengeAnalysisEligible: true,
        hasChallengeGameStats: true,
        score: 100,
        captureGrade: 8,
        gradeBreakdown: null,
        isUncertain: false,
        endorsementCount: 3,
        viewerEndorsementStat: null,
        rarity: 40,
        contextLabel: null,
        settingTag: "wild",
        humanContext: null,
        locationLabel: null,
        locationLat: null,
        locationLng: null,
        lifeStage: null,
        genderGuess: null,
        confidence: 0.95,
        typeTags: [],
        collector: {userId: `0a0a0a0a-1111-4000-8000-00000000000${n}`, name: n === 1 ? "Mara Okafor" : "Theo Lindqvist", username: n === 1 ? "maraok" : "theowild", avatarUrl: null, href: null},
        imageSrc: "/images/blog/what-if-every-animal-is-a-lesson/eurasian-wolf.webp",
        mediaAssets: [{
            id: `media-${n}`, kind: "photo", url: "/images/blog/what-if-every-animal-is-a-lesson/eurasian-wolf.webp", posterUrl: null,
            mimeType: "image/webp", durationMs: null, sortOrder: 0
        }],
        href: `/app/capture/${captureId}`,
        scientificName: "Canis lupus",
        breedGuess: null,
        conservationTier: null,
        totalProgressionXP: 120,
        level: 4,
        recentProgressionSource: null,
        animalDexNumber: 12,
        mediaCount: 1,
        hasVideoMedia: false,
        isMediaRefreshActivity: false,
        isChallengeReady: true,
        isChallengeAvailable: true,
        challengeHealth: 5,
        challengeStake: 2,
        learnedPrinciple: "Pack Coordination",
        coreLesson: null,
        learnedExpression: null,
        bestForTags: ["teamwork", "trust"],
        statBoosts: {},
        comparisonBoosts: {},
        endorsementBonuses: {},
        gameStats: {},
        effectiveGameStats: {},
        statDeltas: {}
    };
}

export default function DiscoverAboardClient({locale}: {locale: string}) {
    // ?narrow=1: a 320 px wide post, the smallest phone, where the chip has to go under the others.
    const [narrow, setNarrow] = useState(false);
    useEffect(() => setNarrow(new URLSearchParams(window.location.search).has("narrow")), []);
    return (
        <main className="flex min-h-screen flex-wrap items-start justify-center gap-6 bg-neutral-950 p-6">
            {[post(1, ABOARD_CAPTURE, "Gray Wolf"), post(2, "0a0a0a0a-0000-4000-8000-000000000002", "Gray Wolf")].map((item) => (
                <div key={item.id} className={`relative h-[760px] shrink-0 overflow-hidden rounded-3xl bg-black ${narrow ? "w-[320px]" : "w-[390px]"}`}>
                    <DiscoverTimelineCard item={item} locale={locale} viewerUserId={null} />
                </div>
            ))}
        </main>
    );
}
