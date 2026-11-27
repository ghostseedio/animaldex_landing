import type {Metadata} from "next";
import SimulationPage from "@/components/seo/simulation-page";
import {localeConfig} from "@/i18n";
import {ANIMAL_SIMULATION_PATH, SIMULATION_PAGES_UPDATED, arkPageImage} from "@/lib/seo/ark-pages";
import {buildPageMetadata} from "@/lib/seo/page-metadata";
import {getPageWords, word} from "@/loaders/page-words";

/** /animal-simulation (SEO audit 2026-11-27): see `src/components/seo/simulation-page.tsx`. English and Indonesian. */

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
    const [page, seo] = await Promise.all([getPageWords(locale, "pages.animalSimulation"), getPageWords(locale, "seo")]);
    return buildPageMetadata({
        locale,
        path: ANIMAL_SIMULATION_PATH,
        title: word(page, "metaTitle"),
        description: word(page, "metaDescription"),
        image: arkPageImage(),
        imageAlt: word(seo, "arkImageAlt"),
        type: "article",
        modifiedTime: SIMULATION_PAGES_UPDATED
    });
}

export default async function AnimalSimulationPage({params}: Props) {
    return SimulationPage({locale: pageLocale(params.locale), id: "animalSimulation"});
}
