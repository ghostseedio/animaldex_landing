import type {Metadata} from "next";
import AnimalBehavioursView, {buildAnimalBehavioursMetadata, loadAnimalBehavioursIcons} from "./animal-behaviours-view";

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export function generateMetadata({params}: {params: {locale: string}}): Metadata {
    return buildAnimalBehavioursMetadata(params.locale, 1);
}

export default async function AnimalBehavioursPage({params}: {params: {locale: string}}) {
    return <AnimalBehavioursView locale={params.locale} page={1} icons={await loadAnimalBehavioursIcons(1)} />;
}
