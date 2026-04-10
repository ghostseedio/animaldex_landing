import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata() {
    return generateCollectorMetadata("pokemon-like-animal-game");
}

export default async function PokemonLikeAnimalGamePage() {
    return CollectorLandingPage({slug: "pokemon-like-animal-game"});
}
