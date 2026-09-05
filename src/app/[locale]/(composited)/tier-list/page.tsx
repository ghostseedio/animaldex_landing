import RankingsIndexPage, {generateMetadata as generateRankingsMetadata} from "../rankings/page";

export const revalidate = 3600;

export function generateStaticParams() {
    return [];
}

export const generateMetadata = generateRankingsMetadata;

export default RankingsIndexPage;
