import type {Metadata} from "next";
import {notFound} from "next/navigation";
import ArkHowItWorksView from "@/app/[locale]/(composited)/ark/how-it-works/ark-how-view";
import {generateMetadata as plainMetadata} from "@/app/[locale]/(composited)/ark/how-it-works/page";
import {arkLanguage} from "@/lib/ark-languages";

// /ark/how-it-works/lang/<language>: the pictures' captions in any of the Ark's 45 languages (lane ARK-SIMPLE; `?lang=` on
// the plain URL lands here, as /ark asks for a language). Static and revalidated hourly, built on first request; its
// canonical is the plain URL.
export const revalidate = 3600;

export function generateStaticParams() {
    return [];
}

type Props = {params: {locale: string; lang: string}};

export function generateMetadata({params}: Props): Promise<Metadata> {
    if (!arkLanguage(params.lang)) notFound();
    return plainMetadata({params: {locale: params.locale}});
}

export default async function Page({params}: Props) {
    const lang = arkLanguage(params.lang);
    if (!lang) notFound();
    return ArkHowItWorksView({locale: params.locale === "id" ? "id" : "en", lang});
}
