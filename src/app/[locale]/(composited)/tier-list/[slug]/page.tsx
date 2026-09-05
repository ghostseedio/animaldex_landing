import RankingDetailPage, {generateMetadata as generateRankingMetadata} from "../../rankings/[slug]/page";

export const revalidate = 3600;

export function generateStaticParams() {
    return [];
}

export const generateMetadata = generateRankingMetadata;

export default RankingDetailPage;
