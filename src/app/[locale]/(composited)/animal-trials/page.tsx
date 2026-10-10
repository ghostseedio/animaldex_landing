import type {Metadata} from "next";
import AnimalTrialsView, {buildAnimalTrialsMetadata} from "./animal-trials-view";

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export function generateMetadata({params}: {params: {locale: string}}): Metadata {
    return buildAnimalTrialsMetadata(params.locale, 1);
}

export default function AnimalTrialsPage({params}: {params: {locale: string}}) {
    return <AnimalTrialsView locale={params.locale} page={1} />;
}
