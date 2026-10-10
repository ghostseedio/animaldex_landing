import type {Metadata} from "next";
import AnimalFrequenciesView, {buildAnimalFrequenciesMetadata, loadAnimalFrequenciesIcons} from "./animal-frequencies-view";

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export function generateMetadata({params}: {params: {locale: string}}): Metadata {
    return buildAnimalFrequenciesMetadata(params.locale, 1);
}

export default async function AnimalFrequenciesPage({params}: {params: {locale: string}}) {
    return <AnimalFrequenciesView locale={params.locale} page={1} icons={await loadAnimalFrequenciesIcons(1)} />;
}
