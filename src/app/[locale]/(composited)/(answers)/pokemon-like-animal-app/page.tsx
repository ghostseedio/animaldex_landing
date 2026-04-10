import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("pokemon-like-animal-app");
}

export default async function PokemonLikeAnimalAppPage() {
    return AnswerPage({slug: "pokemon-like-animal-app"});
}
