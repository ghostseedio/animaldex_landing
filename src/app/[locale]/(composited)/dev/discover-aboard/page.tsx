import type {Metadata} from "next";
import {notFound} from "next/navigation";
import DiscoverAboardClient from "./discover-aboard-client";

/**
 * DEV ONLY: Explore's capture posts with the "Aboard the Ark" chip (board item, 2026-11-18), drawn by the real post
 * and the real chip from fixtures. The page answers the chip's one read itself (`/api/ark/capture-aboard`: the first
 * post's animal is aboard, the second's is not), so no session, server or database is needed. 404s in production.
 *
 *   /dev/discover-aboard
 */

export const metadata: Metadata = {title: "Aboard the Ark chip", robots: {index: false, follow: false}};

export default function DiscoverAboardPage({params}: {params: {locale: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return <DiscoverAboardClient locale={params.locale} />;
}
