import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateCollectorMetadata("custom-animal-card-deck", params.locale);
}

export default async function CustomAnimalCardDeckPage({params}: {params: {locale: string}}) {
    return CollectorLandingPage({slug: "custom-animal-card-deck", locale: params.locale});
}
