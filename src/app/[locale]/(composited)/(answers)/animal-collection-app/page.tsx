import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("animal-collection-app", params.locale);
}

export default async function AnimalCollectionAppPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "animal-collection-app", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
