import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getArkWords} from "@/loaders/ark-words";
import ArkReleaseGallery from "./gallery-client";

/**
 * DEV ONLY: Release to the Wild (AnimalDex docs/ark/release-p1-8.md) on the real Ark card, from a fixture animal and
 * fixture answers of `/api/ark/release` in the server's own shapes (no server, no database, no Credit). 404s in production.
 *
 *   /dev/ark/release?look=offer|rescue|last|short|wait|full|refused|skill|off[&lang=de]
 *
 * offer: the reader's own zoo animal, eligible (tap the button for the sheet, then confirm). rescue: its kind is the
 * last one in the wild. last: it is the only one of its kind aboard and none is left in the wild. short: fewer Credits than the price. wait: one release a day. full: the wild has all of its
 * kind it can hold. refused: the quote says yes and the spend refuses (nothing charged). skill: an animal released two
 * Ark days ago, as everyone sees it. off: the server's switch is off (the card is as it was).
 */

export const metadata: Metadata = {title: "Ark release", robots: {index: false, follow: false}};

export default async function ArkReleaseGalleryPage({params, searchParams}: {params: {locale: string}; searchParams: {lang?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const {words, talk, language} = await getArkWords(params.locale, searchParams.lang ?? null);
    return <ArkReleaseGallery words={words} talk={talk} language={language} />;
}
