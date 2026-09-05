import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("identify-reptiles", params.locale);
}

export default async function IdentifyReptilesPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "identify-reptiles", locale: params.locale});
}
