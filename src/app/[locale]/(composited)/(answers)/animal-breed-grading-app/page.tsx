import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("animal-breed-grading-app", params.locale);
}

export default async function AnimalBreedGradingAppPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "animal-breed-grading-app", locale: params.locale});
}
