import type {Metadata} from "next";
import SimulationPage from "@/components/seo/simulation-page";
import {localeConfig} from "@/i18n";
import {ANIMAL_SURVIVAL_PATH, SURVIVAL_PAGE_UPDATED, arkPageImage} from "@/lib/seo/ark-pages";
import {buildPageMetadata} from "@/lib/seo/page-metadata";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * /animal-survival (the "animal survival" SEO audit, 2026-11-27): see `src/components/seo/simulation-page.tsx`.
 * English and Indonesian. Its figures are the survival ranking's own weekly report, so like /tier-list/ark-survival it
 * is rendered on its first request (never in the build, which may not read the Ark) and cached an hour.
 */

export const revalidate = 3600;

export function generateStaticParams() {
    return [];
}

type Props = {params: {locale: string}};

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [page, seo] = await Promise.all([getPageWords(locale, "pages.animalSurvival"), getPageWords(locale, "seo")]);
    return buildPageMetadata({
        locale,
        path: ANIMAL_SURVIVAL_PATH,
        title: word(page, "metaTitle"),
        description: word(page, "metaDescription"),
        image: arkPageImage(),
        imageAlt: word(seo, "arkImageAlt"),
        type: "article",
        modifiedTime: SURVIVAL_PAGE_UPDATED
    });
}

export default async function AnimalSurvivalPage({params}: Props) {
    return SimulationPage({locale: pageLocale(params.locale), id: "animalSurvival"});
}
