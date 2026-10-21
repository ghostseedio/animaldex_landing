"use client";

import {useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import GuideAgentPanel from "@/components/wildlife-guides/guide-agent-panel";
import {
    GUIDE_BAND,
    GUIDE_NEON,
    GuideBandHeader,
    GuideGlyph,
    GuidePhoto,
    GuideSwitch,
    RarityLabel
} from "@/components/wildlife-guides/guide-ui";
import {
    GUIDE_FIELD_LIMITS,
    GUIDE_MAX_CONTACTS,
    GUIDE_NOTE_MAX,
    GUIDE_PRICE_STEPS,
    buildGuidePatch,
    formatGuidePrice,
    guideFormFrom,
    guideGalleryMedia,
    guideHeroMedia,
    guidePath,
    guideSalesLine,
    guideStatsLine,
    guideValidationProblem,
    type GuideContact,
    type GuideDetail,
    type GuideForm,
    type GuideMedia,
    type GuideSpecies
} from "@/lib/virtual-wildlife-guides";
import {SaveGlyph} from "@/components/ui/icon-buttons";

/**
 * Editing a guide AnimalDex built (iOS WildlifeGuideEditorView). Text, price,
 * sharing, contacts and notes are saved together, sending only what changed;
 * the banner, uploaded photos, hiding an animal or a photo, and an animal's
 * note save straight away. Anything the author writes is never overwritten
 * by the generator again.
 */

type ContactRow = GuideContact & {key: string};

let contactSeed = 0;
const withKey = (contact: GuideContact): ContactRow => ({...contact, key: `contact-${(contactSeed += 1)}`});

const inputClass = "w-full border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none";

async function patchGuide(id: string, body: Record<string, unknown>): Promise<GuideDetail> {
    const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.guide) throw new Error(payload.error || "Could not save the guide.");
    return payload.guide as GuideDetail;
}

/** A picked photo as the JPEG the upload function takes: at most 2048 px, base64. */
/** The video's length and a cover frame (JPEG base64, at most 1280 px), read in the browser. */
async function videoDetails(file: File): Promise<{durationSeconds: number; poster: string}> {
    const url = URL.createObjectURL(file);
    try {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.src = url;
        await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error("That video can't be read. Use an MP4 or MOV file."));
        });
        const durationSeconds = video.duration;
        video.currentTime = Math.min(1, durationSeconds / 2);
        await new Promise<void>((resolve, reject) => {
            video.onseeked = () => resolve();
            video.onerror = () => reject(new Error("That video can't be read. Use an MP4 or MOV file."));
        });
        const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const poster = canvas.toDataURL("image/jpeg", 0.82).split(",")[1] ?? "";
        if (!poster) throw new Error("That video can't be read. Use an MP4 or MOV file.");
        return {durationSeconds, poster};
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function preparedJpeg(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file, {imageOrientation: "from-image"} as unknown as ImageBitmapOptions).catch(() => null);
    if (!bitmap) throw new Error("Could not load that photo.");
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not load that photo.");
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55]) {
        const data = canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
        if (data.length * 0.75 < 3_500_000) return data;
    }
    throw new Error("That photo is too large. Try a smaller one.");
}

function ownerStatusText(guide: GuideDetail) {
    const owner = guide.owner;
    if (!owner) return {text: "Your guide", live: false};
    if (owner.generationStatus === "pending") return {text: "Writing…", live: false};
    if (owner.status === "published") {
        if (!owner.publiclyVisible) return {text: "Ready, not public yet", live: false};
        return owner.salesPausedAt ? {text: "Public · sales paused", live: false} : {text: "Public", live: true};
    }
    if (owner.status === "paused") return {text: owner.pausedBy === "author_off" ? "Not shared" : "Paused", live: false};
    return {text: "Hidden", live: false};
}

