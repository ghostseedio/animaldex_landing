import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata() {
    return generateCollectorMetadata("custom-animal-card-deck");
}

export default async function CustomAnimalCardDeckPage() {
    return CollectorLandingPage({slug: "custom-animal-card-deck"});
}
