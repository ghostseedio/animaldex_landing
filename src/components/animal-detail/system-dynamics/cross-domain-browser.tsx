"use client";

import {useMemo, useState} from "react";
import {
    CROSS_DOMAIN_INITIAL_VISIBLE_COUNT,
    type CrossDomainEntry,
    type CrossDomainMapping,
    type SystemStateTransition,
    crossDomainTransitionLadder,
    domainDisplayTitle,
    normalizeDomain,
    orderedCrossDomainMappings
} from "@/lib/system-dynamics";
import {FrequencyStateChip} from "@/components/animal-detail/system-dynamics/frequency-chip";

/**
 * "Across Reality": the same operating pattern in other domains. Progressive
 * disclosure — six high-value domains first, the rest on request. Mirrors iOS
 * `CrossDomainBrowserView`.
 */

const TRANSITION_ACCENT = "#A78BFA";

function ladderLabel(transition: SystemStateTransition) {
    if (transition.kind === "phaseChange") {
        return transition.triggerName ? `${transition.triggerName} threshold` : "Threshold";
    }
    return transition.triggerName ?? "Trigger";
}

function EntryRow({entry}: {entry: CrossDomainEntry}) {
    return (
        <div className="flex items-start gap-3">
            {entry.frequency ? (
                <span className="pt-px">
                    <FrequencyStateChip frequency={entry.frequency} size="compact" />
                </span>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-bold text-white">{entry.equivalent}</p>
                <p className="text-xs leading-5 text-white/55">{entry.reasoning}</p>
            </div>
        </div>
    );
}

function MappingCard({mapping, transition}: {mapping: CrossDomainMapping; transition: SystemStateTransition | null}) {
    const ladder = crossDomainTransitionLadder(mapping, transition);

    return (
        <div className="  bg-white/[0.035] p-4">
            <h4 className="mb-3 text-sm font-black text-white">{domainDisplayTitle(mapping.domain)}</h4>

            {ladder && transition ? (
                <div className="flex flex-col gap-2">
                    <EntryRow entry={ladder[0]} />
                    <div className="flex items-center gap-1.5 pl-0.5 text-[10px] font-semibold" style={{color: TRANSITION_ACCENT}}>
                        <span aria-hidden="true">↓</span>
                        {ladderLabel(transition)}
                    </div>
                    <EntryRow entry={ladder[1]} />
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {mapping.entries.map((entry, index) => (
                        <div key={`${entry.equivalent}-${index}`} className={index > 0 ? "border-t border-white/[0.08] pt-3" : ""}>
                            <EntryRow entry={entry} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CrossDomainBrowser({
    mappings,
    transition = null
}: {
    mappings: CrossDomainMapping[];
    transition?: SystemStateTransition | null;
}) {
    const ordered = useMemo(() => orderedCrossDomainMappings(mappings), [mappings]);
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const [showsAll, setShowsAll] = useState(false);

    const canShowMore = ordered.length > CROSS_DOMAIN_INITIAL_VISIBLE_COUNT;
    const visible = showsAll || !canShowMore ? ordered : ordered.slice(0, CROSS_DOMAIN_INITIAL_VISIBLE_COUNT);
    const selected = visible.find((mapping) => normalizeDomain(mapping.domain) === selectedDomain) ?? visible[0];

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.11em] text-white">Across Reality</h3>
                <span className="text-[10px] text-white/40">AnimalDex system mapping</span>
            </div>

            {!ordered.length ? (
                <p className="text-xs text-white/40">No cross-domain mappings yet.</p>
            ) : (
                <>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {visible.map((mapping) => {
                            const domain = normalizeDomain(mapping.domain);
                            const isSelected = selected && normalizeDomain(selected.domain) === domain;
                            return (
                                <button
                                    key={domain}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setSelectedDomain(domain)}
                                    className={`inline-flex min-h-[34px] shrink-0 items-center rounded-full border px-3 text-[11px] font-semibold transition ${
                                        isSelected
                                            ? "border-transparent bg-[#A7F432] text-black"
                                            : "border-white/[0.07] bg-white/[0.05] text-white hover:bg-white/[0.08]"
                                    }`}
                                >
                                    {domainDisplayTitle(mapping.domain)}
                                </button>
                            );
                        })}
                    </div>

                    {canShowMore ? (
                        <button
                            type="button"
                            onClick={() => {
                                // Collapsing must not strand a selection that is about to disappear.
                                if (showsAll && selectedDomain) {
                                    const stillVisible = ordered
                                        .slice(0, CROSS_DOMAIN_INITIAL_VISIBLE_COUNT)
                                        .some((mapping) => normalizeDomain(mapping.domain) === selectedDomain);
                                    if (!stillVisible) setSelectedDomain(null);
                                }
                                setShowsAll((current) => !current);
                            }}
                            className="inline-flex min-h-8 w-fit items-center gap-1 text-xs font-semibold text-[#A7F432]"
                        >
                            {showsAll ? "Show top domains" : "More domains"}
                            <span aria-hidden="true">{showsAll ? "▴" : "▾"}</span>
                        </button>
                    ) : null}

                    {selected ? <MappingCard mapping={selected} transition={transition} /> : null}
                </>
            )}
        </section>
    );
}
