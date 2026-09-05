import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("animal-breed-price-estimator", params.locale);
}

export default async function AnimalBreedPriceEstimatorPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "animal-breed-price-estimator", locale: params.locale});
}
