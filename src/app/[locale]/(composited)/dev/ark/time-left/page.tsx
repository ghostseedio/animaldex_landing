import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getArkWords} from "@/loaders/ark-words";
import ArkTimeLeftGallery from "./gallery-client";

/**
 * DEV ONLY: the life block (age, life stage, a life bar and "Estimated time left", decision 389, `lib/ark-time-left.ts`) on
 * the real Ark card and in Ark Lite, from a fixture world and fixture food-chain answers (no server, no database). 404s in production.
 *
 *   /dev/ark/time-left?animal=young|adult|old|hunted|hungry|safe|pet&view=card|lite[&grace=0|ahead|live][&lang=de]
 *
 * young: born aboard a month ago; adult: arrived, healthy; old: the old vole; hunted: a wild hedgehog with foxes about;
 * hungry: a starving fox; pet: a cat in a house (only old age). `grace=live` is the hunting protection as the live read
 * publishes it today (its end 183 Ark days ahead: the hunters are a reason and so is the protection); `grace=0` leaves it
 * out (an older server: the hunting factor is off); `grace=ahead` ends it at Ark day 300 (the fixture's day is 260).
 */

export const metadata: Metadata = {title: "Ark time left", robots: {index: false, follow: false}};

export default async function ArkTimeLeftGalleryPage({params, searchParams}: {params: {locale: string}; searchParams: {lang?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const {words, talk, language} = await getArkWords(params.locale, searchParams.lang ?? null);
    return <ArkTimeLeftGallery words={words} talk={talk} language={language} />;
}
