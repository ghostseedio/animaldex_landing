import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {loadLocaleMessages} from "@/loaders/locale";
import {arkMomentWords} from "@/lib/ark-moments";
import DiscoverArkMomentsClient from "./discover-ark-moments-client";

/**
 * DEV ONLY: the Discover Ark moment cards (lib/ark-moments.ts) drawn by the real post from the contract's two fixtures
 * (an own your_young Grey Crowned Crane, a public first_aboard Song Sparrow credited to Lena), at phone size. No
 * session, server RPC or database write: "Not now" and the seen mark stay on the page. 404s in production.
 *
 *   /dev/discover-ark-moments?view=own|public|all[&focus=<a living animal id>]
 */

export const metadata: Metadata = {title: "Ark moments", robots: {index: false, follow: false}};

export default async function DiscoverArkMomentsPage({params, searchParams}: {params: {locale: string}; searchParams?: {view?: string; focus?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const messages = await loadLocaleMessages(params.locale).catch(() => null);
    const view = searchParams?.view === "own" || searchParams?.view === "public" ? searchParams.view : "all";
    return <DiscoverArkMomentsClient locale={params.locale} words={arkMomentWords(messages)} view={view} focus={searchParams?.focus ?? null} />;
}
