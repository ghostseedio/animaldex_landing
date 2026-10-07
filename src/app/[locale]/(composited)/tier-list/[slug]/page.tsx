import {rankingPages} from "@/data/rankings";
import RankingDetailPage, {generateMetadata as generateRankingMetadata} from "../../rankings/[slug]/page";

export const revalidate = false;
export const dynamicParams = false;

// English only: the ranking bodies are untranslated, so /id/tier-list/<slug>
// 308s to the English page (see english-detail-routes.ts).
export function generateStaticParams() {
    return rankingPages.flatMap((page) => [
        {locale: "en", slug: page.slug}
    ]);
}

export const generateMetadata = generateRankingMetadata;

export default RankingDetailPage;
