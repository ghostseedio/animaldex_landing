import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("identify-pets", params.locale);
}

export default async function IdentifyPetsPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "identify-pets", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
