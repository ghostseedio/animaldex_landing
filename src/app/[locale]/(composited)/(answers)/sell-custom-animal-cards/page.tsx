import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("sell-custom-animal-cards", params.locale);
}

export default async function SellCustomAnimalCardsPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "sell-custom-animal-cards", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
