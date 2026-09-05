import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("animal-breed-price-estimator", params.locale);
}

export default async function AnimalBreedPriceEstimatorPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "animal-breed-price-estimator", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
