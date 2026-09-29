"use client";

import {useEffect, useState} from "react";
import {type AnimalPower, earnedLabel} from "@/lib/animal-powers";
import {domainDisplayTitle, normalizeDomain} from "@/lib/system-dynamics";

/**
 * "My Animal Powers" on the profile, ported from iOS `MyAnimalPowersSection`.
 *
 * This is the second axis the profile did not have. "184 animals" says how much
 * somebody has seen; "37 Powers" says how many of them taught them something
 * they then went and did. One describes a collection, the other describes a
 * person.
 *
 * THE DENOMINATOR IS ANIMALS MET, not the catalogue. Powers are close to 1:1
 * with species, so "37 of 2,492" would just be the species counter again, with
 * a demoralising denominator. "37 of the 184 animals you have met" is the
 * honest comparison and it grows with the person rather than ahead of them.
 */

const NEON = "#A7F432";

export default function MyAnimalPowersSection({
    animalsMet,
    title = "My Animal Powers"
}: {
    /** Distinct species this person has actually captured — the denominator. */
    animalsMet: number;
    title?: string;
}) {
    const [powers, setPowers] = useState<AnimalPower[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        void (async () => {
            try {
                const response = await fetch("/api/app/animal-powers?earned=1", {
                    headers: {Accept: "application/json"},
                    cache: "no-store",
                    signal: controller.signal
                });
                if (!response.ok) return;
                const payload = await response.json();
                setPowers(Array.isArray(payload.powers) ? payload.powers : []);
            } catch {
                // A failed read shows nothing, exactly as having no Powers does.
            }
        })();

        return () => controller.abort();
    }, []);

    // Nothing to boast about and nothing to nag about: somebody with no Powers
    // yet sees no empty scoreboard.
    if (!powers.length) return null;

    return (
        <section className="flex flex-col border-y border-white/[0.08] bg-white/[0.02] font-sans">
            <header className="flex items-center gap-2 px-[18px] py-3">
                <span aria-hidden="true" className="text-xs font-bold" style={{color: NEON}}>⚡</span>
                <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white">{title}</h2>
                <span className="ml-auto text-xs font-semibold text-white/55">
                    {animalsMet > 0 ? `${powers.length} of ${animalsMet}` : powers.length}
                </span>
            </header>
            <div className="flex gap-3 overflow-x-auto border-t border-white/[0.08] px-[18px] py-3.5">
                {powers.map((power) => {
                    const domain = power.sourceDomain ? normalizeDomain(power.sourceDomain) : "UNKNOWN";
                    return (
                        <article
                            key={power.speciesProfileId}
                            aria-label={`${power.principleName}, earned from the ${power.speciesDisplayName}`}
                            className="flex h-[142px] w-[174px] shrink-0 flex-col gap-1.5 rounded-2xl border border-[#A7F432]/25 bg-white/[0.04] p-3"
                        >
                            <p className="flex items-center gap-[5px] text-[10px] font-black uppercase tracking-[0.08em]" style={{color: NEON}}>
                                <span aria-hidden="true">✓</span>
                                {earnedLabel(power.earnedVia)}
                            </p>
                            <p className="line-clamp-2 text-sm font-bold text-white">{power.principleName}</p>
                            <p className="truncate text-[10px] text-white/60">{power.speciesDisplayName}</p>
                            <p className="mt-auto text-[10px] font-semibold text-white/40">
                                {domain !== "UNKNOWN"
                                    ? domainDisplayTitle(domain)
                                    : power.earnedAt
                                        ? new Date(power.earnedAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"})
                                        : null}
                            </p>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
