import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getArkWords} from "@/loaders/ark-words";
import ArkTimeLeftGallery from "./gallery-client";

/**
 * DEV ONLY: "Estimated time left" (decision 389, `lib/ark-time-left.ts`) on the real Ark card and in Ark Lite, from a fixture
 * world and fixture food-chain answers (no server, no database). 404s in production.
 *
 *   /dev/ark/time-left?animal=old|hunted|hungry|safe&view=card|lite[&grace=0|ahead][&lang=de]
 *
 * `grace=0` leaves out the hunting protection the server does not publish yet (today's read): the hunted animal then
 * shows no estimate, as on the live Ark. `grace=ahead` has the protection end at Ark day 300 (the fixture's day is 260):
 * the hunters and the protection are both reasons, and a hunted animal that is not otherwise at risk shows nothing yet.
 */

export const metadata: Metadata = {title: "Ark time left", robots: {index: false, follow: false}};

export default async function ArkTimeLeftGalleryPage({params, searchParams}: {params: {locale: string}; searchParams: {lang?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const {words, talk, language} = await getArkWords(params.locale, searchParams.lang ?? null);
    return <ArkTimeLeftGallery words={words} talk={talk} language={language} />;
}
