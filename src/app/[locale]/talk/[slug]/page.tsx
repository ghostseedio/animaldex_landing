import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAskDrawerLabels} from "@/loaders/ask-labels";
import {getTalkAnimal} from "@/data/talk-animals";
import {talkAnimalTitle, talkWords} from "@/lib/ask-animaldex/talk";
import TalkChat from "@/app/[locale]/talk/talk-chat";

/**
 * /talk/<slug>: one animal's chat, full screen (docs/rich-chat/SPEC.md,
 * section 4.1). Rendered on demand and kept for a day, never generated
 * over the whole catalog at build time (the static build is already near its
 * limit). `noindex, follow`, with its canonical on the species page: 2,600
 * chat pages would only duplicate the species pages, which stay the SEO
 * pages. Its title still reads "Talk to a {Animal} — AnimalDex", for shares.
 */

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

type Props = {params: {locale: string; slug: string}};

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const [animal, messages] = await Promise.all([getTalkAnimal(params.slug), loadLocaleMessages(params.locale).catch(() => null)]);
    const words = talkWords(messages?.talkPage);
    const name = animal?.name ?? null;
    const title = name ? `${talkAnimalTitle(name, words)} — AnimalDex` : `${words.metaTitle} — AnimalDex`;
    const description = name
        ? (animal?.power ? words.animalDescription.replace("{animal}", name).replace("{power}", animal.power) : words.animalDescriptionNoPower.replace("{animal}", name))
        : words.metaDescription;
    return {
        title: {absolute: title},
        description,
        robots: {index: false, follow: true, googleBot: {index: false, follow: true}},
        alternates: {canonical: getLocalePath(params.locale, `/animals/${params.slug}`)},
        openGraph: {
            type: "website",
            locale: getMetadataLocale(params.locale),
            title,
            description,
            url: getLocalePath(params.locale, `/talk/${params.slug}`)
        },
        twitter: {card: "summary_large_image", title, description}
    };
}

export default async function TalkAnimalPage({params}: Props) {
    const [animal, messages, labels] = await Promise.all([
        getTalkAnimal(params.slug),
        loadLocaleMessages(params.locale).catch(() => null),
        getAskDrawerLabels(params.locale)
    ]);
    if (animal === null) notFound();
    return (
        <TalkChat
            key={params.slug}
            slug={params.slug}
            name={animal.name}
            labels={labels}
            words={talkWords(messages?.talkPage)}
            locale={params.locale}
        />
    );
}
