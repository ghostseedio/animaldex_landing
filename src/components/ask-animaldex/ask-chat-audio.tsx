"use client";

/**
 * The animal's voice and sounds in its chat: the header's speaker (replies
 * speak by themselves while it is on), the chat's ••• menu with its call and
 * its sounds, the voice icon beside a reply, and whose recordings its sounds
 * are. The web counterparts of the iOS header speaker button, options menu,
 * `AnimalChatSpeakIcon` and `AnimalChatSoundCreditsSheet` (AnimalDex
 * 7c7d6b72, 46809a93, 6471f467).
 */

import type {ReactNode} from "react";
import {AskMenu, MoreIcon, type AskMenuItem} from "@/components/ask-animaldex/ask-messenger";
import type {AskSoundBank} from "@/lib/ask-animaldex/animal-sounds";

export type AskChatAudioLabels = {
    chatOptions: string;
    voiceOff: string;
    voiceOn: string;
    hearCall: string;
    animalSounds: string;
    soundCredits: string;
};

/** The header's speaker and the chat's ••• menu, side by side. */
export function AskChatOptions({
    labels,
    voiceAvailable,
    autoplay,
    onAutoplay,
    bank,
    soundsOn,
    onSounds,
    onHearCall,
    onCredits,
    extraItems = []
}: {
    labels: AskChatAudioLabels;
    /** A signed-in reader: the voice is per account. */
    voiceAvailable: boolean;
    autoplay: boolean;
    onAutoplay: (on: boolean) => void;
    /** The species' sounds, once loaded; null for an animal with no recordings. */
    bank: AskSoundBank | null;
    soundsOn: boolean;
    onSounds: (on: boolean) => void;
    onHearCall: () => void;
    onCredits: () => void;
    /** The chat's other choices: on the owner's chat, whether the animal may write to them. */
    extraItems?: AskMenuItem[];
}) {
    const soundItems: AskMenuItem[] = bank
        ? [
            // Its own call only; the sounds of where it lives play by themselves (AnimalDex ae2bec96).
            ...(soundsOn && bank.kind === "species" ? [{label: labels.hearCall, icon: <CallIcon />, onSelect: onHearCall}] : []),
            {label: labels.animalSounds, icon: <SoundIcon />, checked: soundsOn, onSelect: () => onSounds(!soundsOn)},
            ...(bank.credits.length > 0 ? [{label: labels.soundCredits, icon: <CreditIcon />, onSelect: onCredits}] : [])
        ]
        : [];
    const items = [...extraItems, ...soundItems];
    return (
        <>
            {voiceAvailable ? (
                <button
                    type="button"
                    onClick={() => onAutoplay(!autoplay)}
                    aria-label={autoplay ? labels.voiceOff : labels.voiceOn}
                    title={autoplay ? labels.voiceOff : labels.voiceOn}
                    aria-pressed={autoplay}
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white"
                >
                    {autoplay ? <SpeakerIcon /> : <SpeakerOffIcon />}
                </button>
            ) : null}
            {items.length > 0 ? (
                <AskMenu
                    label={labels.chatOptions}
                    items={items}
                    buttonClassName="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white"
                >
                    <MoreIcon />
                </AskMenu>
            ) : null}
        </>
    );
}

/** Hear the reply in the animal's voice: a small control beside its last bubble, quiet until it plays. */
export function AskVoiceIcon({
    loading,
    playing,
    onClick,
    label
}: {
    loading: boolean;
    playing: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
            aria-label={label}
            title={label}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors ${
                playing ? "bg-primary-400 text-canvas-950" : "bg-white/[0.06] text-ink-300 hover:text-white"
            }`}
        >
            {loading ? (
                <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-primary-400/30 border-t-primary-400" />
            ) : playing ? (
                <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                    <rect x="4" y="4" width="12" height="12" rx="2" />
                </svg>
            ) : (
                <SpeakerIcon />
            )}
        </button>
    );
}

/**
 * Whose recordings the animal's sounds are cut from. The licences (CC0,
 * CC BY, CC BY-SA) ask for the recordist's name, the licence and a link, and
 * for saying that the recording was edited.
 */
export function AskSoundCreditsPanel({
    bank,
    animalName,
    labels,
    onBack
}: {
    bank: AskSoundBank;
    animalName: string;
    labels: {soundCredits: string; soundCreditsSpecies: string; soundCreditsHabitat: string; soundOriginal: string; memoryBack: string};
    onBack: () => void;
}) {
    const explanation = bank.kind === "habitat" && bank.habitatLabel
        ? labels.soundCreditsHabitat.replace("{habitat}", bank.habitatLabel).replace("{animal}", animalName)
        : labels.soundCreditsSpecies.replace("{animal}", animalName);
    return (
        <div className="flex flex-col gap-4" data-testid="ask-sound-credits">
            <div>
                <h2 className="font-display text-xl font-bold leading-7 text-white">{labels.soundCredits}</h2>
                <p className="mt-1.5 text-sm leading-6 text-ink-300">{explanation}</p>
            </div>
            <ul className="-mx-4 border-t border-white/10">
                {bank.credits.map((credit) => (
                    <li key={`${credit.recordist}|${credit.page ?? credit.source}`} className="border-b border-white/10 px-4 py-3">
                        <p className="text-sm font-semibold text-white">{credit.recordist}</p>
                        <p className="mt-0.5 text-[11px] text-ink-400">{[credit.license, credit.source].filter(Boolean).join(" · ")}</p>
                        {credit.page ? (
                            <a
                                href={credit.page}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-200 transition-colors hover:text-primary-100"
                            >
                                {labels.soundOriginal}
                                <ArrowUpRightIcon />
                            </a>
                        ) : null}
                    </li>
                ))}
            </ul>
            <button type="button" onClick={onBack} className="self-start text-xs font-semibold text-primary-200 hover:text-primary-100">
                {labels.memoryBack}
            </button>
        </div>
    );
}

function icon(path: ReactNode, strokeWidth = 2) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

const SpeakerIcon = () => icon(<path d="M3.5 8v4h3l4 3.5v-11l-4 3.5Zm10-1.5a4.5 4.5 0 0 1 0 7m2-9.5a7.5 7.5 0 0 1 0 12" />);
const SpeakerOffIcon = () => icon(<path d="M3.5 8v4h3l4 3.5v-11l-4 3.5Zm10 0 4 4m0-4-4 4" />);
const CallIcon = () => icon(<path d="M3 13.5V6.8A1.8 1.8 0 0 1 4.8 5h7.4A1.8 1.8 0 0 1 14 6.8v3.4a1.8 1.8 0 0 1-1.8 1.8H5.5Zm13-5.5a2.5 2.5 0 0 1 0 4" />);
const SoundIcon = () => icon(<path d="M4 10h1.5m2.5-4v8m3-10v12m3-9v6m2.5-3H16" />);
const CreditIcon = () => icon(<path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm2.2-8.8a2.6 2.6 0 1 0 0 3.6" />);
const ArrowUpRightIcon = () => icon(<path d="M6.5 13.5l7-7m0 0h-5m5 0v5" />, 2.2);
