"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import type {SpeciesSystemDynamics} from "@/lib/system-dynamics";
import SystemDynamicsPanel from "@/components/animal-detail/system-dynamics/system-dynamics-panel";

/**
 * Mounts System Dynamics on the Learn tab of both the public species page and
 * the owned capture card.
 *
 * The fetch is client-side because the public animal page is fully static
 * (`revalidate = false`), and because the Pro gate is per-viewer: the route
 * decides entitlement and a locked viewer never receives the prose. A species
 * with no generated row renders nothing at all, exactly as on iOS.
 */
export default function SystemDynamicsSection({
    speciesProfileId,
    animalName
}: {
    speciesProfileId: string | null | undefined;
    animalName: string;
}) {
    const [dynamics, setDynamics] = useState<SpeciesSystemDynamics | null>(null);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        if (!speciesProfileId) return undefined;
        const controller = new AbortController();

        void (async () => {
            try {
                const response = await fetch(
                    `/api/app/system-dynamics?speciesProfileId=${encodeURIComponent(speciesProfileId)}`,
                    {headers: {Accept: "application/json"}, signal: controller.signal}
                );
                if (!response.ok) return;
                const payload = await response.json();
                setDynamics(payload.dynamics ?? null);
                setIsLocked(Boolean(payload.locked));
            } catch {
                // A failed load leaves the section blank rather than asserting
                // that this species has no System Dynamics.
            }
        })();

        return () => controller.abort();
    }, [speciesProfileId]);

    if (!speciesProfileId) return null;

    if (isLocked && dynamics) {
        // The same card iOS shows a free viewer, with the upgrade in place of the
        // "Explore" affordance. The payload carries the signature, frequency
        // profile, waveform and closing line — the interpretation is withheld
        // server-side, so nothing gated is in the page.
        return (
            <SystemDynamicsPanel
                dynamics={dynamics}
                animalName={animalName}
                locked
                lockedAction={(
                    <Link
                        href="/app/billing"
                        className="inline-flex min-h-11 w-fit items-center gap-2 bg-primary-400 px-5 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300"
                    >
                        Unlock with Pro
                        <span aria-hidden="true">→</span>
                    </Link>
                )}
            />
        );
    }

    if (!dynamics) return null;

    return <SystemDynamicsPanel dynamics={dynamics} animalName={animalName} />;
}
