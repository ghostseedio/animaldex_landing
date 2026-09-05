import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("ai-animal-scanner", params.locale);
}

export default async function AiAnimalScannerPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "ai-animal-scanner", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
