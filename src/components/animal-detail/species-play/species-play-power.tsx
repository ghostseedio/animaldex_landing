"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {useAnimalPower} from "@/components/animal-detail/animal-powers/use-animal-power";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";
import {useSpeciesUnlock} from "@/components/animal-detail/animal-trials/use-species-unlock";
import {TrialRows} from "@/components/companions/step-views";
import {chatCaptureIdFor, useCompanionCards, useCompanions} from "@/components/companions/use-companions";
import {useTrialMotionCaptionLanguage} from "@/components/trial-motion/use-trial-motion-storyboard";
import type {AnimalTrial} from "@/lib/animal-trials";
import {bondPowerLine, companionRowHref, type CompanionWords} from "@/lib/companion-bond";

const NEON = "#A7F432";

/**
 * The species page's Play tab (3.2, docs/your-step/SPEC.md section 5): the
 * Power, read only, and "{name}'s Trials", each with its loop. A page about
 * the species earns nothing and starts nothing: a reader who holds the animal
 * gets "Talk to it", which opens its chat on their own card, where the steps
 * (and a Trial as a step) happen.
 *
 * The page is static, so who is reading arrives here, in the browser.
 */
export default function SpeciesPlayPower({
    speciesProfileId,
    animalName,
    powerName,
    coreLesson,
    words
}: {
    speciesProfileId: string | null | undefined;
    animalName: string;
    powerName: string | null;
    coreLesson: string | null;
    words: CompanionWords;
}) {
    const {power} = useAnimalPower(speciesProfileId);
    const unlock = useSpeciesUnlock([speciesProfileId]);
    const owns = unlock.unlocked === true;
    // Their chat with it, on the card they last talked through, else its newest.
    const {rows} = useCompanions(owns);
    const {cards} = useCompanionCards(owns);
    const row = owns && speciesProfileId ? rows.find((entry) => entry.speciesProfileId.toLowerCase() === speciesProfileId.toLowerCase()) ?? null : null;
    const talkHref = row
        ? companionRowHref({captureId: chatCaptureIdFor(cards, row.speciesProfileId, row.captureId), referralWaiting: false, referralId: null})
        : null;

    const [trials, setTrials] = useState<AnimalTrial[]>([]);
    const captionLanguage = useTrialMotionCaptionLanguage();
    useEffect(() => {
        if (!speciesProfileId) return;
        const controller = new AbortController();
        void fetch(`/api/app/animal-trials?speciesProfileId=${encodeURIComponent(speciesProfileId)}${captionLanguage ? `&lang=${captionLanguage}` : ""}`, {
            headers: {Accept: "application/json"},
            signal: controller.signal
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {trials?: AnimalTrial[]} | null) => setTrials(payload?.trials && Array.isArray(payload.trials) ? payload.trials : []))
            .catch(() => undefined);
        return () => controller.abort();
    }, [captionLanguage, speciesProfileId]);

    const name = power?.principleName ?? powerName;
    const lesson = power?.coreLesson ?? coreLesson;

    return (
        <div className="flex flex-col" data-testid="species-play-power">
            {name ? (
                <section className="flex flex-col gap-2 border-y border-white/[0.08] px-5 py-5">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{words.bond.itsPower}</h3>
                    <p className="font-display text-2xl font-black leading-tight text-white">
                        {speciesProfileId ? <AnimalPowerIcon speciesProfileId={speciesProfileId} /> : null}
                        {name}
                    </p>
                    {lesson ? <p className="text-sm leading-6 text-white/65">{lesson}</p> : null}
                    {owns && power ? (
                        <p className="text-sm leading-6" style={{color: power.isEarned ? NEON : "rgb(255 255 255 / 0.6)"}}>
                            {bondPowerLine({power: {name, earned: power.isEarned, via: power.earnedVia, at: power.earnedAt}}, animalName, words)}
                        </p>
                    ) : null}
                    {talkHref ? (
                        <Link
                            href={talkHref}
                            className="mt-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300"
                        >
                            {words.bond.talkToIt}
                        </Link>
                    ) : null}
                </section>
            ) : null}
            <TrialRows trials={trials} name={animalName} words={words} />
        </div>
    );
}
