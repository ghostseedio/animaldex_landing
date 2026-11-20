import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {ArkBreedersView, arkBreedersMetadata} from "@/app/[locale]/(composited)/rankings/_components/ark-breeders-view";
import {arkLanguage} from "@/lib/ark-languages";

// /tier-list/ark-fastest-breeders/lang/<language>: the same page in any of the Ark's 45 languages (`?lang=<language>` on the plain
// URL redirects here, as /ark and the apps' web views ask for a language). Static and revalidated hourly, built on
// first request; not indexed (its canonical is the plain URL).
export const revalidate = 3600;

export function generateStaticParams() {
    return [];
}

type Props = {params: {locale: string; lang: string}};

export function generateMetadata({params}: Props): Promise<Metadata> {
    const lang = arkLanguage(params.lang);
    if (!lang) notFound();
    return arkBreedersMetadata({locale: params.locale, lang});
}

export default async function Page({params}: Props) {
    const lang = arkLanguage(params.lang);
    if (!lang) notFound();
    return ArkBreedersView({locale: params.locale, lang});
}
