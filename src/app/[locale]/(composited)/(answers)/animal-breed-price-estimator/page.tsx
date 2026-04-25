import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("animal-breed-price-estimator");
}

export default async function AnimalBreedPriceEstimatorPage() {
    return AnswerPage({slug: "animal-breed-price-estimator"});
}
