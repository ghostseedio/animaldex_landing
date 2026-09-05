import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("pokemon-like-animal-app", params.locale);
}

export default async function PokemonLikeAnimalAppPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "pokemon-like-animal-app", locale: params.locale});
}
