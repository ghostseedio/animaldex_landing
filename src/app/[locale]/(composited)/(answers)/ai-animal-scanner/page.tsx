import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("ai-animal-scanner", params.locale);
}

export default async function AiAnimalScannerPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "ai-animal-scanner", locale: params.locale});
}
