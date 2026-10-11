import AnimalHybridsIndexPage, {generateMetadata as generateHybridsMetadata} from "../../page";

// /animal-hybrids/page/<n>: the lab's later card pages (src/data/hub-pagination.ts).
// The hub page reads `params.page`, checks it, and renders that page's cards.
export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

export const generateMetadata = generateHybridsMetadata;

export default AnimalHybridsIndexPage;
