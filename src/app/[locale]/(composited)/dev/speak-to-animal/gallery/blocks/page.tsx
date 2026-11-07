import type {Metadata} from "next";
import {notFound} from "next/navigation";
import ChatBlocksGalleryClient from "./blocks-client";

/**
 * DEV ONLY: a reply's own pictures (`animal-chat-blocks.tsx` and the rich
 * rules of 2026-11-07), each with the same words drawn as replies were before,
 * from fixtures with the real components. Nothing reaches a model. 404s in
 * production.
 *
 *   /dev/speak-to-animal/gallery/blocks                    every page side by side
 *   /dev/speak-to-animal/gallery/blocks?page=chatloop      one page, the width of the window
 *   /dev/speak-to-animal/gallery/blocks?page=chatloop&theme=light
 *
 * Pages: richidea / richideaplain (an idea with its twist sketched in a text
 * diagram, and as plain paragraphs), chatloop / chatloopplain (the animal's
 * kind doing it, one of its Trial loops, and the same words alone),
 * chatimage / chatimageplain (its Power's icon and a contrasting species'
 * art, and the same words alone); chatnothing (a species without art, a
 * Trial it does not have, a picture that is not ours and a loop with no chat
 * animal: none of them draws anything).
 */

export const metadata: Metadata = {title: "Chat pictures gallery", robots: {index: false, follow: false}};

export default function ChatBlocksGalleryPageRoute({searchParams}: {searchParams: {page?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return <ChatBlocksGalleryClient page={searchParams.page ?? null} />;
}
