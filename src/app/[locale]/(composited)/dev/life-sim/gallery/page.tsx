import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getCompanionWords} from "@/loaders/companion-words";
import LifeSimGalleryClient from "./gallery-client";

/**
 * DEV ONLY: Life Sim (AnimalDex docs/life-sim/CONTRACT.md) drawn by the real
 * components from fixtures, so it can be looked at without a session, a
 * server with the Ark migration, or a model. 404s in production.
 *
 *   /dev/life-sim/gallery                  every state at once
 *   /dev/life-sim/gallery?currency=GBP     Money in another display currency
 *   /dev/life-sim/gallery?teen=1           the Diary of a teen (private, no public option)
 *   /dev/life-sim/gallery?arkfounder=1     after "I've done it": the founders' story moment under the step's
 *                                          thrive line (D6), prefilled with the step; =name the name question
 *                                          first, =adult the 18+ tap, =shared already shared (nothing is sent)
 *   /id/dev/life-sim/gallery               in Indonesian
 */

export const metadata: Metadata = {title: "Life Sim gallery", robots: {index: false, follow: false}};

export default async function LifeSimGalleryPage({params, searchParams}: {params: {locale: string}; searchParams?: {currency?: string; teen?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return (
        <LifeSimGalleryClient
            words={await getCompanionWords(params.locale)}
            locale={params.locale}
            currency={(searchParams?.currency ?? "USD").toUpperCase()}
            teen={searchParams?.teen === "1"}
        />
    );
}
