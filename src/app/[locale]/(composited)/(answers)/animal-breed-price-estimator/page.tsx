import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("animal-breed-price-estimator");
}

export default async function AnimalBreedPriceEstimatorPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "animal-breed-price-estimator", cmsSource: searchParams?.cmsSource === "1"});
}
