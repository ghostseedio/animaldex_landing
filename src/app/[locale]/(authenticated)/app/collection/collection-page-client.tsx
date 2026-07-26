"use client";

import {useEffect, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import CollectionCatalog, {type CatalogSpecies} from "@/app/[locale]/(authenticated)/app/collection/collection-catalog";
import CollectionBindersPanel from "@/app/[locale]/(authenticated)/app/collection/collection-binders-panel";
import type {BinderIndexSummary, BinderProgress} from "@/data/collection-binder-types";
import type {CollectionDiscoveryStats} from "@/lib/collection-discovery";

type CollectionSegment = "catalog" | "binders";

function parseSegment(value: string | null): CollectionSegment {
    return value === "binders" ? "binders" : "catalog";
}

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
    const [segment, setSegment] = useState<CollectionSegment>(() => parseSegment(searchParams.get("segment")));

    useEffect(() => {
        setSegment(parseSegment(searchParams.get("segment")));
    }, [searchParams]);

    function selectSegment(next: CollectionSegment) {
        setSegment(next);
        const params = new URLSearchParams(searchParams.toString());
        if (next === "catalog") {
            params.delete("segment");
        } else {
            params.set("segment", "binders");
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    }

    return (
        <div className="space-y-6">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
                {([
                    ["catalog", "Catalog"],
                    ["binders", "Binders"]
                ] as const).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => selectSegment(id)}
                        className={`rounded-full px-4 py-2 text-sm font-black transition ${
                            segment === id ? "bg-white text-black" : "text-white/55 hover:text-white"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {segment === "catalog" ? (
                <CollectionCatalog species={species} discoveryStats={discoveryStats} />
            ) : (
                <CollectionBindersPanel binders={binders} summary={binderSummary} />
            )}
        </div>
    );
}