export default function GuideEditorClient({initial}: {initial: GuideDetail}) {
    const router = useRouter();
    const [guide, setGuide] = useState(initial);
    const [form, setForm] = useState<GuideForm>(() => guideFormFrom(initial));
    const [contacts, setContacts] = useState<ContactRow[]>(() => form.contacts.map(withKey));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{tone: "error" | "ok"; text: string} | null>(null);
    const [busyItem, setBusyItem] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [askOpen, setAskOpen] = useState(false);
    const [resuming, setResuming] = useState(false);
    const [uploadsInFlight, setUploadsInFlight] = useState(0);
    const [choosingBanner, setChoosingBanner] = useState(false);
    const uploads = guide.uploads ?? [];
    const maxUploads = guide.owner?.maxUploads ?? 20;
    const hero = guideHeroMedia(guide);
    const [videoStep, setVideoStep] = useState<string | null>(null);
    const promoMaxSeconds = guide.owner?.promoMaxSeconds ?? 60;

    const currentForm = useMemo<GuideForm>(() => ({...form, contacts: contacts.map(({name, role, contact, note}) => ({name, role, contact, note}))}), [form, contacts]);
    const problem = guideValidationProblem(currentForm);
    const patch = useMemo(() => buildGuidePatch(guide, currentForm), [guide, currentForm]);
    const dirty = Object.keys(patch).length > 0;
    const status = ownerStatusText(guide);

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const set = <K extends keyof GuideForm>(key: K, value: GuideForm[K]) => {
        setMessage(null);
        setForm((current) => ({...current, [key]: value}));
    };

    /** After Ask AnimalDex changed guides: reload this one, keeping any unsaved edits. */
    async function reloadFromServer() {
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}?owner=1`, {cache: "no-store"});
            const payload = await response.json().catch(() => ({}));
            // Deleted from the chat: back to the list.
            if (response.status === 404 || /no longer available/i.test(payload.error ?? "")) {
                router.push("/app/guides");
                router.refresh();
                return;
            }
            if (!response.ok || !payload.guide) return;
            const fresh = payload.guide as GuideDetail;
            setGuide(fresh);
            if (!dirty) {
                const nextForm = guideFormFrom(fresh);
                setForm(nextForm);
                setContacts(nextForm.contacts.map(withKey));
            }
        } catch {
            // The editor keeps what it has; the next save reports any problem.
        }
    }

    async function save() {
        if (problem) {
            setMessage({tone: "error", text: problem});
            return;
        }
        if (!dirty) return;
        setSaving(true);
        setMessage(null);
        try {
            const updated = await patchGuide(guide.id, patch);
            const nextForm = guideFormFrom(updated);
            setGuide(updated);
            setForm(nextForm);
            setContacts(nextForm.contacts.map(withKey));
            setMessage({tone: "ok", text: "Saved."});
            router.refresh();
        } catch (caught) {
            setMessage({tone: "error", text: caught instanceof Error ? caught.message : "Could not save the guide."});
        } finally {
            setSaving(false);
        }
    }

    /** Animals, notes and photos save straight away; the text form keeps its edits. */
    async function saveNow(itemKey: string, body: Record<string, unknown>) {
        setBusyItem(itemKey);
        setMessage(null);
        try {
            setGuide(await patchGuide(guide.id, body));
            return true;
        } catch (caught) {
            setMessage({tone: "error", text: caught instanceof Error ? caught.message : "Could not save the change."});
            return false;
        } finally {
            setBusyItem(null);
        }
    }

    /** Selling stopped after a missed reply; the author says they can answer again. */
    async function resumeSales() {
        setResuming(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}/resume-sales`, {method: "POST"});
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.guide) throw new Error(payload.error || "Could not resume sales.");
            setGuide(payload.guide as GuideDetail);
            router.refresh();
        } catch (caught) {
            setMessage({tone: "error", text: caught instanceof Error ? caught.message : "Could not resume sales."});
        } finally {
            setResuming(false);
        }
    }

    /** Each photo is checked on the server before it is kept; refusals are gathered into one message. */
    async function upload(files: File[], asBanner: boolean) {
        if (files.length === 0) return;
        setUploadsInFlight(files.length);
        setMessage(null);
        const refusals: string[] = [];
        for (const file of files) {
            try {
                const image = await preparedJpeg(file);
                const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}/photos`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({image, asBanner})
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || "The photo didn't upload. Try again.");
                if (payload.removed) refusals.push(payload.message || "This photo can't be used on a public guide. Pick another one.");
                else if (payload.guide) setGuide(payload.guide as GuideDetail);
            } catch (caught) {
                refusals.push(caught instanceof Error ? caught.message : "The photo didn't upload. Try again.");
                break;
            } finally {
                setUploadsInFlight((count) => Math.max(0, count - 1));
            }
        }
        setUploadsInFlight(0);
        if (refusals.length > 0) setMessage({tone: "error", text: Array.from(new Set(refusals)).join(" ")});
        router.refresh();
    }

    /**
     * The browser cannot re-encode, so the file goes up as it is: the server
     * refuses one that still carries where it was filmed.
     */
    async function uploadPromoVideo(file: File) {
        setMessage(null);
        if (file.size > 50 * 1024 * 1024) {
            setMessage({tone: "error", text: "That video is too large. Pick one under 50 MB."});
            return;
        }
        setVideoStep("Preparing the video…");
        try {
            const {durationSeconds, poster} = await videoDetails(file);
            if (durationSeconds > promoMaxSeconds + 1) throw new Error(`Promo videos can be up to ${promoMaxSeconds} seconds. Pick a shorter one.`);
            const endpoint = `/api/app/wildlife-guides/${encodeURIComponent(guide.id)}/video`;
            const started = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({step: "start"})});
            const slot = await started.json().catch(() => ({}));
            if (!started.ok || !slot.uploadUrl || !slot.uploadId) throw new Error(slot.error || "The video didn't upload. Try again.");
            setVideoStep("Uploading the video…");
            const put = await fetch(slot.uploadUrl, {
                method: "PUT",
                headers: {"Content-Type": file.type === "video/quicktime" ? "video/quicktime" : "video/mp4"},
                body: file
            });
            if (!put.ok) throw new Error("The video didn't upload. Try again.");
            setVideoStep("Checking the video…");
            const finished = await fetch(endpoint, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({step: "finish", uploadId: slot.uploadId, poster})
            });
            const payload = await finished.json().catch(() => ({}));
            if (!finished.ok) throw new Error(payload.error || "The video didn't upload. Try again.");
            if (payload.removed) setMessage({tone: "error", text: payload.message || "This video can't be used on a public guide. Pick another one."});
            else if (payload.guide) setGuide(payload.guide as GuideDetail);
            router.refresh();
        } catch (caught) {
            setMessage({tone: "error", text: caught instanceof Error ? caught.message : "The video didn't upload. Try again."});
        } finally {
            setVideoStep(null);
        }
    }

    async function removePromoVideo() {
        if (!window.confirm("Remove the promo video?")) return;
        setVideoStep("Removing…");
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}/video`, {method: "DELETE"});
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.guide) throw new Error(payload.error || "Could not remove the video.");
            setGuide(payload.guide as GuideDetail);
        } catch (caught) {
            setMessage({tone: "error", text: caught instanceof Error ? caught.message : "Could not remove the video."});
        } finally {
            setVideoStep(null);
        }
    }

    async function removeUpload(media: GuideMedia) {
        if (!media.id) return;
        setBusyItem(media.id);
        setMessage(null);
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}/photos`, {
                method: "DELETE",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({mediaId: media.id})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.guide) throw new Error(payload.error || "Could not remove the photo.");
            setGuide(payload.guide as GuideDetail);
        } catch (caught) {
            setMessage({tone: "error", text: caught instanceof Error ? caught.message : "Could not remove the photo."});
        } finally {
            setBusyItem(null);
        }
    }

    async function deleteGuide() {
        setDeleting(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}`, {method: "DELETE"});
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Could not delete the guide.");
            router.push("/app/guides");
            router.refresh();
        } catch (caught) {
            setDeleting(false);
            setMessage({tone: "error", text: caught instanceof Error ? caught.message : "Could not delete the guide."});
        }
    }

    const priceValue = form.priceAuto ? "auto" : String(form.amountMinor);

    return (
        <div className="mx-auto w-full max-w-3xl pb-6">
            <div className="px-[18px] pb-5 pt-6">
                <Link href="/app/guides" className="text-sm font-semibold text-white/55 hover:text-white">‹ Wildlife Guides</Link>
                <p className="mt-4 text-[0.68rem] font-black uppercase tracking-[0.2em]" style={{color: GUIDE_NEON}}>Edit guide</p>
                <h1 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">{guide.title}</h1>
                <p className="mt-2 text-sm text-white/60">{guide.areaLabel}</p>
                <p className="mt-1 text-xs text-white/40">{guideStatsLine(guide)}</p>
            </div>

            <div className={`${GUIDE_BAND} px-[18px] py-3.5`} style={{backgroundColor: "rgba(31,31,31,0.6)"}}>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold" style={{color: status.live ? GUIDE_NEON : "#fff"}}>{status.text}</span>
                    <span className="text-sm font-bold text-white">{formatGuidePrice(guide.amountMinor, guide.currencyCode)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-white/60">
                    {guide.owner?.generationStatus === "pending"
                        ? "AnimalDex is writing this guide from your sightings. Check back in a few minutes."
                        : guideSalesLine(guide.owner?.salesCount)}
                </p>
                {guide.owner?.pausedBy === "moderation" && guide.owner.moderationNote ? (
                    <p className="mt-1.5 text-xs font-semibold leading-5 text-[#FFCC00]">Hidden by AnimalDex: {guide.owner.moderationNote}</p>
                ) : guide.owner?.salesPausedAt ? (
                    <div className="mt-2">
                        <p className="text-xs font-semibold leading-5 text-[#FFCC00]">
                            A buyer had no reply within 48 hours and was refunded, so this guide stopped selling. It is still public. Resume sales when you can answer buyers.
                        </p>
                        <button
                            type="button"
                            disabled={resuming}
                            onClick={() => void resumeSales()}
                            className="mt-2 rounded-full px-4 py-2 text-xs font-extrabold text-black transition hover:opacity-90 disabled:opacity-50"
                            style={{backgroundColor: GUIDE_NEON}}
                        >
                            {resuming ? "Resuming…" : "Resume sales"}
                        </button>
                    </div>
                ) : guide.owner?.authorTermsAccepted === false ? (
                    <p className="mt-1.5 text-xs font-semibold leading-5 text-[#FFCC00]">This guide is for sale. Accept the Author Terms in your Shop to be paid for it.</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {guide.owner?.generationStatus !== "pending" && !askOpen ? (
                        <button type="button" onClick={() => setAskOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold hover:underline" style={{color: GUIDE_NEON}}>
                            <GuideGlyph name="sparkles" className="h-3.5 w-3.5" />
                            Ask AnimalDex to change this guide
                        </button>
                    ) : null}
                    {guide.owner?.publiclyVisible ? (
                        <Link href={guidePath(guide)} className="inline-block text-xs font-semibold hover:underline" style={{color: GUIDE_NEON}}>
                            View public page ›
                        </Link>
                    ) : null}
                </div>
            </div>
            {askOpen ? (
                <GuideAgentPanel guideTitle={guide.title} onChange={() => void reloadFromServer()} onClose={() => setAskOpen(false)} />
            ) : null}

            <GuideBandHeader title="Name" />
            <TextField label="Guide name" value={form.title} onChange={(value) => set("title", value)} limits={GUIDE_FIELD_LIMITS.title} />
            <p className={`${GUIDE_BAND} -mt-px px-[18px] pb-3 text-xs leading-5 text-white/55`}>
                Buyers see the name first, and Ask AnimalDex uses it to know which guide you mean. Say what makes this place worth the trip.
            </p>

            <GuideBandHeader title="Banner" />
            <div className={`${GUIDE_BAND} px-[18px] py-3.5`}>
                <div className="relative h-48 overflow-hidden rounded-lg bg-[#2A2A2A] md:h-64">
                    {hero ? <GuidePhoto media={hero} size="hero" alt="Banner" className="h-full w-full" /> : null}
                    {!guide.banner ? (
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">Using your first photo</span>
                    ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                    <label className={`cursor-pointer rounded-full px-4 py-2 text-xs font-extrabold text-black transition hover:opacity-90 ${uploadsInFlight > 0 || uploads.length >= maxUploads ? "pointer-events-none opacity-50" : ""}`} style={{backgroundColor: GUIDE_NEON}}>
                        Upload banner
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic"
                            className="sr-only"
                            onChange={(event) => {
                                const files = Array.from(event.target.files ?? []).slice(0, 1);
                                event.target.value = "";
                                void upload(files, true);
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        disabled={guideGalleryMedia(guide).length === 0}
                        onClick={() => setChoosingBanner((value) => !value)}
                        className="rounded-full border border-white/20 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/[0.06] disabled:opacity-50"
                    >
                        Choose a photo
                    </button>
                    {guide.banner ? (
                        <button type="button" onClick={() => void saveNow("banner", {bannerMediaId: null})} className="px-2 py-2 text-xs font-semibold text-white/60 hover:text-white">
                            Use first photo
                        </button>
                    ) : null}
                </div>
                {choosingBanner ? (
                    <div className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-4">
                        {guideGalleryMedia(guide).map((media, index) => (
                            <button
                                key={media.id ?? index}
                                type="button"
                                disabled={!media.id || busyItem === "banner"}
                                onClick={async () => {
                                    if (await saveNow("banner", {bannerMediaId: media.id})) setChoosingBanner(false);
                                }}
                                className="relative aspect-[4/3] overflow-hidden bg-[#2A2A2A] disabled:opacity-50"
                                aria-label={`Use photo ${index + 1} as the banner`}
                            >
                                <GuidePhoto media={media} size="thumb" className="h-full w-full" />
                                {media.id === hero?.id ? <span className="absolute right-1 top-1 rounded-full px-1.5 text-[10px] font-extrabold text-black" style={{backgroundColor: GUIDE_NEON}}>✓</span> : null}
                            </button>
                        ))}
                    </div>
                ) : null}
                <p className="mt-2 text-xs leading-5 text-white/55">The big photo at the top of your guide and on its card. A wide photo of the place works best.</p>
            </div>

            <GuideBandHeader title="Promo video" />
            <div className={`${GUIDE_BAND} px-[18px] py-3.5`}>
                {guide.promoVideo ? (
                    <video
                        src={guide.promoVideo.url}
                        poster={guide.promoVideo.posterUrl}
                        controls
                        playsInline
                        preload="none"
                        className="mb-3 block max-h-80 w-full rounded-lg bg-black"
                    />
                ) : null}
                <p className="text-xs leading-5 text-white/60">
                    A short showcase of the place, up to {promoMaxSeconds} seconds, shown near the top of your guide. Guides with a video sell better. It&rsquo;s checked automatically, sound included; no contact details or close-ups of people. Videos that still have their filming location saved are refused, so upload from the AnimalDex app or export without location.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    {videoStep ? (
                        <span className="text-xs text-white/60">{videoStep}</span>
                    ) : (
                        <>
                            <label className="cursor-pointer rounded-full px-4 py-2 text-xs font-extrabold text-black transition hover:opacity-90" style={{backgroundColor: GUIDE_NEON}}>
                                {guide.promoVideo ? "Replace video" : "Add a video"}
                                <input
                                    type="file"
                                    accept="video/mp4,video/quicktime"
                                    className="sr-only"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        event.target.value = "";
                                        if (file) void uploadPromoVideo(file);
                                    }}
                                />
                            </label>
                            {guide.promoVideo ? (
                                <button type="button" onClick={() => void removePromoVideo()} className="rounded-full border border-white/20 px-4 py-2 text-xs font-extrabold text-white hover:bg-white/[0.06]">
                                    Remove
                                </button>
                            ) : null}
                        </>
                    )}
                </div>
            </div>

            <GuideBandHeader title="Your photos" trailing={<span className="text-[11px] text-white/40">{uploads.length}/{maxUploads}</span>} />
            <div className={`${GUIDE_BAND} px-[18px] py-3.5`}>
                <p className="text-xs leading-5 text-white/60">
                    Show buyers the place: trails, viewpoints, the boat, where you stayed. Each photo is checked automatically; photos with contact details or close-ups of people can&rsquo;t be used.
                </p>
                {uploads.length > 0 ? (
                    <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                        {uploads.map((media) => (
                            <div key={media.id} className={`relative aspect-square overflow-hidden rounded-md bg-[#2A2A2A] ${media.hidden ? "opacity-40" : ""}`}>
                                <GuidePhoto media={media} size="thumb" className="h-full w-full" />
                                <button
                                    type="button"
                                    disabled={busyItem === media.id}
                                    onClick={() => {
                                        if (window.confirm("Remove this photo?")) void removeUpload(media);
                                    }}
                                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white"
                                    aria-label="Remove photo"
                                >
                                    ×
                                </button>
                                {media.id === guide.banner?.id ? (
                                    <span className="absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-black" style={{backgroundColor: GUIDE_NEON}}>Banner</span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : null}
                <div className="mt-3 flex items-center gap-3">
                    <label className={`cursor-pointer text-sm font-semibold hover:underline ${uploadsInFlight > 0 || uploads.length >= maxUploads ? "pointer-events-none opacity-50" : ""}`} style={{color: GUIDE_NEON}}>
                        + Add photos
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/heic"
                            className="sr-only"
                            onChange={(event) => {
                                const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, Math.min(5, maxUploads - uploads.length)));
                                event.target.value = "";
                                void upload(files, false);
                            }}
                        />
                    </label>
                    {uploadsInFlight > 0 ? <span className="text-xs text-white/55">Checking photos…</span> : null}
                </div>
            </div>

            <GuideBandHeader title="Sharing" />
            <label className={`${GUIDE_BAND} flex cursor-pointer items-center gap-3 px-[18px] py-3.5`}>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Share this guide</span>
                    <span className="mt-0.5 block text-xs leading-5 text-white/60">Shared guides can be found and bought by other explorers. Your exact spots stay private.</span>
                </span>
                <GuideSwitch checked={form.isShared} label="Share this guide" onChange={(next) => set("isShared", next)} />
            </label>

            <GuideBandHeader title="Price" />
            <div className={`${GUIDE_BAND} px-[18px] py-3.5`}>
                <div className="flex items-center justify-between gap-3">
                    <label htmlFor="guide-price" className="text-sm font-semibold text-white">Guide price</label>
                    <select
                        id="guide-price"
                        value={priceValue}
                        onChange={(event) => {
                            const value = event.target.value;
                            setMessage(null);
                            setForm((current) => value === "auto"
                                ? {...current, priceAuto: true}
                                : {...current, priceAuto: false, amountMinor: Number(value)});
                        }}
                        className="border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                    >
                        <option value="auto">Automatic</option>
                        {GUIDE_PRICE_STEPS.map((step) => (
                            <option key={step} value={String(step)}>{formatGuidePrice(step, guide.currencyCode)}</option>
                        ))}
                    </select>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/60">
                    {form.priceAuto
                        ? `Automatic: ${formatGuidePrice(guide.amountMinor, guide.currencyCode)}, set from how many animals the guide has and how rare they are.`
                        : "A small fee for your notes, your answers and any introductions you make."}
                </p>
            </div>

            <GuideBandHeader title="Public page" />
            <TextField label="Place" value={form.areaLabel} onChange={(value) => set("areaLabel", value)} limits={GUIDE_FIELD_LIMITS.areaLabel} />
            <TextField label="Search summary" value={form.summary} onChange={(value) => set("summary", value)} limits={GUIDE_FIELD_LIMITS.summary} rows={3} />
            <TextField label="About this place" value={form.overview} onChange={(value) => set("overview", value)} limits={GUIDE_FIELD_LIMITS.overview} rows={9} />
            <TextField label="Best time" value={form.seasonLine} onChange={(value) => set("seasonLine", value)} limits={GUIDE_FIELD_LIMITS.seasonLine} rows={2} />

            <GuideBandHeader title={`Animals · ${guide.species.filter((species) => !species.hidden).length}`} />
            {guide.species.map((species) => (
                <SpeciesRow
                    key={species.speciesProfileId}
                    species={species}
                    busy={busyItem === species.speciesProfileId}
                    editing={editingNote === species.speciesProfileId}
                    onEdit={() => setEditingNote(editingNote === species.speciesProfileId ? null : species.speciesProfileId)}
                    onToggle={(visible) => void saveNow(species.speciesProfileId, {speciesProfileId: species.speciesProfileId, hidden: !visible})}
                    onSaveNote={async (note) => {
                        const trimmedNote = note.trim();
                        const saved = await saveNow(species.speciesProfileId, {speciesProfileId: species.speciesProfileId, note: trimmedNote ? trimmedNote : null});
                        if (saved) setEditingNote(null);
                    }}
                />
            ))}

            <GuideBandHeader title="Photos from your captures" trailing={<span className="text-[11px] text-white/40">Tap to hide or show</span>} />
            {guide.media.length > 0 ? (
                <div className={`${GUIDE_BAND} grid grid-cols-3 gap-px bg-white/10 sm:grid-cols-4 md:grid-cols-5`}>
                    {guide.media.map((media, index) => (
                        <MediaTile
                            key={media.id ?? `${media.captureId}-${index}`}
                            media={media}
                            busy={busyItem === media.id}
                            onToggle={() => media.id ? void saveNow(media.id, {mediaId: media.id, hidden: !media.hidden}) : undefined}
                        />
                    ))}
                </div>
            ) : (
                <p className={`${GUIDE_BAND} px-[18px] py-3.5 text-xs text-white/50`}>No photos on this guide yet.</p>
            )}

            <GuideBandHeader title="For buyers only" />
            <div className={`${GUIDE_BAND} px-[18px] py-3.5`}>
                <p className="text-xs leading-5 text-white/60">
                    Local guides and operators you used, with what they charge: a boat captain, a ranger, a guesthouse. Buyers pay for these introductions, so add the people you&rsquo;d recommend. Only add someone who is happy to be contacted.
                </p>
            </div>
            {contacts.map((contact, index) => (
                <fieldset key={contact.key} className={`${GUIDE_BAND} grid gap-2 px-[18px] py-3.5`}>
                    <legend className="sr-only">Contact {index + 1}</legend>
                    <div className="flex items-center gap-2">
                        <input
                            aria-label={`Contact ${index + 1} name`}
                            placeholder="Name"
                            value={contact.name}
                            maxLength={120}
                            onChange={(event) => {
                                const value = event.target.value;
                                setMessage(null);
                                setContacts((rows) => rows.map((row) => row.key === contact.key ? {...row, name: value} : row));
                            }}
                            className={`${inputClass} font-semibold`}
                        />
                        <button
                            type="button"
                            onClick={() => setContacts((rows) => rows.filter((row) => row.key !== contact.key))}
                            className="shrink-0 px-2 py-2 text-xs font-semibold text-white/50 hover:text-red-300"
                            aria-label={`Remove contact ${index + 1}`}
                        >
                            Remove
                        </button>
                    </div>
                    {([["role", "Role, e.g. boat captain"], ["contact", "How to reach them"], ["note", "Price and tips, e.g. $40 for a half-day boat"]] as const).map(([key, placeholder]) => (
                        <input
                            key={key}
                            aria-label={`Contact ${index + 1} ${key === "contact" ? "how to reach them" : key}`}
                            placeholder={placeholder}
                            value={contact[key] ?? ""}
                            maxLength={500}
                            onChange={(event) => {
                                const value = event.target.value;
                                setMessage(null);
                                setContacts((rows) => rows.map((row) => row.key === contact.key ? {...row, [key]: value} : row));
                            }}
                            className={inputClass}
                        />
                    ))}
                </fieldset>
            ))}
            {contacts.length < GUIDE_MAX_CONTACTS ? (
                <button
                    type="button"
                    onClick={() => setContacts((rows) => [...rows, withKey({name: ""})])}
                    className={`${GUIDE_BAND} block px-[18px] py-3 text-left text-sm font-semibold hover:bg-[#262626]`}
                    style={{color: GUIDE_NEON}}
                >
                    + Add contact
                </button>
            ) : (
                <p className={`${GUIDE_BAND} px-[18px] py-3 text-xs text-white/45`}>A guide can have up to 10 contacts.</p>
            )}
            <TextField
                label="Notes for buyers"
                value={form.privateNotes}
                onChange={(value) => set("privateNotes", value)}
                limits={GUIDE_FIELD_LIMITS.privateNotes}
                rows={5}
                placeholder="Prices you paid, where you stayed, getting there, best spots to start"
            />

            <GuideBandHeader title="Delete" />
            {confirmDelete ? (
                <div className={`${GUIDE_BAND} px-[18px] py-4`}>
                    <p className="text-sm font-semibold text-white">Delete this guide?</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">It disappears for everyone, and AnimalDex won&rsquo;t make a new guide for this place.</p>
                    <div className="mt-3 flex gap-2.5">
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => void deleteGuide()}
                            className="rounded-full bg-red-500 px-4 py-2 text-xs font-extrabold text-white hover:bg-red-400 disabled:opacity-50"
                        >
                            {deleting ? "Deleting…" : "Delete guide"}
                        </button>
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-full border border-white/20 px-4 py-2 text-xs font-extrabold text-white hover:bg-white/[0.06]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className={`${GUIDE_BAND} block px-[18px] py-4 text-left text-sm font-semibold text-red-400 hover:bg-[#262626]`}
                >
                    Delete guide
                </button>
            )}

            {/* Sticky in the content column, above the mobile tab bar, so it never sits under the shell's navigation. */}
            <div className="sticky bottom-[5.25rem] z-30 mt-6 border-y border-white/10 bg-[#121212]/95 backdrop-blur-sm lg:bottom-0">
                <div className="flex items-center gap-3 px-[18px] py-3">
                    <p
                        role={message?.tone === "error" ? "alert" : "status"}
                        className={`min-w-0 flex-1 text-xs leading-5 ${message?.tone === "error" ? "text-red-300" : message ? "text-white/70" : problem && dirty ? "text-amber-200" : "text-white/45"}`}
                    >
                        {message?.text ?? (dirty ? problem ?? "You have unsaved changes." : "All changes saved.")}
                    </p>
                    <button
                        type="button"
                        disabled={saving || !dirty || Boolean(problem)}
                        onClick={() => void save()}
                        className="shrink-0 rounded-full px-5 py-2.5 text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-40"
                        style={{backgroundColor: GUIDE_NEON}}
                    >
                        <span className="inline-flex items-center gap-1.5"><SaveGlyph />{saving ? "Saving…" : "Save"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function TextField({label, value, onChange, limits, rows = 1, placeholder}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    limits: {min: number; max: number};
    rows?: number;
    placeholder?: string;
}) {
    const id = `guide-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
    const length = value.trim().length;
    const invalid = length > limits.max || (limits.min > 0 && length < limits.min);
    return (
        <div className={`${GUIDE_BAND} px-[18px] py-3`}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
                <label htmlFor={id} className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-white/45">{label}</label>
                <span className={`text-[11px] tabular-nums ${invalid ? "text-red-300" : "text-white/35"}`}>
                    {length}/{limits.max.toLocaleString("en")}
                    {limits.min > 0 && length < limits.min ? ` · at least ${limits.min}` : ""}
                </span>
            </div>
            {rows > 1 ? (
                <textarea id={id} rows={rows} value={value} placeholder={placeholder ?? label} onChange={(event) => onChange(event.target.value)} className={`${inputClass} resize-y leading-6`} />
            ) : (
                <input id={id} value={value} placeholder={placeholder ?? label} onChange={(event) => onChange(event.target.value)} className={inputClass} />
            )}
        </div>
    );
}

function SpeciesRow({species, busy, editing, onEdit, onToggle, onSaveNote}: {
    species: GuideSpecies;
    busy: boolean;
    editing: boolean;
    onEdit: () => void;
    onToggle: (visible: boolean) => void;
    onSaveNote: (note: string) => Promise<void>;
}) {
    const [note, setNote] = useState(species.note ?? "");
    useEffect(() => {
        if (!editing) setNote(species.note ?? "");
    }, [editing, species.note]);
    const action = species.threatened
        ? "Threatened: no spot or timing is shared"
        : species.noteIsDraft ? "Check the draft note" : species.note ? "Edit note" : "Add a note";
    return (
        <div className={`${GUIDE_BAND} px-[18px] py-2.5`}>
            <div className="flex items-center gap-3">
                <span className="h-11 w-11 shrink-0 overflow-hidden bg-[#2A2A2A]">
                    {species.photo ? <GuidePhoto media={species.photo} size="thumb" className={`h-full w-full ${species.hidden ? "opacity-40" : ""}`} /> : (
                        <span className="grid h-full w-full place-items-center text-white/35"><GuideGlyph name="paw" className="h-5 w-5" /></span>
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-2 ${species.hidden ? "text-white/40" : "text-white"}`}>
                        <span className="truncate text-sm font-semibold">{species.name}</span>
                        <RarityLabel rarity={species.rarity} />
                    </span>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="mt-0.5 block text-left text-xs font-semibold hover:underline"
                        style={{color: species.noteIsDraft && !species.threatened ? "#FFCC00" : GUIDE_NEON}}
                    >
                        {editing ? "Close note" : action}
                    </button>
                </span>
                <GuideSwitch checked={!species.hidden} disabled={busy} label={`Show ${species.name} in the guide`} onChange={onToggle} />
            </div>
            {!editing && species.note ? (
                <p className="mt-2 line-clamp-2 pl-14 text-xs leading-5 text-white/50">
                    {species.noteIsDraft ? <span className="mr-1 font-extrabold uppercase tracking-[0.06em] text-[#FFCC00]">Draft ·</span> : null}
                    {species.note}
                </p>
            ) : null}
            {editing ? (
                <div className="mt-3 grid gap-2 pb-1">
                    <p className={`text-xs leading-5 ${species.threatened ? "text-[#FF9F0A]" : "text-white/60"}`}>
                        {species.threatened
                            ? "This animal is threatened. Don't share an exact spot or time; point buyers to a licensed local guide instead."
                            : "Where in the area, what time of day, and anything that helped you find it. Only buyers read this."}
                    </p>
                    <textarea
                        aria-label={`Your note for ${species.name}`}
                        rows={6}
                        value={note}
                        placeholder="Your note"
                        onChange={(event) => setNote(event.target.value)}
                        className={`${inputClass} resize-y leading-6`}
                    />
                    <div className="flex items-center justify-between gap-3">
                        <span className={`text-[11px] ${note.length > GUIDE_NOTE_MAX ? "text-red-300" : "text-white/35"}`}>
                            {note.trim() ? `${note.trim().length}/${GUIDE_NOTE_MAX.toLocaleString("en")}` : "Leave it empty to bring back AnimalDex's draft."}
                        </span>
                        <span className="flex shrink-0 gap-2">
                            <button type="button" onClick={onEdit} className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/[0.06]">Cancel</button>
                            <button
                                type="button"
                                disabled={busy || note.trim().length > GUIDE_NOTE_MAX}
                                onClick={() => void onSaveNote(note)}
                                className="rounded-full px-3.5 py-1.5 text-xs font-extrabold text-black disabled:opacity-40"
                                style={{backgroundColor: GUIDE_NEON}}
                            >
                                {busy ? "Saving…" : "Save note"}
                            </button>
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function MediaTile({media, busy, onToggle}: {media: GuideMedia; busy: boolean; onToggle: () => void}) {
    return (
        <button
            type="button"
            disabled={busy || !media.id}
            onClick={onToggle}
            aria-label={media.hidden ? "Hidden photo. Tap to show" : "Shown photo. Tap to hide"}
            aria-pressed={!media.hidden}
            className="relative aspect-square overflow-hidden bg-[#1F1F1F] disabled:cursor-wait"
        >
            <GuidePhoto media={media} size="thumb" className={`h-full w-full transition ${media.hidden ? "opacity-30" : ""}`} />
            <span className="absolute right-1.5 top-1.5" style={{color: media.hidden ? "rgba(255,255,255,0.55)" : GUIDE_NEON}}>
                <GuideGlyph name={media.hidden ? "eye-off" : "check"} className="h-5 w-5 drop-shadow" />
            </span>
            {media.kind && media.kind !== "photo" ? (
                <span className="absolute bottom-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">{media.kind}</span>
            ) : null}
        </button>
    );
}
