import type {Metadata} from "next";
import ArkHowItWorksView from "@/app/[locale]/(composited)/ark/how-it-works/ark-how-view";
import {localeConfig} from "@/i18n";
import {ARK_HOW_IT_WORKS_PATH, ARK_PAGES_UPDATED, arkPageImage} from "@/lib/seo/ark-pages";
import {buildPageMetadata} from "@/lib/seo/page-metadata";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * /ark/how-it-works (SEO lane S3): how the Ark really works, in plain words,
 * from the server ecology (`supabase/functions/_shared/ark-ecology/`, the
 * captures + thrive design and the islands rules in the AnimalDex repo):
 * captures, the two islands, condition from steps, food chains, breeding,
 * seasons and lifespans, and what the Ark is not. English and Indonesian.
 *
 * Lane ARK-SIMPLE (owner 2026-11-20: "10x more visual then textual and feel super premium"): the rules first as pictures
 * (`ark-how-visual.tsx`: drawn scenes of the Ark's own species and stills, a caption each, in every Ark language), the
 * full text folded under "Read every rule".
 *
 * "How the Ark is kept fair" (P1-6, anti-staging; AnimalDex docs/ark/anti-staging-p1-6.md) is shown only once the Ark
 * publishes its year seeds (`/api/ark/seeds`, `voyage_year_seeds_public_v1`): the rules it describes are the ones the
 * server enforces from the moment the first year's fingerprint exists, so the page never describes a rule that is not
 * running. Until then the page is exactly what it was.
 */

export const revalidate = 3600;

export function generateStaticParams() {
    return localeConfig.locales.map((locale) => ({locale}));
}

type Props = {params: {locale: string}};

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [page, seo] = await Promise.all([getPageWords(locale, "pages.howItWorks"), getPageWords(locale, "seo")]);
    return buildPageMetadata({
        locale,
        path: ARK_HOW_IT_WORKS_PATH,
        title: word(page, "metaTitle"),
        description: word(page, "metaDescription"),
        image: arkPageImage(),
        imageAlt: word(seo, "arkImageAlt"),
        type: "article",
        modifiedTime: ARK_PAGES_UPDATED
    });
}

export default async function ArkHowItWorksPage({params}: Props) {
    return ArkHowItWorksView({locale: pageLocale(params.locale), lang: null});
}
