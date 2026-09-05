import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("pokemon-like-animal-app", params.locale);
}

export default async function PokemonLikeAnimalAppPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "pokemon-like-animal-app", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
