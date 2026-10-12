import type {Metadata} from "next";
import {notFound} from "next/navigation";
import examples from "@/lib/trial-motion/__fixtures__/examples.json";
import {TrialCard as HubTrialCard} from "@/app/[locale]/(composited)/animal-trials/animal-trials-view";
import type {AnimalTrialEntry} from "@/data/animal-behaviours";
import TrialMotionPreviewClient from "./preview-client";
import {idCaptionFixture} from "./id-caption-fixtures";

/**
 * DEV ONLY: Trial Loops with the spec's worked examples injected, because every
 * live `motion_storyboard` is still NULL. 404s in production.
 *
 *   /dev/trial-motion                 every surface, every example
 *   /dev/trial-motion?only=koala-MID  one example
 *   /dev/trial-motion?detail=koala-MID  the Trial sheet, open
 *   /id/dev/trial-motion              the same with the Indonesian caption fixtures
 *                                     (grizzly-LOW is stale on purpose: English)
 *   /dev/trial-motion?sheet=koala-MID  the Discover post information sheet, open
 *   /dev/trial-motion?only=koala-MID&t=3.22  the full stage frozen at t (compare with qa/reference-frames)
 */

export const metadata: Metadata = {title: "Trial Loops preview", robots: {index: false, follow: false}};

type Example = {key: string; species: string; title: string; storyboard: unknown};

const SLUGS: Record<string, string> = {
    "cheetah-LOW": "cheetah",
    "koala-MID": "koala",
    "honeybee-MID": "western-honey-bee",
    "grizzly-LOW": "grizzly-bear",
    "sparrow-HIGH": "house-sparrow",
    "observation-sample": "cheetah"
};

export default function TrialMotionPreviewPage({params, searchParams}: {params: {locale: string}; searchParams: {only?: string; detail?: string; sheet?: string; t?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();

    const all = examples as Example[];
    const shown = searchParams.only ? all.filter((example) => example.key === searchParams.only) : all;

    return (
        <div className="px-5 py-10 sm:px-8">
            <div className="mx-auto max-w-6xl">
                <h1 className="font-display text-3xl text-white">Trial Loops preview</h1>
                <p className="mt-2 text-sm text-ink-300">Dev only. The spec&rsquo;s examples injected into the real components.</p>

                <h2 data-section="hub" className="mt-10 font-display text-2xl text-white">Animal Trials hub cards (server poster)</h2>
                <div className="mt-4 grid gap-px border border-line-300 bg-line-300 md:grid-cols-2 xl:grid-cols-3">
                    {shown.map((example) => {
                        const entry: AnimalTrialEntry = {
                            slug: SLUGS[example.key] ?? "cheetah",
                            species: example.species,
                            title: example.title,
                            objective: null,
                            instructions: "Instructions from the Trial row would sit here, under the loop.",
                            animalRule: null,
                            userBenefit: "What the Trial does for you.",
                            principleName: null,
                            mechanismConnection: "",
                            frequency: example.key.split("-")[1] ?? "MID",
                            difficulty: 2,
                            estimatedMinutes: 10,
                            completionCount: 0,
                            motionStoryboard: example.storyboard,
                            motionCaptionsId: idCaptionFixture(example.key)
                        };
                        return <HubTrialCard key={example.key} trial={entry} locale={params.locale} />;
                    })}
                </div>

                <TrialMotionPreviewClient
                    examples={shown}
                    detailKey={searchParams.detail ?? null}
                    sheetKey={searchParams.sheet ?? null}
                    freezeAt={searchParams.t != null && Number.isFinite(Number(searchParams.t)) ? Number(searchParams.t) : null}
                />
            </div>
        </div>
    );
}
