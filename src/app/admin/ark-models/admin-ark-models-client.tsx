"use client";

import {useCallback, useEffect, useState} from "react";
import type {ArkModelsPayload} from "@/app/api/admin/ark-models/route";
import {arkIconFallback, arkIconUrl, arkPlaceholderSlug} from "@/ark-scene/placeholder";
import {AdminPage, Alert, Badge, EmptyState, ListSkeleton, PageHeader, RefreshButton, Stat, StatGrid, StatGridSkeleton, Table, TD, TH} from "@/components/admin/ui";

/**
 * Species aboard the Ark that have no Ark model yet (owner decision A13):
 * the scene draws them as the neutral placeholder figure. The most animals
 * first: those are the models the Ark misses most.
 */
export default function AdminArkModelsClient() {
    const [data, setData] = useState<ArkModelsPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/ark-models", {cache: "no-store"});
            const payload = (await response.json()) as ArkModelsPayload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setData(payload);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load the list");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const species = data?.species ?? [];
    const animals = species.reduce((sum, row) => sum + row.animals, 0);

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Catalog"
                title="Ark models missing"
                description="Species aboard the Ark (or able to come aboard) that have no Ark model, neither their own nor their kind's. The Ark draws each as a neutral stand-in figure until its model is made. The most living aboard first, then the most worked steps."
                meta={data?.generatedAt ? <>Checked {data.generatedAt.replace("T", " ").slice(0, 19)} UTC · {data.source === "rpc" ? "voyage_missing_models_v1" : "generated"}</> : null}
                actions={<RefreshButton loading={loading} onClick={() => void load()} label="Re-check" />}
            />

            {error ? (
                <Alert tone="bad" title="The list could not be read." className="mt-6">
                    {error}
                </Alert>
            ) : null}
            {data?.note ? (
                <Alert tone="warn" className="mt-6">
                    {data.note}
                </Alert>
            ) : null}

            {data ? (
                <StatGrid className="mt-6" aria-label="Summary">
                    <Stat label="Species without a model" value={species.length} tone={species.length > 0 ? "warn" : undefined} />
                    <Stat label="Living animals drawn as stand-ins" value={animals} />
                    <Stat label="Models in the set" value={data.manifestSpecies ?? "—"} />
                </StatGrid>
            ) : loading && !error ? (
                <StatGridSkeleton count={3} className="mt-6" />
            ) : null}

            {!data && loading && !error ? <ListSkeleton rows={6} className="mt-6" /> : null}

            {data && !species.length ? (
                <EmptyState className="mt-6" title="Every species aboard has its model." />
            ) : null}

            {species.length ? (
                <div className="mt-6">
                    <Table minWidth={720}>
                        <thead>
                            <tr>
                                <TH>Species</TH>
                                <TH>Kind</TH>
                                <TH>Why</TH>
                                <TH numeric>Living</TH>
                                <TH numeric>Ever</TH>
                                <TH numeric>Worked steps</TH>
                            </tr>
                        </thead>
                        <tbody>
                            {species.map((row) => (
                                <tr key={row.speciesProfileId || row.name}>
                                    <TD>
                                        <span className="flex items-center gap-3">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={arkIconUrl(row.slug ?? arkPlaceholderSlug(row.speciesProfileId, row.name))} alt="" onError={arkIconFallback} width={28} height={28} className="h-7 w-7 rounded-full bg-[#f6f1e7] object-contain p-0.5" />
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold text-white">{row.animaldexNumber !== null ? <span className="mr-1.5 font-mono text-xs text-ink-400">#{row.animaldexNumber}</span> : null}{row.name}</span>
                                                {row.scientificName ? <span className="block truncate text-xs italic text-ink-400">{row.scientificName}</span> : null}
                                            </span>
                                        </span>
                                    </TD>
                                    <TD className="text-xs">{row.kindName ?? "—"}{row.slug ? <span className="block font-mono text-ink-400">{row.slug}</span> : null}</TD>
                                    <TD>
                                        <Badge tone={row.reason === "no_slug" ? "bad" : "warn"} className="normal-case tracking-normal">
                                            {row.reason === "no_slug" ? "No model slug" : row.reason === "not_in_manifest" ? "Not in the model set" : row.reason}
                                        </Badge>
                                    </TD>
                                    <TD numeric>{row.animals.toLocaleString()}</TD>
                                    <TD numeric>{row.animalsEver?.toLocaleString() ?? "—"}</TD>
                                    <TD numeric>{row.workedSteps?.toLocaleString() ?? "—"}</TD>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : null}
        </AdminPage>
    );
}
