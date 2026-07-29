import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("identify-insects");
}

export default async function IdentifyInsectsPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "identify-insects", cmsSource: searchParams?.cmsSource === "1"});
}
