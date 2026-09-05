import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("sell-custom-animal-cards", params.locale);
}

export default async function SellCustomAnimalCardsPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "sell-custom-animal-cards", locale: params.locale});
}
