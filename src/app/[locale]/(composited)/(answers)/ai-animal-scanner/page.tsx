import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("ai-animal-scanner");
}

export default async function AiAnimalScannerPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "ai-animal-scanner", cmsSource: searchParams?.cmsSource === "1"});
}
