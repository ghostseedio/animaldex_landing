import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getCompanionWords} from "@/loaders/companion-words";
import CompanionsGalleryClient from "./gallery-client";

/**
 * DEV ONLY: the Companions roster (DESIGN.md section 1) drawn by the real
 * page from fixtures, every row kind at once, so it can be looked at without
 * a session. 404s in production.
 *
 *   /dev/companions/gallery
 */

export const metadata: Metadata = {title: "Companions gallery", robots: {index: false, follow: false}};

export default async function CompanionsGalleryPage({params}: {params: {locale: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return <CompanionsGalleryClient words={await getCompanionWords(params.locale)} locale={params.locale} />;
}
