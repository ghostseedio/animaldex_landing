import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("identify-reptiles");
}

export default async function IdentifyReptilesPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "identify-reptiles", cmsSource: searchParams?.cmsSource === "1"});
}
