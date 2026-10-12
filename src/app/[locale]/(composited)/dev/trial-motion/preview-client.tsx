"use client";

import {useMemo, useState} from "react";
import {type AnimalTrial, decodeAnimalTrial} from "@/lib/animal-trials";
import {TrialCard} from "@/components/animal-detail/animal-trials/animal-trials-section";
import AnimalTrialDetail from "@/components/animal-detail/animal-trials/animal-trial-detail";
import AnimalTrialCard from "@/app/[locale]/(authenticated)/app/_components/discover-animal-trial-card";
import {PostInformation} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import {primeTrialMotionStoryboard} from "@/components/trial-motion/use-trial-motion-storyboard";
import TrialMotion from "@/components/trial-motion/trial-motion";
import type {DiscoverAnimalTrialItem} from "@/data/discover-timeline";

/** DEV ONLY: the client surfaces of the Trial Loops preview. */

type Example = {key: string; species: string; title: string; storyboard: unknown};

const fakeId = (index: number) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

function frequencyOf(key: string) {
    const frequency = key.split("-")[1];
    return frequency === "LOW" || frequency === "HIGH" ? frequency : "MID";
}

export default function TrialMotionPreviewClient({examples, detailKey, sheetKey, freezeAt}: {examples: Example[]; detailKey: string | null; sheetKey: string | null; freezeAt: number | null}) {
    const trials = useMemo(() => examples.map((example, index) => decodeAnimalTrial({
        species_profile_id: fakeId(index),
        frequency: frequencyOf(example.key),
        species_display_name: example.species,
        title: example.title,
        instructions: "The Trial's own instructions, in full, under the loop. The loop shows the action; these words say it.",
        user_benefit: "What doing it gives you.",
        animal_rule: "The animal's rule.",
        proof_types: ["photo"],
        primary_proof_type: "photo",
        proof_prompt: "One photo of the result.",
        estimated_minutes: 10,
        reward_class: "xp",
        reward_credits: 1,
        status: "notStarted",
        motion_storyboard: example.storyboard
    })).filter((trial): trial is AnimalTrial => trial !== null), [examples]);

    const [openKey, setOpenKey] = useState<string | null>(detailKey);
    const openIndex = examples.findIndex((example) => example.key === openKey);
    const openTrial = openIndex >= 0 ? trials[openIndex] : null;

    const discoverItems = useMemo(() => examples.map((example, index): DiscoverAnimalTrialItem => {
        primeTrialMotionStoryboard(fakeId(index), frequencyOf(example.key), example.storyboard);
        return {
            kind: "animal-trial",
            id: `preview-${index}`,
            postId: `preview-${index}`,
            date: new Date().toISOString(),
            sortRank: 5,
            speciesProfileId: fakeId(index),
            title: example.title,
            speciesName: example.species,
            principleName: "",
            frequency: frequencyOf(example.key),
            proofType: "text",
            rewardXP: 10,
            rewardCredits: 0,
            isFailed: false,
            collector: {userId: "preview", name: "Preview Collector", username: "preview", avatarUrl: null, href: null},
            evidenceSrc: null,
            href: "#"
        };
    }), [examples]);

    return (
        <>
            <h2 data-section="cards" className="mt-12 font-display text-2xl text-white">Trial cards (animal page, Play tab): compact</h2>
            <div className="mt-4 grid max-w-xl border border-white/[0.08]">
                {trials.map((trial, index) => (
                    <TrialCard key={examples[index].key} trial={trial} onOpen={() => setOpenKey(examples[index].key)} />
                ))}
                {trials[0] ? (
                    <TrialCard key="locked" trial={trials[0]} lockedByTraining onOpen={() => undefined} />
                ) : null}
            </div>

            <h2 data-section="full" className="mt-12 font-display text-2xl text-white">Full loop with steps</h2>
            <div className="mt-4 grid gap-8 md:grid-cols-2">
                {trials.map((trial, index) => (
                    <div key={examples[index].key} data-key={examples[index].key}>
                        <p className="mb-2 text-xs text-ink-400">{examples[index].key}</p>
                        <TrialMotion storyboard={trial.motionStoryboard} freezeAt={freezeAt} />
                    </div>
                ))}
            </div>

            <h2 data-section="discover" className="mt-12 font-display text-2xl text-white">Discover: a text-answer Trial post</h2>
            <div className="mt-4 grid max-w-md gap-6">
                {discoverItems.slice(0, 2).map((item) => <AnimalTrialCard key={item.id} item={item} viewerUserId={null} />)}
            </div>

            {sheetKey && examples.findIndex((example) => example.key === sheetKey) >= 0 ? (
                <PostInformation
                    item={discoverItems[examples.findIndex((example) => example.key === sheetKey)]}
                    locale="en"
                    onClose={() => undefined}
                />
            ) : null}

            {openTrial ? (
                <AnimalTrialDetail trial={openTrial} canAttempt onChange={() => undefined} onClose={() => setOpenKey(null)} />
            ) : null}
        </>
    );
}
