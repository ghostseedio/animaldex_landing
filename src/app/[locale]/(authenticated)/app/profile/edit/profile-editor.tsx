"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {
    BIO_CHARACTER_LIMIT,
    captureGridChoices,
    type ProfileCaptureGridSort,
    clampBio,
    normalizeUsername,
    usernameFormatProblem
} from "@/lib/profile-editor";
import {AppRequestError} from "@/lib/user-facing-error";
import {useUserFacingError} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";

type Draft = {
    displayName: string;
    username: string;
    avatarUrl: string;
    bio: string;
    instagramUrl: string;
    captureGridSort: ProfileCaptureGridSort;
};

/** profile.editor.* in the locale files. */
export type ProfileEditorWords = Record<
    | "title" | "requiredTitle" | "back" | "save" | "saving" | "intro"
    | "changePhoto" | "addPhoto" | "profilePhoto" | "chooseFromLibrary" | "takePhoto" | "removePhoto" | "cancel"
    | "basicInfo" | "name" | "namePlaceholder" | "username" | "usernamePlaceholder" | "bio" | "bioPlaceholder"
    | "instagram" | "instagramPlaceholder" | "checking" | "available" | "taken"
    | "captureGrid" | "gridRecent" | "gridRecentDetail" | "gridIndex" | "gridIndexDetail" | "gridStars" | "gridStarsDetail"
    | "gridCustom" | "gridCustomDetail" | "customNone" | "customOne" | "customMany"
    | "discardTitle" | "discard" | "keepEditing",
    string
>;

type UsernameState = {kind: "idle" | "checking" | "available" | "taken" | "unchanged"} | {kind: "invalid"; message: string};

const NEON = "#A7F432";

/** iOS `AnimalDexBandHeader`. */
function BandHeader({children}: {children: React.ReactNode}) {
    return <h2 className="-mx-4 border-b border-white/[0.08] px-[18px] pb-2 pt-6 text-xs font-semibold uppercase tracking-[0.09em] text-white/70 md:mx-0">{children}</h2>;
}

/** iOS `.animalDexFullBleedBand()`: edge to edge, no inset card. */
const BAND = "-mx-4 border-b border-white/[0.08] bg-[#1F1F1F] md:mx-0";

const GRID_GLYPHS: Record<ProfileCaptureGridSort, React.ReactNode> = {
    recent: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    index: <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />,
    stars: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
    custom: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>
};

/**
 * iOS `ProfileEditorView`: the photo, then Basic info, then the Capture
 * grid, saved together from the bar's save button (the bottom bar while the
 * profile is being completed). Profile style and Wild Profile are hidden, as
 * on iOS. Leaving with unsaved changes asks first.
 */
