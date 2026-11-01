import type {Metadata} from "next";
import {notFound, permanentRedirect} from "next/navigation";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAskDrawerLabels} from "@/loaders/ask-labels";
import {resolveTalkPage, talkCanonicalPath} from "@/data/talk-animals";
import {talkAnimalTitle, talkWords} from "@/lib/ask-animaldex/talk";
import {ogImagePath} from "@/lib/og/og-image";
import TalkChat from "@/app/[locale]/talk/talk-chat";

/**
 * /talk/<slug>: one animal's chat, full screen (docs/rich-chat/SPEC.md,
 * section 4.1). Rendered on demand and kept for a day, never generated
 * over the whole catalog at build time (the static build is already near its
 * limit). `noindex, follow`, with its canonical on the species page: 2,600
 * chat pages would only duplicate the species pages, which stay the SEO
 * pages. Its title still reads "Talk to a {Animal} — AnimalDex", for shares,
 * and it shares the animal's own card (WEB-14).
 *
 * A slug the Talk catalog lacks is resolved the way the species pages
 * resolve theirs (WEB-1, `resolveTalkPage`): the catalog animal a species
 * page is redirects there (/talk/lion → /talk/african-lion), and a species
 * page with no catalog animal opens its own chat, the one its drawer has,
 * so a chat link from any species page never lands on a 404.
 */

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

type Props = {params: {locale: string; slug: string}};

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const [resolution, messages] = await Promise.all([resolveTalkPage(params.slug), loadLocaleMessages(params.locale).catch(() => null)]);
    const words = talkWords(messages?.talkPage);
    const animal = resolution.kind === "catalog" || resolution.kind === "species" ? resolution.animal ?? null : null;
    const name = animal?.name ?? null;
    const title = name ? `${talkAnimalTitle(name, words)} — AnimalDex` : `${words.metaTitle} — AnimalDex`;
    const description = name
        ? (animal?.power ? words.animalDescription.replace("{animal}", name).replace("{power}", animal.power) : words.animalDescriptionNoPower.replace("{animal}", name))
        : words.metaDescription;
    const canonical = name ? await talkCanonicalPath(params.slug) : `/talk/${params.slug}`;
    const image = name ? ogImagePath("talk", params.slug) : ogImagePath("talk");
    const alt = name ? talkAnimalTitle(name, words) : words.ogAlt;
    return {
        title: {absolute: title},
        description,
        robots: {index: false, follow: true, googleBot: {index: false, follow: true}},
        alternates: {canonical: getLocalePath(params.locale, canonical)},
        openGraph: {
            type: "website",
            locale: getMetadataLocale(params.locale),
            title,
            description,
            url: getLocalePath(params.locale, `/talk/${params.slug}`),
            images: [{url: image, width: 1200, height: 630, alt}]
        },
        twitter: {card: "summary_large_image", title, description, images: [{url: image, alt}]}
    };
}

export default async function TalkAnimalPage({params}: Props) {
    const [resolution, messages, labels] = await Promise.all([
        resolveTalkPage(params.slug),
        loadLocaleMessages(params.locale).catch(() => null),
        getAskDrawerLabels(params.locale)
    ]);
    if (resolution.kind === "redirect") permanentRedirect(getLocalePath(params.locale, `/talk/${resolution.slug}`));
    if (resolution.kind === "none" || !resolution.animal) notFound();
    const animal = resolution.animal;
    return (
        <TalkChat
            key={params.slug}
            slug={params.slug}
            name={animal.name}
            power={animal.power}
            labels={labels}
            words={talkWords(messages?.talkPage)}
            locale={params.locale}
        />
    );
}
