import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getCompanionWords} from "@/loaders/companion-words";
import TalkGalleryClient from "./gallery-client";

/**
 * DEV ONLY: every new state of the rich chat and of debates in the thread
 * (docs/rich-chat/SPEC.md, sections 1.4 and 2), drawn from fixtures with the
 * real components, so they can be looked at without a session or a model.
 * 404s in production.
 *
 *   /dev/speak-to-animal/gallery              dark (the site's default)
 *   /dev/speak-to-animal/gallery?theme=light  the light theme
 */

export const metadata: Metadata = {title: "Rich chat and debates gallery", robots: {index: false, follow: false}};

export default async function TalkGalleryPage({params}: {params: {locale: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return <TalkGalleryClient words={await getCompanionWords(params.locale)} locale={params.locale} />;
}
