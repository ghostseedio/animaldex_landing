"use client";

/**
 * Naming your animal: the card's nickname (`captures.title`), "Luna the Gray
 * Wolf" everywhere the animal is named.
 *
 * Two forms, as iOS has them. In the chat, "Name your {animal}" (iOS
 * `AnimalCompanionNameSheet`): a name is required. On the card, Add or Edit
 * Nickname (iOS Customize Card): blank takes the name away and the card
 * shows the animal's own.
 *
 * A bottom sheet with Cancel · title · Save across its top, inside the chat's
 * panel (`placement="panel"`) or over the page.
 */

import {useEffect, useRef, useState} from "react";
import {CAPTURE_NICKNAME_MAX, normalizeCaptureNickname, saveCaptureNickname} from "@/lib/capture-nickname";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {reloadCompanionCards, reloadCompanions} from "@/components/companions/use-companions";

export default function AnimalNameSheet({
    captureId,
    animalName,
    initialName,
    mode,
    words,
    placement = "page",
    onSaved,
    onClose
}: {
    captureId: string;
    animalName: string;
    initialName: string | null;
    /** "name": the chat's, a name required. "card": the card's, blank allowed. */
    mode: "name" | "card";
    words: CompanionWords;
    placement?: "panel" | "page";
    onSaved: (nickname: string | null) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(initialName ?? "");
    const [isSaving, setIsSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => inputRef.current?.focus(), []);

    const trimmed = normalizeCaptureNickname(name);
    const unchanged = (trimmed ?? "") === (initialName ?? "");
    const canSave = !isSaving && !unchanged && (mode === "card" || trimmed !== null);
    const title = mode === "name"
        ? fillWords(words.naming.nameYour, {animal: animalName})
        : initialName ? words.naming.editNickname : words.naming.addNickname;

    const save = async () => {
        if (!canSave) return;
        setIsSaving(true);
        setFailed(false);
        try {
            const saved = await saveCaptureNickname(captureId, trimmed);
            // Every row that names the animal says it now.
            void reloadCompanions();
            void reloadCompanionCards();
            onSaved(saved);
            onClose();
        } catch {
            setFailed(true);
            setIsSaving(false);
        }
    };

    return (
        <div
            className={`${placement === "panel" ? "absolute" : "fixed"} inset-0 z-[70] flex flex-col justify-end bg-canvas-950/70`}
            onClick={isSaving ? undefined : onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`w-full border-t border-white/12 bg-canvas-900 pb-5 ${placement === "page" ? "mx-auto max-w-lg sm:mb-[max(1.5rem,10vh)] sm:border" : ""}`}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && !isSaving) {
                        event.stopPropagation();
                        onClose();
                    }
                }}
            >
                <div className="flex h-12 items-center gap-3 border-b border-white/[0.08] px-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="text-sm font-semibold text-ink-300 transition-colors hover:text-white disabled:opacity-40"
                    >
                        {words.naming.cancel}
                    </button>
                    <h2 className="min-w-0 flex-1 truncate text-center text-sm font-bold text-white">{title}</h2>
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={!canSave}
                        className="text-sm font-black text-primary-300 transition-colors enabled:hover:text-primary-200 disabled:text-white/25"
                    >
                        {isSaving ? "…" : words.naming.save}
                    </button>
                </div>
                <form
                    className="flex flex-col gap-2 px-4 pt-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        maxLength={CAPTURE_NICKNAME_MAX}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={mode === "name" ? words.naming.nickname : words.naming.example}
                        aria-label={words.naming.nickname}
                        autoComplete="off"
                        autoCapitalize="words"
                        spellCheck={false}
                        disabled={isSaving}
                        className="w-full border border-white/12 bg-white/[0.05] px-3.5 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-primary-300/50"
                    />
                    <p className="text-xs leading-5 text-ink-400">{mode === "name" ? words.naming.hint : words.naming.leaveBlank}</p>
                    {failed ? <p role="alert" className="text-xs font-semibold leading-5 text-amber-300">{words.naming.failed}</p> : null}
                </form>
            </div>
        </div>
    );
}
