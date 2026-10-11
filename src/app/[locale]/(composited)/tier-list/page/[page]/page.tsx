import RankingsIndexPage, {generateMetadata as generateRankingsMetadata} from "../../../rankings/page";

// /tier-list/page/<n>: the hub's later list pages (src/data/hub-pagination.ts).
// The hub page reads `params.page`, checks it, and renders that page's lists.
export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export const generateMetadata = generateRankingsMetadata;

export default RankingsIndexPage;
