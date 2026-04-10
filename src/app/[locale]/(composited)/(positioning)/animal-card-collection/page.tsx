import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata() {
    return generateCollectorMetadata("animal-card-collection");
}

export default async function AnimalCardCollectionPage() {
    return CollectorLandingPage({slug: "animal-card-collection"});
}
