import type {Metadata} from "next";
import ChallengeYourselfView, {buildChallengeYourselfMetadata} from "./challenge-yourself-view";

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export function generateMetadata({params}: {params: {locale: string}}): Metadata {
    return buildChallengeYourselfMetadata(params.locale, 1);
}

export default function ChallengeYourselfPage({params}: {params: {locale: string}}) {
    return <ChallengeYourselfView locale={params.locale} page={1} />;
}
