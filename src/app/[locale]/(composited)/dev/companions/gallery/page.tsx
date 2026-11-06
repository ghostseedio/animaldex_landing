import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getCompanionWords} from "@/loaders/companion-words";
import {loadLocaleMessages} from "@/loaders/locale";
import {talkFrontDoorWords} from "@/lib/talk-front-door";
import {TALK_FEATURED_SLUGS, talkNameFromSlug} from "@/lib/ask-animaldex/talk";
import CompanionsGalleryClient from "./gallery-client";

/**
 * DEV ONLY: the Companions roster (DESIGN.md section 1) drawn by the real
 * page from fixtures, every row kind at once, so it can be looked at without
 * a session. 404s in production.
 *
 *   /dev/companions/gallery
 *   /dev/companions/gallery?frontDoor=1   with the Talk front door
 */

export const metadata: Metadata = {title: "Companions gallery", robots: {index: false, follow: false}};

export default async function CompanionsGalleryPage({params, searchParams}: {params: {locale: string}; searchParams?: {frontDoor?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const messages = searchParams?.frontDoor === "1" ? await loadLocaleMessages(params.locale).catch(() => null) : null;
    // The featured animals by name only: the gallery reads nothing from the server.
    const frontDoor = messages
        ? {words: talkFrontDoorWords(messages.talkFrontDoor), featured: TALK_FEATURED_SLUGS.map((slug) => ({slug, name: talkNameFromSlug(slug), power: null}))}
        : null;
    return <CompanionsGalleryClient words={await getCompanionWords(params.locale)} locale={params.locale} frontDoor={frontDoor} />;
}
