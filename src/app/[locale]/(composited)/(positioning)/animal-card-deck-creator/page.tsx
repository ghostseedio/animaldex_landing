import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateCollectorMetadata("animal-card-deck-creator", params.locale);
}

export default async function AnimalCardDeckCreatorPage({params}: {params: {locale: string}}) {
    return CollectorLandingPage({slug: "animal-card-deck-creator", locale: params.locale});
}
