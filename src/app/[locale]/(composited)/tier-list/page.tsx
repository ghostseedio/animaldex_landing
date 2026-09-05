import RankingsIndexPage, {generateMetadata as generateRankingsMetadata} from "../rankings/page";

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export const generateMetadata = generateRankingsMetadata;

export default RankingsIndexPage;
