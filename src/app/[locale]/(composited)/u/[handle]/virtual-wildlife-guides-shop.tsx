"use client";

import {useEffect, useState} from "react";
import type {VirtualGuideCard, VirtualGuideProfile} from "@/data/virtual-wildlife-guides";

type GuideDetail = {
    title?: string; summary?: string; overview?: string; seasonLine?: string; areaLabel?: string;
    amountMinor?: number; currencyCode?: string; owner?: {priceAuto?: boolean; publiclyVisible?: boolean};
    hasPrivateAccess?: boolean;
    private?: {contacts?: {name: string; role?: string; contact?: string; note?: string}[]; notes?: string};
    stats?: {visitDayCount?: number; firstVisitMonth?: string; lastVisitMonth?: string; monthCounts?: number[]};
    media?: {id: string; captureId: string; captureImageId: string; bucket?: string; path?: string; hidden?: boolean}[];
    species?: {speciesProfileId: string; name: string; rarity: string; threatened: boolean; conservationTier?: string; note?: string; noteIsDraft?: boolean; hidden?: boolean}[];
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
    const [deletedIds, setDeletedIds] = useState<string[]>([]);

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
            {profile.cards.filter((card) => !deletedIds.includes(card.id)).map((card) => <VirtualGuideRow key={card.id} card={card} owner={owner} shared={autoPublish} detail={details[card.id]} editing={editingId === card.id} onEdit={() => setEditingId(editingId === card.id ? null : card.id)} onSave={async (patch) => {
                setSaving(true);
                try {
                    const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(card.id)}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify(patch)});
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload.error || "Could not save guide changes.");
                    setDetails((current) => ({...current, [card.id]: payload.guide}));
                    setEditingId(null);
                } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save guide changes."); }
                finally { setSaving(false); }
            }} onDelete={async () => {
                if (!window.confirm("Delete this Wildlife Guide? This cannot be undone.")) return;
                const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(card.id)}`, {method: "DELETE"});
                if (response.ok) setDeletedIds((current) => [...current, card.id]);
                else setError("Could not delete this guide.");
            }} saving={saving} onOpen={() => void loadDetail(card)} onMutation={async (patch) => {
                const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(card.id)}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify(patch)});
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Could not save guide changes.");
                setDetails((current) => ({...current, [card.id]: payload.guide}));
            }} />)}
            {owner ? profile.growing.map((place) => <div key={place.placeId} className="border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-xs text-white/50">{place.areaLabel}: {place.speciesCount} species · {place.photoCount} photos · {place.speciesNeeded} more to make a guide</div>) : null}
        </div>
    </section>;
}

function VirtualGuideRow({card, owner, shared, detail, editing, saving, onEdit, onSave, onDelete, onOpen, onMutation}: {card: VirtualGuideCard; owner: boolean; shared: boolean; detail?: GuideDetail | "loading" | "error"; editing: boolean; saving: boolean; onEdit: () => void; onSave: (patch: Record<string, unknown>) => Promise<void>; onDelete: () => Promise<void>; onOpen: () => void; onMutation: (patch: Record<string, unknown>) => Promise<void>}) {
    const [title, setTitle] = useState(card.title);
    const [summary, setSummary] = useState(card.summary ?? "");
    const [overview, setOverview] = useState("");
    const [areaLabel, setAreaLabel] = useState(card.areaLabel);
    const [seasonLine, setSeasonLine] = useState("");
    const [priceAuto, setPriceAuto] = useState(true);
    const [amountMinor, setAmountMinor] = useState(card.amountMinor);
    const [published, setPublished] = useState(card.status === "published");
    const [privateNotes, setPrivateNotes] = useState("");
    const [contactsJson, setContactsJson] = useState("[]");
    const [mutationError, setMutationError] = useState("");
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
        setPrivateNotes(detail.private?.notes ?? "");
        setContactsJson(JSON.stringify(detail.private?.contacts ?? [], null, 2));
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
                {detail.media?.length ? <div className="mt-1 flex snap-x gap-2 overflow-x-auto">{detail.media.filter((media) => owner || !media.hidden).map((media) => <figure key={media.id} className="relative w-4/5 shrink-0 snap-center"> <img src={`/api/capture-images/${encodeURIComponent(media.captureId)}/card?${new URLSearchParams({bucket: media.bucket ?? "", path: media.path ?? ""})}`} alt="Wildlife sighting" className="h-48 w-full object-cover" loading="lazy" />{owner ? <button type="button" onClick={() => void onMutation({mediaId: media.id, hidden: !media.hidden}).catch((error) => setMutationError(error.message))} className="absolute bottom-2 right-2 bg-black/75 px-2 py-1 text-xs text-white">{media.hidden ? "Show photo" : "Hide photo"}</button> : null}</figure>)}</div> : null}
                {detail.overview ? <p className="text-sm leading-6 text-white/70">{detail.overview}</p> : null}
                {detail.seasonLine ? <p className="mt-3 text-xs text-white/50">Best time: {detail.seasonLine}</p> : null}
                {detail.stats?.monthCounts?.length ? <div className="mt-4"><p className="mb-2 text-xs font-bold text-white/65">Best time of year</p><div className="grid grid-cols-12 items-end gap-1" aria-label="Wildlife sightings by month">{detail.stats.monthCounts.slice(0, 12).map((count, index) => <div key={index} className="flex h-14 flex-col items-center justify-end gap-1"><span className="w-full bg-primary-400/80" style={{height: `${Math.max(3, Math.min(100, count / Math.max(1, ...detail.stats!.monthCounts!) * 100))}%`}} /><span className="text-[8px] text-white/35">{["J","F","M","A","M","J","J","A","S","O","N","D"][index]}</span></div>)}</div></div> : null}
                {detail.species?.length ? <><h4 className="mt-3 text-xs font-bold text-white/70">What you get</h4><ul className="divide-y divide-white/[0.06]">{detail.species.filter((animal) => owner || !animal.hidden).map((animal) => <li key={animal.speciesProfileId} className="py-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-white/80">{animal.name}{animal.threatened ? " · Threatened" : ""}{animal.conservationTier ? ` · ${animal.conservationTier}` : ""}</span><span className="text-white/45">{animal.rarity}{animal.noteIsDraft ? " · Draft note — check before buyers read it" : ""}</span></div>{animal.note ? <p className="mt-1 leading-5 text-white/50">{animal.note}</p> : null}{owner ? <div className="mt-2 flex gap-3"><button type="button" onClick={() => void onMutation({speciesProfileId: animal.speciesProfileId, hidden: !animal.hidden}).catch((error) => setMutationError(error.message))} className="text-[10px] text-white/50">{animal.hidden ? "Show animal" : "Hide animal"}</button><button type="button" onClick={() => {const note = window.prompt("Guide note for buyers", animal.note ?? ""); if (note !== null) void onMutation({speciesProfileId: animal.speciesProfileId, note}).catch((error) => setMutationError(error.message));}} className="text-[10px] text-white/50">Edit note</button></div> : null}</li>)}</ul></> : null}
                {(owner || detail.hasPrivateAccess) && detail.private ? <div className="mt-3 border-t border-white/[0.07] pt-3"><h4 className="text-xs font-bold text-white/70">{owner ? "Notes for buyers" : "Notes unlocked with the guide"}</h4>{detail.private.notes ? <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-white/50">{detail.private.notes}</p> : null}{detail.private.contacts?.map((contact) => <p key={`${contact.name}-${contact.contact}`} className="mt-1 text-xs text-white/50">{contact.name}{contact.role ? ` · ${contact.role}` : ""}{contact.contact ? ` · ${contact.contact}` : ""}</p>)}</div> : !owner ? <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3"><span className="text-xs text-white/45">Notes unlock with the guide</span><button type="button" disabled className="bg-white/10 px-3 py-2 text-xs font-bold text-white/40">Coming soon</button></div> : null}
                {detail.stats ? <p className="mt-2 text-[10px] text-white/40">{detail.stats.visitDayCount ?? 0} days there · {detail.stats.firstVisitMonth ?? ""}{detail.stats.lastVisitMonth && detail.stats.lastVisitMonth !== detail.stats.firstVisitMonth ? ` – ${detail.stats.lastVisitMonth}` : ""}</p> : null}
                <p className="mt-3 text-[10px] leading-4 text-white/35">A virtual guide based on recorded wildlife sightings. It does not include an in-person guide.</p>
                {owner ? <div className="mt-3"><button type="button" onClick={onEdit} className="border border-white/15 px-3 py-2 text-xs font-bold text-white">{editing ? "Close editor" : "Edit guide"}</button></div> : null}
                {owner && editing ? <form className="mt-3 grid gap-2" onSubmit={(event) => {event.preventDefault(); let contacts: unknown; try { contacts = JSON.parse(contactsJson); if (!Array.isArray(contacts)) throw new Error(); } catch { setMutationError("Contacts must be a JSON list."); return; } setMutationError(""); void onSave({title, summary, overview, areaLabel, seasonLine, priceAuto, amountMinor, visibility: published ? "published" : "paused", contacts, privateNotes});}}>
                    <input aria-label="Title" value={title} onChange={(event) => setTitle(event.target.value)} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <input aria-label="Place" value={areaLabel} onChange={(event) => setAreaLabel(event.target.value)} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <textarea aria-label="Search summary" value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-16 border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <textarea aria-label="Overview" value={overview} onChange={(event) => setOverview(event.target.value)} className="min-h-24 border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <input aria-label="Best time" value={seasonLine} onChange={(event) => setSeasonLine(event.target.value)} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={priceAuto} onChange={(event) => setPriceAuto(event.target.checked)} />Automatic price</label>
                    {!priceAuto ? <select aria-label="Price" value={amountMinor} onChange={(event) => setAmountMinor(Number(event.target.value))} className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white">{[99,199,299,499,799,999,1499,1999,2999,4999].map((amount) => <option key={amount} value={amount}>{money({...card, amountMinor: amount})}</option>)}</select> : null}
                    <textarea aria-label="Notes for buyers" value={privateNotes} onChange={(event) => setPrivateNotes(event.target.value)} placeholder="Notes for buyers" className="min-h-20 border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
                    <textarea aria-label="Local contacts JSON" value={contactsJson} onChange={(event) => setContactsJson(event.target.value)} className="min-h-24 border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white" />
                    <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />Share this guide</label>
                    <button disabled={saving} className="bg-primary-400 px-3 py-2 text-xs font-black text-black">{saving ? "Saving…" : "Save guide"}</button>
                    <button type="button" disabled={saving} onClick={() => void onDelete()} className="justify-self-start text-xs text-red-300">Delete guide</button>
                </form> : null}
                {mutationError ? <p role="alert" className="mt-2 text-xs text-red-300">{mutationError}</p> : null}
            </> : null}
        </div>
    </details>;
}
