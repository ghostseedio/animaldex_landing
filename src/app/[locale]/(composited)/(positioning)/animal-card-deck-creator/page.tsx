import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata() {
    return generateCollectorMetadata("animal-card-deck-creator");
}

export default async function AnimalCardDeckCreatorPage() {
    return CollectorLandingPage({slug: "animal-card-deck-creator"});
}
