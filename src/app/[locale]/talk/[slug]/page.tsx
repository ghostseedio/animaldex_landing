import type {Metadata} from "next";
import {notFound, permanentRedirect} from "next/navigation";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {loadLocaleMessages} from "@/loaders/locale";
import {resolveTalkPage, talkCanonicalPath} from "@/data/talk-animals";
import {talkAnimalTitle, talkWords} from "@/lib/ask-animaldex/talk";
import {ogImagePath} from "@/lib/og/og-image";
import {templateSafeTitle, withBrandSuffix} from "@/lib/brand-title";
import {englishOnlyLanguageAlternates} from "@/lib/content-metadata";
import {getTalkLandingPage, getTalkLandingStaticParams, isTalkLandingSlug, type TalkLandingPage} from "@/data/talk-landing-pages";
import TalkChat from "@/app/[locale]/talk/talk-chat";
import TalkLanding from "@/app/[locale]/talk/[slug]/talk-landing";

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
 *
 * The exception (CC 5): the species in `talk-landing-species.json` (the ones
 * people talk to most, and the tier lists' #1s) are indexable landing pages,
 * prerendered at build from the species snapshots alone (the SSG contract:
 * never the catalogue), English only, canonical to themselves, kept for a
 * day. Their HTML is the landing; a signed-in reader, or one arriving with
 * `?card=`, `?ask=` or `?chat=1`, gets the same full-screen chat as before
 * (`TalkLandingSwitch`). Every other slug is as above.
 */

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
    // The landing pages only; every other chat renders on demand.
    return getTalkLandingStaticParams();
}

type Props = {params: {locale: string; slug: string}};

/** The landing page's metadata (CC 5): indexable, English, its own canonical; the share card is the chat's. */
function talkLandingMetadata(page: TalkLandingPage, locale: string): Metadata {
    const path = `/talk/${page.slug}`;
    const image = ogImagePath("talk", page.slug);
    const title = withBrandSuffix(page.title);
    return {
        title: templateSafeTitle(page.title),
        description: page.description,
        // English only, like the collapsed detail families: the facts are English, so no /id twin is advertised.
        alternates: englishOnlyLanguageAlternates(path),
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title,
            description: page.description,
            url: getLocalePath("en", path),
            siteName: "AnimalDex",
            images: [{url: image, width: 1200, height: 630, alt: page.heading}]
        },
        twitter: {card: "summary_large_image", title, description: page.description, images: [{url: image, alt: page.heading}]}
    };
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const landing = getTalkLandingPage(params.slug);
    if (landing) return talkLandingMetadata(landing, params.locale);
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

/**
 * The page's own payload is the animal alone (its words and the chat's
 * labels come once with the layout, `TalkShell`): a switch between chats
 * downloads a few hundred bytes.
 */
export default async function TalkAnimalPage({params}: Props) {
    // A landing slug never reads the catalogue: its page is the snapshot's (SSG contract).
    if (isTalkLandingSlug(params.slug)) {
        const landing = getTalkLandingPage(params.slug);
        // Awaited, not written as JSX: this React type version has no async component type.
        if (landing) return await TalkLanding({page: landing, locale: params.locale});
    }
    const resolution = await resolveTalkPage(params.slug);
    if (resolution.kind === "redirect") permanentRedirect(getLocalePath(params.locale, `/talk/${resolution.slug}`));
    if (resolution.kind === "none" || !resolution.animal) notFound();
    const animal = resolution.animal;
    return (
        <TalkChat
            key={params.slug}
            slug={params.slug}
            name={animal.name}
            power={animal.power}
            locale={params.locale}
        />
    );
}
