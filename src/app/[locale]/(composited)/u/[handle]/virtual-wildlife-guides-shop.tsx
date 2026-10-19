"use client";

import {useEffect, useState} from "react";
import type {VirtualGuideCard, VirtualGuideProfile} from "@/data/virtual-wildlife-guides";

type GuideDetail = {
    title?: string; summary?: string; overview?: string; seasonLine?: string; areaLabel?: string;
    amountMinor?: number; currencyCode?: string; owner?: {priceAuto?: boolean; publiclyVisible?: boolean};
    stats?: {visitDayCount?: number; firstVisitMonth?: string; lastVisitMonth?: string};
    species?: {speciesProfileId: string; name: string; rarity: string; threatened: boolean; conservationTier?: string; note?: string; noteIsDraft?: boolean}[];
};

function money(card: VirtualGuideCard) {
    try { return new Intl.NumberFormat(undefined, {style: "currency", currency: card.currencyCode}).format(card.amountMinor / 100); }
    catch { return `${(card.amountMinor / 100).toFixed(2)} ${card.currencyCode}`; }
}

export default function VirtualWildlifeGuidesShop({profile, owner = false}: {profile: VirtualGuideProfile; owner?: boolean}) {
    const [autoPublish, setAutoPublish] = useState(profile.autoPublish ?? true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [details, setDetails] = useState<Record<string, GuideDetail | "loading" | "error">>({});
    const [editingId, setEditingId] = useState<string | null>(null);

    async function toggleSharing(next: boolean) {
        setSaving(true); setError("");
        try {
            const response = await fetch("/api/app/wildlife-guides/settings", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({autoPublish: next, acknowledgeNotice: !profile.noticeAcknowledged})});
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not update guide sharing.");
            setAutoPublish(next);
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update guide sharing."); }
        finally { setSaving(false); }
    }

    async function loadDetail(card: VirtualGuideCard) {
        if (details[card.id] && details[card.id] !== "error") return;
        setDetails((current) => ({...current, [card.id]: "loading"}));
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(card.id)}${owner ? "?owner=1" : ""}`, {cache: "no-store"});
            const payload = await response.json();
            if (!response.ok || !payload.guide) throw new Error("Guide details unavailable");
            setDetails((current) => ({...current, [card.id]: payload.guide}));
        } catch { setDetails((current) => ({...current, [card.id]: "error"})); }
    }

    if (!profile.cards.length && !owner && !profile.growing.length) return null;
    return <section className="border-b border-white/[0.07] px-[18px] py-4">
        <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-display text-lg font-bold text-white">Wildlife Guides</h2><p className="mt-1 text-xs leading-5 text-white/45">Virtual guides built from real wildlife sightings at places you’ve visited.</p></div>
            {owner ? <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/70"><input type="checkbox" checked={autoPublish} disabled={saving} onChange={(event) => void toggleSharing(event.target.checked)} aria-label="Share my guides" />Share my guides</label> : null}
        </div>
        {owner && !profile.publicEnabled ? <p className="mt-3 text-xs text-white/45">Wildlife Guides are not open for publishing yet.</p> : null}
        {error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}
        {owner && profile.noticeAcknowledged === false && profile.cards.length ? <p className="mt-2 text-xs leading-5 text-white/45">Review each guide before sharing it. Your private notes and contacts stay private.</p> : null}
        <div className="mt-3 flex flex-col gap-3">
            {profile.cards.map((card) => <VirtualGuideRow key={card.id} card={card} owner={owner} shared={autoPublish} detail={details[card.id]} editing={editingId === card.id} onEdit={() => setEditingId(editingId === card.id ? null : card.id)} onSave={async (patch) => {
                setSaving(true);
                try {
                    const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(card.id)}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify(patch)});
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload.error || "Could not save guide changes.");
                    setDetails((current) => ({...current, [card.id]: payload.guide}));
                    setEditingId(null);
                } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save guide changes."); }
                finally { setSaving(false); }
            }} saving={saving} onOpen={() => void loadDetail(card)} />)}
            {owner ? profile.growing.map((place) => <div key={place.placeId} className="border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-xs text-white/50">{place.areaLabel}: {place.speciesCount} species · {place.photoCount} photos · {place.speciesNeeded} more to make a guide</div>) : null}
        </div>
    </section>;
}

function VirtualGuideRow({card, owner, shared, detail, editing, saving, onEdit, onSave, onOpen}: {card: VirtualGuideCard; owner: boolean; shared: boolean; detail?: GuideDetail | "loading" | "error"; editing: boolean; saving: boolean; onEdit: () => void; onSave: (patch: Record<string, unknown>) => Promise<void>; onOpen: () => void}) {
    const [title, setTitle] = useState(card.title);
    const [summary, setSummary] = useState(card.summary ?? "");
    const [overview, setOverview] = useState("");
    const [areaLabel, setAreaLabel] = useState(card.areaLabel);
    const [seasonLine, setSeasonLine] = useState("");
    const [priceAuto, setPriceAuto] = useState(true);
    const [amountMinor, setAmountMinor] = useState(card.amountMinor);
    const [published, setPublished] = useState(card.status === "published");
    useEffect(() => {
        if (!detail || detail === "loading" || detail === "error") return;
        setTitle(detail.title ?? card.title);
        setSummary(detail.summary ?? card.summary ?? "");
        setOverview(detail.overview ?? "");
        setAreaLabel(detail.areaLabel ?? card.areaLabel);
        setSeasonLine(detail.seasonLine ?? "");
        setPriceAuto(detail.owner?.priceAuto ?? true);
        setAmountMinor(detail.amountMinor ?? card.amountMinor);
        setPublished(detail.owner?.publiclyVisible ?? card.status === "published");
    }, [detail, card]);
    const cover = card.coverMedia?.[0];
    const isPublicListing = card.status === "published" && card.publiclyVisible !== false && shared;
    return <details className="overflow-hidden border border-white/[0.08] bg-white/[0.025]" onToggle={(event) => {if ((event.currentTarget as HTMLDetailsElement).open) onOpen();}}>
        <summary className="cursor-pointer list-none">
            {cover ? <img src={`/api/capture-images/${encodeURIComponent(cover.captureId)}/card`} alt="" className="h-36 w-full object-cover" loading="lazy" /> : null}
            <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0"><h3 className="font-display text-base font-bold text-white">{card.title}</h3><p className="mt-1 text-xs text-white/50">{card.areaLabel} · {card.speciesCount} species · {card.rareSpeciesCount} rare</p>{card.summary ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45">{card.summary}</p> : null}</div>
                <div className="shrink-0 text-right"><strong className="text-sm text-white">{money(card)}</strong>{owner ? <p className="mt-1 text-[10px] text-white/40">{isPublicListing ? "Shared" : card.generationStatus === "pending" ? "Being written" : card.status ?? "Draft"}</p> : <p className="mt-1 text-[10px] text-white/40">View guide</p>}</div>
            </div>
        </summary>
        <div className="border-t border-white/[0.07] px-3 py-3">
            {detail === "loading" ? <p className="text-xs text-white/45">Loading guide…</p> : detail === "error" ? <p className="text-xs text-white/45">Guide details could not be loaded. Close and try again.</p> : detail ? <>
                {detail.overview ? <p className="text-sm leading-6 text-white/70">{detail.overview}</p> : null}
                {detail.seasonLine ? <p className="mt-3 text-xs text-white/50">Best time: {detail.seasonLine}</p> : null}
                {detail.species?.length ? <ul className="mt-3 divide-y divide-white/[0.06]">{detail.species.map((animal) => <li key={animal.speciesProfileId} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="font-semibold text-white/80">{animal.name}{animal.threatened ? " · Threatened" : ""}</span><span className="text-white/45">{animal.rarity}{animal.noteIsDraft ? " · Draft note" : ""}</span></li>)}</ul> : null}
                <p className="mt-3 text-[10px] leading-4 text-white/35">A virtual guide based on recorded wildlife sightings. It does not include an in-person guide.</p>
                {owner ? <div className="mt-3"><button type="button" onClick={onEdit} className="border border-white/15 px-3 py-2 text-xs font-bold text-white">{editing ? "Close editor" : "Edit guide"}</button></div> : null}
                {owner && editing ? <form className="mt-3 grid gap-2" onSubmit={(event) => {event.preventDefault(); void onSave({title, summary, overview, areaLabel, seasonLine, priceAuto, amountMinor, visibility: published ? "published" : "paused"});}}>
                    <input aria-label="Title" value={title} onChange={(event) => setTitle(event.target.value)} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <input aria-label="Place" value={areaLabel} onChange={(event) => setAreaLabel(event.target.value)} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <textarea aria-label="Search summary" value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-16 border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <textarea aria-label="Overview" value={overview} onChange={(event) => setOverview(event.target.value)} className="min-h-24 border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <input aria-label="Best time" value={seasonLine} onChange={(event) => setSeasonLine(event.target.value)} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={priceAuto} onChange={(event) => setPriceAuto(event.target.checked)} />Automatic price</label>
                    {!priceAuto ? <input aria-label="Price in minor currency units" type="number" value={amountMinor} onChange={(event) => setAmountMinor(Number(event.target.value))} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" /> : null}
                    <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />Share this guide</label>
                    <button disabled={saving} className="bg-primary-400 px-3 py-2 text-xs font-black text-black">{saving ? "Saving…" : "Save guide"}</button>
                </form> : null}
            </> : null}
        </div>
    </details>;
}
