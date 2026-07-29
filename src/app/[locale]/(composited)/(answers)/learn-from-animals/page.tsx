import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("learn-from-animals");
}

export default async function LearnFromAnimalsPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "learn-from-animals", cmsSource: searchParams?.cmsSource === "1"});
}
