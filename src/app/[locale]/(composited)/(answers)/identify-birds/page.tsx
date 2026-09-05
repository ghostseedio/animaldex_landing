import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("identify-birds", params.locale);
}

export default async function IdentifyBirdsPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "identify-birds", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
