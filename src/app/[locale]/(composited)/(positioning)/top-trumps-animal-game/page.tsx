import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata() {
    return generateCollectorMetadata("top-trumps-animal-game");
}

export default async function TopTrumpsAnimalGamePage() {
    return CollectorLandingPage({slug: "top-trumps-animal-game"});
}
