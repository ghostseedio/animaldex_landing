"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {
    BIO_CHARACTER_LIMIT,
    CAPTURE_GRID_OPTIONS,
    PROFILE_STYLE_OPTIONS,
    type ProfileCaptureGridSort,
    type ProfileChromePreset,
    clampBio,
    normalizeUsername,
    usernameFormatProblem
} from "@/lib/profile-editor";

type Draft = {
    displayName: string;
    username: string;
    avatarUrl: string;
    bio: string;
    instagramUrl: string;
    chromePreset: ProfileChromePreset;
    captureGridSort: ProfileCaptureGridSort;
};

type UsernameState = {kind: "idle" | "checking" | "available" | "taken" | "unchanged"} | {kind: "invalid"; message: string};

const NEON = "#A7F432";
const STYLE_ICONS: Record<ProfileChromePreset, string> = {spirit: "✦", friend: "♥", professional: "▣", business: "↗"};

function SectionTitle({children}: {children: React.ReactNode}) {
    return <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">{children}</h2>;
}

/**
 * iOS `ProfileEditorView`: avatar, profile style, Wild Profile, capture grid,
 * then the basic info, saved together. Leaving with unsaved changes asks first.
 */
export default function ProfileEditor({initial, isRequired}: {initial: Draft; isRequired: boolean}) {
    const router = useRouter();
    const [draft, setDraft] = useState<Draft>(initial);
    const [usernameState, setUsernameState] = useState<UsernameState>({kind: "unchanged"});
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const libraryInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);

    const hasChanges = useMemo(() => (
        draft.displayName.trim() !== initial.displayName.trim()
        || normalizeUsername(draft.username) !== normalizeUsername(initial.username)
        || draft.bio.trim() !== initial.bio.trim()
        || draft.instagramUrl.trim() !== initial.instagramUrl.trim()
        || draft.chromePreset !== initial.chromePreset
        || draft.captureGridSort !== initial.captureGridSort
        || draft.avatarUrl.trim() !== initial.avatarUrl.trim()
    ), [draft, initial]);

    // Availability, 350 ms after typing stops.
    useEffect(() => {
        const normalized = normalizeUsername(draft.username);
        if (normalized === normalizeUsername(initial.username) && normalized) {
            setUsernameState({kind: "unchanged"});
            return;
        }
        const problem = usernameFormatProblem(normalized);
        if (problem) {
            setUsernameState(problem.kind === "invalid" ? problem : {kind: "taken"});
            return;
        }
        setUsernameState({kind: "checking"});
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetch(`/api/app/profile/username?u=${encodeURIComponent(normalized)}`, {signal: controller.signal, cache: "no-store"})
                .then((response) => response.json() as Promise<{state?: string; message?: string}>)
                .then((payload) => {
                    if (payload.state === "available") setUsernameState({kind: "available"});
                    else if (payload.state === "invalid") setUsernameState({kind: "invalid", message: payload.message ?? "Use letters, numbers, underscores, or dots."});
                    else setUsernameState({kind: "taken"});
                })
                .catch(() => undefined);
        }, 350);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [draft.username, initial.username]);

    useEffect(() => {
        if (!hasChanges) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [hasChanges]);

    const canSave = draft.displayName.trim().length > 0
        && normalizeUsername(draft.username).length > 0
        && (usernameState.kind === "available" || usernameState.kind === "unchanged")
        && hasChanges
        && !avatarBusy;

    async function uploadAvatar(file: File | undefined) {
        if (!file) return;
        setAvatarBusy(true);
        setError(null);
        try {
            const form = new FormData();
            form.append("avatar", file);
            const response = await fetch("/api/app/profile/avatar", {method: "POST", body: form});
            const payload = await response.json().catch(() => ({})) as {avatarUrl?: string; error?: string};
            if (!response.ok || !payload.avatarUrl) throw new Error(payload.error ?? "Could not load that photo.");
            setDraft((current) => ({...current, avatarUrl: payload.avatarUrl!}));
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Could not load that photo.");
        } finally {
            setAvatarBusy(false);
        }
    }

    async function save() {
        if (!canSave) {
            if (!draft.displayName.trim()) setError("Display name cannot be empty.");
            else if (!normalizeUsername(draft.username)) setError("Username cannot be empty.");
            else if (usernameState.kind === "taken") setError("That username is already taken.");
            else if (usernameState.kind === "checking") setError("Checking username availability.");
            else if (usernameState.kind === "invalid") setError("Enter a valid username.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/app/profile", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "update", ...draft})
            });
            const payload = await response.json().catch(() => ({})) as {error?: string};
            if (!response.ok) throw new Error(payload.error ?? "Couldn't save your profile.");
            router.push("/app/profile");
            router.refresh();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Couldn't save your profile.");
            setSaving(false);
        }
    }

    const usernameStatus = (() => {
        switch (usernameState.kind) {
            case "checking": return {text: "Checking…", tone: "text-white/45"};
            case "available": return {text: "✓ Available", tone: "text-primary-200"};
            case "taken": return {text: `@${normalizeUsername(draft.username)} is already taken`, tone: "text-red-300"};
            case "invalid": return {text: usernameState.message, tone: "text-red-300"};
            default: return null;
        }
    })();

    const field = "w-full bg-transparent text-right text-[15px] text-white outline-none placeholder:text-white/30";
    const name = draft.displayName.trim() || draft.username || "?";

    return (
        <div className="mx-auto w-full max-w-2xl pb-32">
            <header className="sticky top-16 z-20 -mx-4 mb-4 grid grid-cols-[1fr_auto_1fr] items-center bg-black/95 px-4 py-2.5 backdrop-blur-xl lg:top-0 md:mx-0 md:px-0">
                {isRequired ? <span /> : (
                    <button
                        type="button"
                        onClick={() => (hasChanges ? setConfirmDiscard(true) : router.push("/app/profile"))}
                        className="inline-flex min-h-10 items-center gap-1 justify-self-start text-sm font-bold text-primary-200"
                        aria-label="Back to profile"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                        Profile
                    </button>
                )}
                <h1 className="text-[17px] font-bold text-white">{isRequired ? "Complete your profile" : "Edit Profile"}</h1>
                <span />
            </header>

            <p className="mb-6 text-center text-sm text-white/55">This is how other AnimalDex explorers see you.</p>

            <section className="mb-7 flex flex-col items-center gap-3">
                <SectionTitle>AVATAR</SectionTitle>
                <span className="relative">
                    {draft.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.avatarUrl} alt="" className="h-[88px] w-[88px] rounded-full border border-white/10 object-cover" />
                    ) : (
                        <span className="grid h-[88px] w-[88px] place-items-center rounded-full border border-white/10 bg-[#1c1c1c] text-3xl font-bold text-primary-100">{name.slice(0, 1).toUpperCase()}</span>
                    )}
                    {avatarBusy ? <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" /></span> : null}
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-black bg-primary-400 text-xs text-black" aria-hidden="true">✎</span>
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => libraryInput.current?.click()} disabled={avatarBusy} className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[13px] font-bold text-white">Choose from Library</button>
                    <button type="button" onClick={() => cameraInput.current?.click()} disabled={avatarBusy} className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[13px] font-bold text-white md:hidden">Take a Photo</button>
                    {draft.avatarUrl ? (
                        <button type="button" onClick={() => setDraft((current) => ({...current, avatarUrl: ""}))} className="rounded-full border border-red-400/30 px-3.5 py-2 text-[13px] font-bold text-red-300">Remove Photo</button>
                    ) : null}
                </div>
                <input ref={libraryInput} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ""; }} />
                <input ref={cameraInput} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ""; }} />
                <p className="text-xs text-white/40">Use a clear photo. Changes are previewed before you save.</p>
            </section>

            <section className="mb-7">
                <SectionTitle>PROFILE STYLE</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                    {PROFILE_STYLE_OPTIONS.map((option) => {
                        const selected = draft.chromePreset === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setDraft((current) => ({...current, chromePreset: option.id}))}
                                className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition ${selected ? "border-primary-400/60 bg-primary-400/10" : "border-white/10 bg-[#141414] hover:bg-white/[0.05]"}`}
                            >
                                <span className="text-lg" style={{color: NEON}} aria-hidden="true">{STYLE_ICONS[option.id]}</span>
                                <span className="text-[15px] font-bold text-white">{option.title}</span>
                                <span className="text-[11px] leading-snug text-white/45">{option.detail}</span>
                                {selected ? <span className="absolute right-3 top-3 text-sm" style={{color: NEON}} aria-hidden="true">✓</span> : null}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mb-7">
                <Link href="/app/train/wild-profile" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141414] px-4 py-3.5 transition hover:bg-white/[0.05]">
                    <span className="text-lg" style={{color: NEON}} aria-hidden="true">🐾</span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-white">Open Wild Profile</span>
                        <span className="block text-[11px] text-white/45">View and manage your Wild Profile</span>
                    </span>
                    <span className="text-white/35" aria-hidden="true">›</span>
                </Link>
            </section>

            <section className="mb-7">
                <SectionTitle>CAPTURE GRID</SectionTitle>
                <p className="mb-2 px-1 text-xs text-white/45">Choose how captures are ordered on your public profile.</p>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]">
                    {CAPTURE_GRID_OPTIONS.map((option, index) => {
                        const selected = draft.captureGridSort === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setDraft((current) => ({...current, captureGridSort: option.id}))}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] ${index > 0 ? "border-t border-white/[0.08]" : ""}`}
                            >
                                <span className="w-5 text-center" style={{color: NEON}} aria-hidden="true">{option.id === "recent" ? "🕒" : "#"}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold text-white">{option.title}</span>
                                    <span className="block text-[11px] text-white/45">{option.detail}</span>
                                </span>
                                {selected ? <span style={{color: NEON}} aria-label="Selected">✓</span> : null}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mb-7">
                <SectionTitle>BASIC INFO</SectionTitle>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]">
                    <label className="flex items-center gap-3 px-4 py-3">
                        <span className="w-28 shrink-0 text-[15px] font-semibold text-white">Display Name</span>
                        <input value={draft.displayName} onChange={(event) => setDraft((current) => ({...current, displayName: event.target.value}))} placeholder="Your display name" className={field} maxLength={60} />
                    </label>
                    <div className="border-t border-white/[0.08] px-4 py-3">
                        <label className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-[15px] font-semibold text-white">Username</span>
                            <input
                                value={draft.username}
                                onChange={(event) => setDraft((current) => ({...current, username: event.target.value}))}
                                placeholder="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                className={field}
                                maxLength={30}
                            />
                        </label>
                        {usernameStatus ? <p className={`mt-1 text-right text-xs ${usernameStatus.tone}`} role="status">{usernameStatus.text}</p> : null}
                    </div>
                    <div className="border-t border-white/[0.08] px-4 py-3">
                        <label className="block">
                            <span className="text-[15px] font-semibold text-white">Bio</span>
                            <textarea
                                value={draft.bio}
                                onChange={(event) => setDraft((current) => ({...current, bio: clampBio(event.target.value)}))}
                                placeholder="A short note about your collecting style"
                                rows={3}
                                className="mt-2 w-full resize-none bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
                            />
                        </label>
                        <p className="text-right text-xs text-white/40">{Array.from(draft.bio).length}/{BIO_CHARACTER_LIMIT}</p>
                    </div>
                    <label className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-3">
                        <span className="w-28 shrink-0 text-[15px] font-semibold text-white">Instagram</span>
                        <input value={draft.instagramUrl} onChange={(event) => setDraft((current) => ({...current, instagramUrl: event.target.value}))} placeholder="@yourhandle or full URL" autoCapitalize="none" className={field} />
                    </label>
                </div>
            </section>

            <div className="fixed inset-x-0 bottom-[5.5rem] z-30 px-4 lg:bottom-6 lg:left-[17rem]">
                <div className="mx-auto max-w-2xl">
                    {error ? <p className="mb-2 rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm text-red-200" role="alert">{error}</p> : null}
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving || (!hasChanges && !isRequired)}
                        className="w-full rounded-full bg-primary-400 py-3.5 text-[15px] font-black text-black shadow-[0_12px_30px_-12px_rgba(167,244,50,0.6)] transition hover:brightness-105 disabled:opacity-40"
                    >
                        {saving ? "Saving…" : "Save Profile"}
                    </button>
                </div>
            </div>

            {confirmDiscard ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
                    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1c1c1c] p-5 text-center">
                        <h2 id="discard-title" className="text-[17px] font-bold text-white">Discard changes?</h2>
                        <div className="mt-5 grid gap-2">
                            <button type="button" onClick={() => router.push("/app/profile")} className="rounded-full bg-red-500 py-3 text-[15px] font-black text-white">Discard</button>
                            <button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-full border border-white/10 py-3 text-[15px] font-bold text-white">Keep Editing</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
