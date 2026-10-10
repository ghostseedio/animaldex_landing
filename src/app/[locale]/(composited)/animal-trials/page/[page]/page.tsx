import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import {animalTrialsPagination, parsePageParam} from "@/data/hub-pagination";
import {getLocalePath} from "@/lib/site";
import AnimalTrialsView, {buildAnimalTrialsMetadata, animalTrialsPageCount} from "../../animal-trials-view";

export const revalidate = 86400;

type Params = {locale: string; page: string};

export function generateStaticParams() {
    return [];
}

function resolvePage(value: string) {
    const page = parsePageParam(value);
    if (!page || page > animalTrialsPageCount) notFound();
    return page;
}

export function generateMetadata({params}: {params: Params}): Metadata {
    return buildAnimalTrialsMetadata(params.locale, resolvePage(params.page));
}

export default function AnimalTrialsPagedPage({params}: {params: Params}) {
    const page = resolvePage(params.page);
    // Page 1 has exactly one URL: the hub. next.config.js 308s it before this
    // runs; this is the fallback if that rule is ever bypassed.
    if (page === 1) redirect(getLocalePath(params.locale, animalTrialsPagination.pagePath(1)));
    return <AnimalTrialsView locale={params.locale} page={page} />;
}
