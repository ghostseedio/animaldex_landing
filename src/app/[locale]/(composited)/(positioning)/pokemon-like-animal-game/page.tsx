import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateCollectorMetadata("pokemon-like-animal-game", params.locale);
}

export default async function PokemonLikeAnimalGamePage({params}: {params: {locale: string}}) {
    return CollectorLandingPage({slug: "pokemon-like-animal-game", locale: params.locale});
}
