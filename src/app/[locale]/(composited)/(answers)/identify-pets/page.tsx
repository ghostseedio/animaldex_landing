import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("identify-pets", params.locale);
}

export default async function IdentifyPetsPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "identify-pets", locale: params.locale});
}
