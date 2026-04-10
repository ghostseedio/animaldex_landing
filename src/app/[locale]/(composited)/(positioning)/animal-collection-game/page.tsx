import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata() {
    return generateCollectorMetadata("animal-collection-game");
}

export default async function AnimalCollectionGamePage() {
    return CollectorLandingPage({slug: "animal-collection-game"});
}
