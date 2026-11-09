import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getCompanionWords} from "@/loaders/companion-words";
import DebatesGalleryClient from "./gallery-client";

/**
 * DEV ONLY: the debate states the owner's 2026-11-09 report touched, drawn
 * by the real components from fixtures (no session, no server, no model).
 * 404s in production.
 *
 *   /dev/debates/gallery        the chosen way, back in the host's chat, Explore's card with 7 animals, the countdown
 *   /id/dev/debates/gallery     in Indonesian
 */

export const metadata: Metadata = {title: "Debates gallery", robots: {index: false, follow: false}};

export default async function DebatesGalleryPage({params}: {params: {locale: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return <DebatesGalleryClient words={await getCompanionWords(params.locale)} locale={params.locale} />;
}
