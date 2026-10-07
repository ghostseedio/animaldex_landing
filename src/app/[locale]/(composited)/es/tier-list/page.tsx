import TranslatedTierListHub, {
    assertTranslatedHubLocale,
    buildTranslatedTierListHubMetadata
} from "@/app/[locale]/(composited)/rankings/_components/translated-tier-list-hub";

// Translated hub only (not a site locale): /es/tier-list. See
// src/data/tier-list-hub-translations.ts.
export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export function generateMetadata({params}: {params: {locale: string}}) {
    assertTranslatedHubLocale(params.locale);
    return buildTranslatedTierListHubMetadata("es");
}

export default function TierListHubPage({params}: {params: {locale: string}}) {
    assertTranslatedHubLocale(params.locale);
    return <TranslatedTierListHub language="es" />;
}
