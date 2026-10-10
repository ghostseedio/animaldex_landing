"use client";

import {useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";

/**
 * Member-profile header controls, after iOS `header(user)` and
 * `memberModerationMenu`: notification bell (only while following), the
 * Follow / Following / Friends capsule, and a vertical-dots menu with Report
 * Profile and Block User. Writes go through `/api/app/profile/social`.
 *
 * iOS lets a signed-out tap fail with an auth error; the web sends the visitor
 * to sign in instead.
 */

type Preference = "all" | "off";

const NEON = "#A7F432";

async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/app/profile/social", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Something went wrong. Try again.");
    return payload;
}

export default function ProfileSocialControls({
    profileUserId,
    displayName,
    isLoggedIn,
    signInHref,
    initialIsFollowing,
    initialIsFriend,
    initialPreference,
    onFollowersChange
}: {
    profileUserId: string;
    displayName: string;
    isLoggedIn: boolean;
    signInHref: string;
    initialIsFollowing: boolean;
    initialIsFriend: boolean;
    initialPreference: Preference;
    onFollowersChange?: (delta: number) => void;
}) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isFriend, setIsFriend] = useState(initialIsFriend);
    const [preference, setPreference] = useState<Preference>(initialPreference);
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [bellOpen, setBellOpen] = useState(false);
    const [alert, setAlert] = useState<string | null>(null);
    const [blocked, setBlocked] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const close = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
        };
        window.addEventListener("mousedown", close);
        return () => window.removeEventListener("mousedown", close);
    }, [menuOpen]);

    async function toggleFollow() {
        const next = !isFollowing;
        // Optimistic, rolled back on error — as iOS `setFollowing` does.
        setIsFollowing(next);
        if (!next) setIsFriend(false);
        onFollowersChange?.(next ? 1 : -1);
        setBusy(true);
        try {
            const result = await post({action: next ? "follow" : "unfollow", profileUserId});
            setIsFriend(Boolean(result.isFriend));
        } catch (error) {
            setIsFollowing(!next);
            onFollowersChange?.(next ? -1 : 1);
            setAlert(error instanceof Error ? error.message : "Something went wrong.");
        } finally {
            setBusy(false);
        }
    }

    async function choosePreference(value: Preference) {
        const previous = preference;
        setPreference(value);
        try {
            await post({action: "notifications", profileUserId, preference: value});
        } catch (error) {
            setPreference(previous);
            setAlert(error instanceof Error ? error.message : "Something went wrong.");
        }
    }

    async function moderate(action: "report" | "block") {
        setMenuOpen(false);
        try {
            const result = await post({action, profileUserId});
            setAlert(result.message ?? null);
            if (action === "block") setBlocked(true);
        } catch (error) {
            setAlert(error instanceof Error ? error.message : "Moderation tools are unavailable right now.");
        }
    }

    const capsule = "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-[11px] text-[11px] font-extrabold transition";
    const followButton = !isLoggedIn ? (
        <Link href={signInHref} className={`${capsule} text-black/90`} style={{backgroundColor: NEON}}>
            + Follow
        </Link>
    ) : (
        <button
            type="button"
            onClick={toggleFollow}
            disabled={busy || blocked}
            aria-label={isFollowing ? "Unfollow" : "Follow"}
            className={`${capsule} disabled:opacity-60 ${isFollowing ? "border border-white/10 bg-white/[0.08] text-white hover:bg-white/[0.12]" : "text-black/90"}`}
            style={isFollowing ? undefined : {backgroundColor: NEON}}
        >
            {isFollowing ? (isFriend ? "Friends" : "Following") : "+ Follow"}
        </button>
    );

    return (
        <>
            {isLoggedIn && isFollowing ? (
                <button
                    type="button"
                    onClick={() => setBellOpen(true)}
                    aria-label="Notifications"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-white transition hover:bg-white/[0.12]"
                >
                    <svg viewBox="0 0 24 24" className={`h-[13px] w-[13px] ${preference === "off" ? "opacity-50" : ""}`} fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.1V8.5a6 6 0 0 0-6-6Zm-2.6 16a2.7 2.7 0 0 0 5.2 0H9.4Z" />
                        {preference === "off" ? <path d="M3.5 3.5 20.5 20.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /> : null}
                    </svg>
                </button>
            ) : null}
            {followButton}
            <div ref={menuRef} className="relative">
                <button
                    type="button"
                    onClick={() => (isLoggedIn ? setMenuOpen((open) => !open) : window.location.assign(signInHref))}
                    aria-label="Profile options"
                    aria-expanded={menuOpen}
                    className="grid h-9 w-8 place-items-center transition hover:opacity-80"
                    style={{color: NEON}}
                >
                    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                    </svg>
                </button>
                {menuOpen ? (
                    <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden border border-white/10 bg-[#171717] shadow-2xl light:bg-surface-900" role="menu">
                        <button type="button" role="menuitem" onClick={() => moderate("report")} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-red-400 hover:bg-white/[0.05]">
                            Report Profile
                        </button>
                        <button type="button" role="menuitem" onClick={() => moderate("block")} className="flex w-full items-center gap-2.5 border-t border-white/[0.06] px-4 py-3 text-left text-sm font-semibold text-red-400 hover:bg-white/[0.05]">
                            Block User
                        </button>
                    </div>
                ) : null}
            </div>

            {bellOpen ? (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 md:items-center md:p-4" role="dialog" aria-modal="true" aria-label="Notifications" onClick={() => setBellOpen(false)}>
                    <div className="w-full max-w-md border border-white/10 bg-[#171717] p-5 light:bg-surface-900" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="font-display text-xl font-bold text-white">Notifications</h2>
                            <button type="button" onClick={() => setBellOpen(false)} className="text-sm font-bold" style={{color: NEON}}>Done</button>
                        </div>
                        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">Notifications from {displayName}</p>
                        <div className="mt-2 border border-white/10">
                            {([
                                ["all", "All activity", "Get notified when they post a new capture."],
                                ["off", "Off", "Stay following. You just won't be notified."]
                            ] as const).map(([value, title, detail], index) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => choosePreference(value)}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] ${index > 0 ? "border-t border-white/10" : ""}`}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-white">{title}</span>
                                        <span className="block text-xs text-white/45">{detail}</span>
                                    </span>
                                    {preference === value ? <span aria-label="Selected" style={{color: NEON}}>✓</span> : null}
                                </button>
                            ))}
                        </div>
                        <p className="mt-3 text-xs leading-5 text-white/40">
                            You&rsquo;ll still follow {displayName} and still see their captures in your feed. This only controls notifications about their activity.
                        </p>
                    </div>
                </div>
            ) : null}

            {alert ? (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-label="Community Safety">
                    <div className="w-full max-w-sm border border-white/10 bg-[#171717] p-5 text-center light:bg-surface-900">
                        <h2 className="font-display text-lg font-bold text-white">Community Safety</h2>
                        <p className="mt-2 text-sm leading-6 text-white/60">{alert}</p>
                        <button
                            type="button"
                            onClick={() => {
                                setAlert(null);
                                if (blocked) window.location.assign("/");
                            }}
                            className="mt-4 h-10 w-full text-sm font-extrabold text-black"
                            style={{backgroundColor: NEON}}
                        >
                            OK
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}
