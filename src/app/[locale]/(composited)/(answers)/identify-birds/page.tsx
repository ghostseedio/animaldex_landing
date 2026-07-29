import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("identify-birds");
}

export default async function IdentifyBirdsPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "identify-birds", cmsSource: searchParams?.cmsSource === "1"});
}
