"use client";

import {usePathname, useRouter, useSearchParams} from "next/navigation";
import CollectionCatalog, {type CatalogSpecies, type ContentMode} from "@/app/[locale]/(authenticated)/app/collection/collection-catalog";
import CollectionBindersPanel from "@/app/[locale]/(authenticated)/app/collection/collection-binders-panel";
import type {BinderIndexSummary, BinderProgress} from "@/data/collection-binder-types";
import type {CollectionDiscoveryStats} from "@/lib/collection-discovery";

/**
 * The Collection: the Catalog, with the binders folded into it as a filter
 * (docs/companion-loop/SPEC.md, phase 4) instead of a Catalog | Binders
 * switch. `?segment=binders` still opens on the binders.
 */
export default function CollectionPageClient({
    species,
    discoveryStats,
    binders,
    binderSummary
}: {
    species: CatalogSpecies[];
    discoveryStats: CollectionDiscoveryStats;
    binders: BinderProgress[];
    binderSummary: BinderIndexSummary;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const initialMode: ContentMode = searchParams.get("segment") === "binders" ? "binders" : "animals";

    function rememberMode(mode: ContentMode) {
        const params = new URLSearchParams(searchParams.toString());
        if (mode === "binders") params.set("segment", "binders");
        else params.delete("segment");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    }

    return (
        <div className="space-y-6">
            <CollectionCatalog
                species={species}
                discoveryStats={discoveryStats}
                bindersPanel={<CollectionBindersPanel binders={binders} summary={binderSummary} />}
                initialContentMode={initialMode}
                onContentModeChange={rememberMode}
            />
        </div>
    );
}
