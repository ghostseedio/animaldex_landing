import {rankingPages} from "@/data/rankings";
import RankingDetailPage, {generateMetadata as generateRankingMetadata} from "../../rankings/[slug]/page";

export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
    return rankingPages.flatMap((page) => [
        {locale: "en", slug: page.slug},
        {locale: "id", slug: page.slug}
    ]);
}

export const generateMetadata = generateRankingMetadata;

export default RankingDetailPage;
