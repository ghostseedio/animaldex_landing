import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("animal-identifier-app", params.locale);
}

export default async function AnimalIdentifierAppPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "animal-identifier-app", locale: params.locale});
}