export default function ProfileEditor({initial, isRequired, customCaptureCount, words}: {
    initial: Draft;
    isRequired: boolean;
    /** How many captures the app's custom grid holds (shown, not editable here). */
    customCaptureCount: number;
    words: ProfileEditorWords;
}) {
    const describeError = useUserFacingError();
    const router = useRouter();
    const [draft, setDraft] = useState<Draft>(initial);
    const [usernameState, setUsernameState] = useState<UsernameState>({kind: "unchanged"});
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [photoOptions, setPhotoOptions] = useState(false);
    const libraryInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);
    const gridChoices = useMemo(() => captureGridChoices(initial.captureGridSort), [initial.captureGridSort]);

    const hasChanges = useMemo(() => (
        draft.displayName.trim() !== initial.displayName.trim()
        || normalizeUsername(draft.username) !== normalizeUsername(initial.username)
        || draft.bio.trim() !== initial.bio.trim()
        || draft.instagramUrl.trim() !== initial.instagramUrl.trim()
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
        && (hasChanges || isRequired)
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
            if (!response.ok || !payload.avatarUrl) throw new AppRequestError(response.status, payload.error ?? null);
            setDraft((current) => ({...current, avatarUrl: payload.avatarUrl!}));
        } catch (failure) {
            setError(describeError(failure));
        } finally {
            setAvatarBusy(false);
        }
    }

    async function save() {
        if (saving) return;
        if (!canSave) {
            if (!draft.displayName.trim()) setError("Display name cannot be empty.");
            else if (!normalizeUsername(draft.username)) setError("Username cannot be empty.");
            else if (usernameState.kind === "taken") setError("That username is already taken.");
            else if (usernameState.kind === "checking") setError("Checking username availability.");
            else if (usernameState.kind === "invalid") setError(usernameState.message);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            // No profile style: it is hidden here, as on iOS, so the saved one stays.
            const response = await fetch("/api/app/profile", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "update", ...draft})
            });
            const payload = await response.json().catch(() => ({})) as {error?: string};
            if (!response.ok) throw new AppRequestError(response.status, payload.error ?? null);
            router.push("/app/profile");
            router.refresh();
        } catch (failure) {
            setError(describeError(failure));
            setSaving(false);
        }
    }

    const usernameStatus = (() => {
        switch (usernameState.kind) {
            case "checking": return {text: words.checking, tone: "text-white/55"};
            case "available": return {text: words.available, tone: "text-primary-300"};
            case "taken": return {text: words.taken.replace("{username}", normalizeUsername(draft.username)), tone: "text-red-300"};
            case "invalid": return {text: usernameState.message, tone: "text-red-300"};
            default: return null;
        }
    })();

    const gridTitle = (sort: ProfileCaptureGridSort) => ({
        recent: words.gridRecent, index: words.gridIndex, stars: words.gridStars, custom: words.gridCustom
    })[sort];
    const gridDetail = (sort: ProfileCaptureGridSort) => {
        if (sort === "custom" && draft.captureGridSort === "custom") {
            return customCaptureCount === 0
                ? words.customNone
                : customCaptureCount === 1 ? words.customOne : words.customMany.replace("{count}", String(customCaptureCount));
        }
        return ({recent: words.gridRecentDetail, index: words.gridIndexDetail, stars: words.gridStarsDetail, custom: words.gridCustomDetail})[sort];
    };

    const field = "w-full min-w-0 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/35 caret-primary-400";
    const label = "w-[92px] shrink-0 text-sm font-medium text-white/60";
    const hasAvatar = draft.avatarUrl.trim().length > 0;
    const leave = () => (hasChanges ? setConfirmDiscard(true) : router.push("/app/profile"));

    return (
        <div className={`mx-auto w-full max-w-2xl ${isRequired ? "pb-32" : "pb-12"}`}>
            <header className="sticky top-0 z-20 -mx-4 grid grid-cols-[2.75rem_1fr_2.75rem] items-center bg-black/95 px-2 py-1.5 backdrop-blur-xl md:mx-0 md:px-0">
                {isRequired ? <span /> : (
                    <button
                        type="button"
                        onClick={leave}
                        className="grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-white/[0.08]"
                        aria-label={words.back}
                    >
                        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                )}
                <h1 className="truncate text-center text-[17px] font-bold text-white">{isRequired ? words.requiredTitle : words.title}</h1>
                {isRequired ? <span /> : (
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving || !canSave}
                        aria-label={words.save}
                        className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-white/[0.08] disabled:hover:bg-transparent"
                        style={{color: canSave ? NEON : "rgba(255,255,255,0.35)"}}
                    >
                        {saving ? (
                            <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-primary-400 border-t-transparent" aria-hidden="true" />
                        ) : (
                            <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                            </svg>
                        )}
                    </button>
                )}
            </header>

            <section className="flex flex-col items-center px-4 pb-[22px] pt-5 text-center">
                <button type="button" onClick={() => setPhotoOptions(true)} aria-label={words.profilePhoto} className="relative rounded-full">
                    {hasAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.avatarUrl} alt="" className="h-[104px] w-[104px] rounded-full border border-white/10 object-cover" />
                    ) : (
                        <span className="grid h-[104px] w-[104px] place-items-center rounded-full border border-white/10 bg-[#1F1F1F] text-white/40">
                            <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.5-8 5.6V21h16v-1.4c0-3.1-3.6-5.6-8-5.6Z" /></svg>
                        </span>
                    )}
                    {avatarBusy ? <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" /></span> : null}
                </button>
                <button type="button" onClick={() => setPhotoOptions(true)} className="mt-3 py-1.5 text-sm font-semibold" style={{color: NEON}}>
                    {hasAvatar ? words.changePhoto : words.addPhoto}
                </button>
                <p className="mt-1 text-xs text-white/45">{words.intro}</p>
                <input ref={libraryInput} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ""; }} />
                <input ref={cameraInput} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ""; }} />
            </section>

            {error ? (
                <p className={`${BAND} flex items-baseline gap-2 border-t bg-red-500/[0.08] px-[18px] py-3 text-xs text-red-300`} role="alert">
                    <span aria-hidden="true">●</span>
                    {error}
                </p>
            ) : null}

            <BandHeader>{words.basicInfo}</BandHeader>
            <div className={BAND}>
                <label className="flex items-baseline gap-4 px-[18px] py-[15px]">
                    <span className={label}>{words.name}</span>
                    <input value={draft.displayName} onChange={(event) => { setError(null); setDraft((current) => ({...current, displayName: event.target.value})); }} placeholder={words.namePlaceholder} autoCorrect="off" className={field} maxLength={60} />
                </label>
                <div className="ml-[18px] h-px bg-white/[0.08]" />
                <div className="px-[18px] py-[15px]">
                    <label className="flex items-baseline gap-4">
                        <span className={label}>{words.username}</span>
                        <span className="flex min-w-0 flex-1 items-baseline gap-0.5">
                            <span className="text-[15px] text-white/40" aria-hidden="true">@</span>
                            <input
                                value={draft.username}
                                onChange={(event) => { setError(null); setDraft((current) => ({...current, username: normalizeUsername(event.target.value)})); }}
                                placeholder={words.usernamePlaceholder}
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                className={field}
                                maxLength={30}
                            />
                            {usernameState.kind === "available" ? <span className="text-xs font-bold" style={{color: NEON}} aria-hidden="true">✓</span> : null}
                            {usernameState.kind === "taken" || usernameState.kind === "invalid" ? <span className="text-xs font-bold text-red-300" aria-hidden="true">✕</span> : null}
                        </span>
                    </label>
                    {usernameStatus ? <p className={`mt-1.5 pl-[108px] text-xs font-medium ${usernameStatus.tone}`} role="status">{usernameStatus.text}</p> : null}
                </div>
                <div className="ml-[18px] h-px bg-white/[0.08]" />
                <div className="px-[18px] py-[15px]">
                    <label className="flex items-baseline gap-4">
                        <span className={label}>{words.bio}</span>
                        <textarea
                            value={draft.bio}
                            onChange={(event) => { setError(null); setDraft((current) => ({...current, bio: clampBio(event.target.value)})); }}
                            placeholder={words.bioPlaceholder}
                            rows={2}
                            className={`${field} resize-none`}
                        />
                    </label>
                    <p className="mt-1.5 text-right text-[11px] font-semibold tabular-nums text-white/40">{Array.from(draft.bio).length}/{BIO_CHARACTER_LIMIT}</p>
                </div>
                <div className="ml-[18px] h-px bg-white/[0.08]" />
                <label className="flex items-baseline gap-4 px-[18px] py-[15px]">
                    <span className={label}>{words.instagram}</span>
                    <input value={draft.instagramUrl} onChange={(event) => { setError(null); setDraft((current) => ({...current, instagramUrl: event.target.value})); }} placeholder={words.instagramPlaceholder} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={field} />
                </label>
            </div>

            {isRequired ? null : (
                <>
                    <BandHeader>{words.captureGrid}</BandHeader>
                    <div className={BAND} role="radiogroup" aria-label={words.captureGrid}>
                        {gridChoices.map((sort, index) => {
                            const selected = draft.captureGridSort === sort;
                            return (
                                <div key={sort}>
                                    {index > 0 ? <div className="ml-[58px] h-px bg-white/[0.08]" /> : null}
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => { setError(null); setDraft((current) => ({...current, captureGridSort: sort})); }}
                                        className="flex w-full items-center gap-3 px-[18px] py-3.5 text-left transition hover:bg-white/[0.04]"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-[18px] w-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{color: selected ? NEON : "rgba(255,255,255,0.4)"}}>
                                            {GRID_GLYPHS[sort]}
                                        </svg>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[15px] font-semibold text-white">{gridTitle(sort)}</span>
                                            <span className="mt-0.5 block text-xs font-medium text-white/60">{gridDetail(sort)}</span>
                                        </span>
                                        <span className="text-sm font-bold transition-opacity" style={{color: NEON, opacity: selected ? 1 : 0}} aria-hidden="true">✓</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isRequired ? (
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/95 px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-3 lg:left-[17rem]">
                    <div className="mx-auto max-w-2xl">
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={saving || !canSave}
                            className="flex w-full items-center justify-center gap-2 rounded-full py-[15px] text-base font-black text-black transition disabled:cursor-not-allowed"
                            style={{backgroundColor: canSave && !saving ? NEON : "rgba(167,244,50,0.35)"}}
                        >
                            {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/70 border-t-transparent" aria-hidden="true" /> : null}
                            {saving ? words.saving : words.save}
                        </button>
                    </div>
                </div>
            ) : null}

            {photoOptions ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 md:items-center" role="dialog" aria-modal="true" aria-labelledby="photo-options-title" onClick={() => setPhotoOptions(false)}>
                    <div className="w-full max-w-sm space-y-2" onClick={(event) => event.stopPropagation()}>
                        <div className="overflow-hidden bg-[#262626]">
                            <p id="photo-options-title" className="px-4 py-3 text-center text-[13px] font-semibold text-white/55">{words.profilePhoto}</p>
                            <button type="button" onClick={() => { setPhotoOptions(false); libraryInput.current?.click(); }} className="block w-full border-t border-white/[0.08] py-3.5 text-[17px] text-white hover:bg-white/[0.04]">{words.chooseFromLibrary}</button>
                            <button type="button" onClick={() => { setPhotoOptions(false); cameraInput.current?.click(); }} className="block w-full border-t border-white/[0.08] py-3.5 text-[17px] text-white hover:bg-white/[0.04] md:hidden">{words.takePhoto}</button>
                            {hasAvatar ? (
                                <button type="button" onClick={() => { setPhotoOptions(false); setDraft((current) => ({...current, avatarUrl: ""})); }} className="block w-full border-t border-white/[0.08] py-3.5 text-[17px] text-red-400 hover:bg-white/[0.04]">{words.removePhoto}</button>
                            ) : null}
                        </div>
                        <button type="button" onClick={() => setPhotoOptions(false)} className="block w-full bg-[#262626] py-3.5 text-[17px] font-semibold text-white hover:bg-[#2c2c2c]">{words.cancel}</button>
                    </div>
                </div>
            ) : null}

            {confirmDiscard ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 md:items-center" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" onClick={() => setConfirmDiscard(false)}>
                    <div className="w-full max-w-sm space-y-2" onClick={(event) => event.stopPropagation()}>
                        <div className="overflow-hidden bg-[#262626]">
                            <p id="discard-title" className="px-4 py-3 text-center text-[13px] font-semibold text-white/55">{words.discardTitle}</p>
                            <button type="button" onClick={() => router.push("/app/profile")} className="block w-full border-t border-white/[0.08] py-3.5 text-[17px] text-red-400 hover:bg-white/[0.04]">{words.discard}</button>
                        </div>
                        <button type="button" onClick={() => setConfirmDiscard(false)} className="block w-full bg-[#262626] py-3.5 text-[17px] font-semibold text-white hover:bg-[#2c2c2c]">{words.keepEditing}</button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
