"use client";

import {TEMPLATE_LIST, type CampaignTemplateId} from "@/lib/sponsored-challenge-builder";

export function CampaignTemplatePicker({
    selected,
    disabled,
    onSelect
}: {
    selected: CampaignTemplateId;
    disabled?: boolean;
    onSelect: (id: CampaignTemplateId) => void;
}) {
    return (
        <section className="space-y-3">
            <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary-200">Start from a template</p>
                <p className="mt-1 text-sm text-ink-400">Presets only set supported backend fields. Venue is never invented.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {TEMPLATE_LIST.map((template) => {
                    const active = selected === template.id;
                    return (
                        <button
                            key={template.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect(template.id)}
                            className={`rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
                                active
                                    ? "border-primary-300 bg-primary-500/10"
                                    : "border-line-300 bg-canvas-950/50 hover:border-primary-400/40"
                            }`}
                        >
                            <p className="text-sm font-black text-white">{template.label}</p>
                            <p className="mt-1 text-xs leading-5 text-ink-400">{template.description}</p>
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-ink-500">
                                {template.durationDays} days
                                {template.expectsVenue ? " · venue required" : ""}
                            </p>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
