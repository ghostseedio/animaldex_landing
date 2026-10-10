import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import {animalFrequenciesPagination, parsePageParam} from "@/data/hub-pagination";
import {getLocalePath} from "@/lib/site";
import AnimalFrequenciesView, {animalFrequenciesPageCount, buildAnimalFrequenciesMetadata, loadAnimalFrequenciesIcons} from "../../animal-frequencies-view";

export const revalidate = 86400;

type Params = {locale: string; page: string};

export function generateStaticParams() {
    return [];
}

function resolvePage(value: string) {
    const page = parsePageParam(value);
    if (!page || page > animalFrequenciesPageCount) notFound();
    return page;
}

export function generateMetadata({params}: {params: Params}): Metadata {
    return buildAnimalFrequenciesMetadata(params.locale, resolvePage(params.page));
}

export default async function AnimalFrequenciesPagedPage({params}: {params: Params}) {
    const page = resolvePage(params.page);
    // Page 1 has exactly one URL: the hub. next.config.js 308s it before this
    // runs; this is the fallback if that rule is ever bypassed.
    if (page === 1) redirect(getLocalePath(params.locale, animalFrequenciesPagination.pagePath(1)));
    return <AnimalFrequenciesView locale={params.locale} page={page} icons={await loadAnimalFrequenciesIcons(page)} />;
}
