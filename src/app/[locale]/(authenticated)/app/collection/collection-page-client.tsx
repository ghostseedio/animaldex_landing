"use client";

import CollectionCatalog, {type CatalogSpecies} from "@/app/[locale]/(authenticated)/app/collection/collection-catalog";
import type {CollectionDiscoveryStats} from "@/lib/collection-discovery";

export default function CollectionPageClient({
    species,
    discoveryStats
}: {
    species: CatalogSpecies[];
    discoveryStats: CollectionDiscoveryStats;
}) {
    return <CollectionCatalog species={species} discoveryStats={discoveryStats} />;
}
