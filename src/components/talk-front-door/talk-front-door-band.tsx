"use client";

/**
 * The Talk front door (AnimalDex docs/talk-front-door/SPEC.md, section 4):
 * a full-width band with one field, "What's on your mind?", and the send
 * arrow inside it. While the field has focus or text, the "to" line under it
 * shows who will hear it: the animal's face (its icon art, never a capture
 * photo), its name and Power, the reason when the suggestion gave one, and
 * Change, which opens an inline sideways row of faces (never a sheet).
 *
 * Who is chosen is lib/talk-front-door, pure and tested: the default, the
 * suggestion (`/api/app/talk-suggest`, signed in, after Talk's gate), a
 * Change tap that holds for the draft, and the send wait. Sending opens the
 * chosen animal's chat with the text as the person's first message
 * (front-door-store hands it over; the conversation sends it with
 * `origin: "front_door"`). The unsent draft stays in this browser.
 *
 * Shown only with the remote switch `talk_front_door` on: the page decides.
 */

import {useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent} from "react";
import {useRouter} from "next/navigation";
import {useAiChatGate} from "@/components/ai-gate/ai-chat-gate";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {
    clearFrontDoorHandoff,
    handOffFrontDoorMessage,
    readFrontDoorDraft,
    writeFrontDoorDraft
} from "@/components/talk-front-door/front-door-store";
import {getLocalePath} from "@/lib/site";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {
    FRONT_DOOR_TEXT_MAX,
    NEW_DRAFT,
    SEND_WAIT_MS,
    SUGGEST_PAUSE_MS,
    applySuggestion,
    changeRowAnimals,
    choiceForText,
    decodeTalkSuggestion,
    defaultChoice,
    defaultFrontDoorAnimal,
    draftAnswered,
    draftCalled,
    frontDoorChatHref,
    frontDoorHandoff,
    frontDoorReason,
    frontDoorText,
    includeWild,
    pickManually,
    sendPlan,
    suggestionDue,
    type FrontDoorAnimal,
    type FrontDoorChoice,
    type FrontDoorDraft,
    type OwnFrontDoorAnimal,
    type TalkFrontDoorWords,
    type TalkSuggestion
} from "@/lib/talk-front-door";

/** Four lines of 24 px, then the field scrolls. */
const FIELD_MAX_HEIGHT = 96;
/** A suggestion that has not answered by then is given up on (the server's model stops at 3 s). */
const SUGGEST_TIMEOUT_MS = 8000;

function faceUrl(animal: FrontDoorAnimal): string | null {
    return animal.icon ?? (animal.slug ? getSpeciesImageRoute(animal.slug) : null);
}

function fill(template: string, name: string): string {
    return template.replace("{name}", name);
}

const ArrowUpIcon = () => (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 16V5m0 0-4.5 4.5M10 5l4.5 4.5" />
    </svg>
);

const Spinner = () => (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] motion-safe:animate-spin" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2.4} />
        <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
);

export default function TalkFrontDoorBand({
    words,
    surface,
    locale,
    signedIn,
    own,
    meetOneNow,
    className = ""
}: {
    words: TalkFrontDoorWords;
    /** Companions (`app`) or the Talk page (`talk`): where a chat on their own card opens. */
    surface: "app" | "talk";
    locale: string;
    /** Signed in: their animals, and the suggestion. A guest gets neither (SPEC 4.6). */
    signedIn: boolean;
    own: OwnFrontDoorAnimal[];
    /** The "Meet one now" (Companions) or featured (/talk) animals: the default with none of their own, and Change's wild ones until an answer. */
    meetOneNow: FrontDoorAnimal[];
    /** The band's own frame: the page's edge-to-edge rhythm. */
    className?: string;
}) {
    const router = useRouter();
    const gate = useAiChatGate();
    const rowId = useId();
    const fieldRef = useRef<HTMLTextAreaElement | null>(null);
    const bandRef = useRef<HTMLElement | null>(null);
    /** A press inside the band (Change, a face): the field's blur must not hide what is being pressed. */
    const pressingInside = useRef(false);

    const [text, setText] = useState("");
    const textRef = useRef("");
    const [active, setActive] = useState(false);
    const [changeOpen, setChangeOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [suggestion, setSuggestion] = useState<TalkSuggestion | null>(null);

    const fallback = useMemo(() => defaultFrontDoorAnimal(own, meetOneNow), [own, meetOneNow]);
    const [choice, setChoiceState] = useState<FrontDoorChoice>(() => defaultChoice(fallback));
    const choiceRef = useRef(choice);
    /** The choice now, for this render and for a send already waiting on it. */
    const setChoice = useCallback((next: (current: FrontDoorChoice) => FrontDoorChoice) => {
        const value = next(choiceRef.current);
        if (value === choiceRef.current) return;
        choiceRef.current = value;
        setChoiceState(value);
    }, []);

    const ownRef = useRef(own);
    ownRef.current = own;
    const draftRef = useRef<FrontDoorDraft>(NEW_DRAFT);
    /** Bumped for every new draft: an answer for an older one is dropped. */
    const draftGeneration = useRef(0);
    const lastEditAt = useRef(0);
    const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingCall = useRef<Promise<void> | null>(null);
    const callSequence = useRef(0);
    const appliedSequence = useRef(0);
    const controllers = useRef(new Set<AbortController>());

    // The suggestion runs only signed in, past Talk's gate (the switch is on, or there would be no band).
    const canSuggest = signedIn && gate.ready;
    const canSuggestRef = useRef(canSuggest);
    canSuggestRef.current = canSuggest;

    const sizeField = useCallback(() => {
        const node = fieldRef.current;
        if (!node) return;
        node.style.height = "auto";
        node.style.height = `${Math.min(node.scrollHeight, FIELD_MAX_HEIGHT)}px`;
    }, []);

    // The unsent draft comes back. The box is on screen, so no chat is
    // opening: a message no chat took is forgotten (its draft is here).
    useEffect(() => {
        clearFrontDoorHandoff();
        const stored = readFrontDoorDraft();
        if (stored) {
            textRef.current = stored;
            setText(stored);
            requestAnimationFrame(sizeField);
        }
        const live = controllers.current;
        return () => {
            if (pauseTimer.current) clearTimeout(pauseTimer.current);
            live.forEach((controller) => controller.abort());
        };
    }, [sizeField]);

    // The default follows their animals as they load, and a short draft goes back to it.
    useEffect(() => {
        setChoice((current) => choiceForText(current, text, draftRef.current, fallback));
    }, [text, fallback, setChoice]);

    /** Asks who should hear this text; resolves when the answer (or its failure) is in. */
    const askSuggestion = useCallback((raw: string): Promise<void> => {
        const asked = frontDoorText(raw);
        draftRef.current = draftCalled(draftRef.current, asked);
        const generation = draftGeneration.current;
        const sequence = ++callSequence.current;
        const controller = new AbortController();
        controllers.current.add(controller);
        const timeout = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
        const call = fetch("/api/app/talk-suggest", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            signal: controller.signal,
            body: JSON.stringify({text: asked, include_wild: includeWild(ownRef.current.length), exclude_species: []})
        })
            .then((response) => (response.ok ? response.json() as Promise<{ok?: boolean; suggestion?: unknown}> : null))
            .then((payload) => (payload?.ok ? decodeTalkSuggestion(payload.suggestion) : null))
            .catch(() => null)
            .then((answer) => {
                // Errors, timeouts, offline, feature_paused, past the cap: the choice stays, with no message.
                if (generation !== draftGeneration.current) return;
                draftRef.current = draftAnswered(draftRef.current, asked, answer !== null);
                if (!answer || sequence < appliedSequence.current) return;
                appliedSequence.current = sequence;
                setSuggestion(answer);
                setChoice((current) => (frontDoorText(textRef.current).length > 0
                    ? choiceForText(applySuggestion(current, answer, draftRef.current, ownRef.current), textRef.current, draftRef.current, defaultFrontDoorAnimal(ownRef.current, meetOneNow))
                    : current));
            })
            .finally(() => {
                clearTimeout(timeout);
                controllers.current.delete(controller);
                if (pendingCall.current === call) pendingCall.current = null;
            });
        pendingCall.current = call;
        return call;
    }, [meetOneNow, setChoice]);

    /** After a 700 ms pause: ask, when the draft qualifies. */
    const schedule = useCallback(() => {
        if (pauseTimer.current) clearTimeout(pauseTimer.current);
        pauseTimer.current = setTimeout(() => {
            pauseTimer.current = null;
            const raw = textRef.current;
            if (suggestionDue({draft: draftRef.current, text: raw, lastEditAt: lastEditAt.current, now: Date.now(), canSuggest: canSuggestRef.current})) {
                void askSuggestion(raw);
            }
        }, SUGGEST_PAUSE_MS);
    }, [askSuggestion]);

    // Talk's gate passed with a draft already there (one that came back): it may ask now.
    useEffect(() => {
        if (canSuggest && textRef.current.trim()) schedule();
    }, [canSuggest, schedule]);

    const newDraft = useCallback(() => {
        draftRef.current = NEW_DRAFT;
        draftGeneration.current += 1;
        pendingCall.current = null;
        setSuggestion(null);
        setChoice(() => defaultChoice(fallback));
    }, [fallback, setChoice]);

    const onChange = (value: string) => {
        const next = value.slice(0, FRONT_DOOR_TEXT_MAX);
        textRef.current = next;
        setText(next);
        writeFrontDoorDraft(next);
        lastEditAt.current = Date.now();
        sizeField();
        if (!next.trim()) {
            if (pauseTimer.current) clearTimeout(pauseTimer.current);
            newDraft();
            return;
        }
        schedule();
    };

    /**
     * Talk's gate before anything else (SPEC 4.5): focusing the field asks the
     * age check and the AI notice when they are still to be asked, then the
     * field is theirs; "Not now" leaves it.
     */
    const onFieldFocus = () => {
        if (gate.ready) return;
        void gate.request().then((allowed) => {
            if (allowed) fieldRef.current?.focus();
            else fieldRef.current?.blur();
        });
    };

    const send = async () => {
        const value = frontDoorText(textRef.current);
        if (!value || sending) return;
        if (!gate.ready && !(await gate.request())) return;
        if (pauseTimer.current) {
            clearTimeout(pauseTimer.current);
            pauseTimer.current = null;
        }
        const plan = sendPlan({draft: draftRef.current, text: value, canSuggest: canSuggestRef.current});
        if (plan !== "now") {
            // The suggestion for this text is on its way: wait for it, 2.5 s at most.
            setSending(true);
            const waitFor = plan === "call_and_wait" ? askSuggestion(value) : pendingCall.current ?? Promise.resolve();
            await Promise.race([waitFor, new Promise((resolve) => setTimeout(resolve, SEND_WAIT_MS))]);
        }
        const animal = choiceRef.current.animal;
        const href = animal ? frontDoorChatHref(animal, surface) : null;
        if (!animal || !href) {
            setSending(false);
            return;
        }
        // The chat takes it as their first message; the draft stays here until it has.
        setSending(true);
        handOffFrontDoorMessage(frontDoorHandoff(animal, value, Date.now()));
        router.push(getLocalePath(locale, href));
    };

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        void send();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void send();
        }
    };

    const pick = (animal: FrontDoorAnimal) => {
        const next = pickManually(draftRef.current, choiceRef.current, animal);
        draftRef.current = next.draft;
        setChoice(() => next.choice);
        setChangeOpen(false);
        fieldRef.current?.focus();
    };

    const animal = choice.animal;
    const showsTo = (active || text.trim().length > 0) && animal !== null;
    const reason = frontDoorReason(choice.why, words);
    const sendLabel = fill(words.sendTo, animal?.name ?? "").trim();
    const canSend = text.trim().length > 0 && animal !== null && !sending;
    const row = useMemo(
        () => (changeOpen ? changeRowAnimals({suggestion, own, wildFallback: meetOneNow, chosen: animal}) : []),
        [changeOpen, suggestion, own, meetOneNow, animal]
    );

    return (
        <section
            ref={bandRef}
            className={className}
            data-testid="talk-front-door"
            onFocus={() => setActive(true)}
            onKeyDown={(event) => {
                // Escape closes the faces, from the field or a face.
                if (event.key === "Escape" && changeOpen) {
                    event.stopPropagation();
                    setChangeOpen(false);
                }
            }}
            onBlur={(event) => {
                // Still inside the band (Change, a face): the "to" line stays.
                if (pressingInside.current || bandRef.current?.contains(event.relatedTarget as Node | null)) return;
                setActive(false);
            }}
            onPointerDownCapture={() => {
                pressingInside.current = true;
                const release = () => {
                    // After the click that follows the press has landed.
                    setTimeout(() => {
                        pressingInside.current = false;
                    }, 0);
                    window.removeEventListener("pointerup", release, true);
                    window.removeEventListener("pointercancel", release, true);
                };
                window.addEventListener("pointerup", release, true);
                window.addEventListener("pointercancel", release, true);
            }}
        >
            <form onSubmit={onSubmit}>
                <label htmlFor={`${rowId}-field`} className="sr-only">{words.placeholder}</label>
                <div className="flex items-end gap-2 rounded-[22px] border border-white/12 bg-white/[0.05] py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-primary-300/45">
                    <textarea
                        id={`${rowId}-field`}
                        ref={fieldRef}
                        value={text}
                        rows={1}
                        maxLength={FRONT_DOOR_TEXT_MAX}
                        placeholder={words.placeholder}
                        onFocus={onFieldFocus}
                        onChange={(event) => onChange(event.target.value)}
                        onKeyDown={onKeyDown}
                        className="max-h-24 min-h-[2.25rem] w-full min-w-0 resize-none bg-transparent py-1.5 text-[15px] leading-6 text-white outline-none placeholder:text-ink-400"
                        data-testid="talk-front-door-field"
                    />
                    <button
                        type="submit"
                        disabled={!canSend}
                        aria-label={sendLabel}
                        title={sendLabel}
                        aria-busy={sending}
                        className={`mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                            canSend || sending ? "bg-primary-400 text-canvas-950 hover:bg-primary-300 active:bg-primary-500" : "bg-white/8 text-ink-400"
                        }`}
                        data-testid="talk-front-door-send"
                    >
                        {sending ? <Spinner /> : <ArrowUpIcon />}
                    </button>
                </div>
            </form>
            {showsTo && animal ? (
                <div className="mt-2.5 flex items-center gap-2" data-testid="talk-front-door-to">
                    <div className="min-w-0 flex-1" aria-live="polite">
                        {/* A new animal fades in (180 ms) when the suggestion or Change picks it. */}
                        <div key={animal.key} className="front-door-fade flex min-w-0 items-center gap-2.5">
                            <AskAnimalFace url={faceUrl(animal)} size={28} />
                            <div className="min-w-0 flex-1">
                                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[13px] leading-[18px]">
                                    <span className="break-words font-semibold text-white">{animal.name}</span>
                                    {animal.power ? <span className="break-words text-ink-300">{animal.power}</span> : null}
                                </p>
                                {reason ? <p className="text-[11px] font-semibold leading-4 text-primary-300" data-testid="talk-front-door-reason">{reason}</p> : null}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setChangeOpen((open) => !open)}
                        aria-expanded={changeOpen}
                        aria-controls={`${rowId}-change`}
                        className="-mr-2 inline-flex min-h-9 shrink-0 items-center rounded-pill px-2 text-[13px] font-bold text-primary-300 transition-colors hover:text-primary-200 active:opacity-70"
                        data-testid="talk-front-door-change"
                    >
                        {words.change}
                    </button>
                </div>
            ) : null}
            {showsTo && changeOpen ? (
                // Inline, sideways, faces with names; a tap picks and closes (no sheet, no "see all").
                <div
                    id={`${rowId}-change`}
                    role="group"
                    aria-label={words.change}
                    className="mt-2 flex gap-1 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    data-testid="talk-front-door-faces"
                >
                    {row.map((option) => {
                        const selected = option.key === animal?.key;
                        return (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => pick(option)}
                                aria-pressed={selected}
                                aria-label={option.power ? `${option.name}, ${option.power}` : option.name}
                                className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-card px-1 pb-1.5 pt-2 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
                                data-testid="talk-front-door-face"
                            >
                                <AskAnimalFace url={faceUrl(option)} size={44} className={selected ? "ring-2 ring-primary-400" : ""} />
                                <span className={`line-clamp-2 w-full text-center text-[11px] leading-[14px] ${selected ? "font-bold text-white" : "font-semibold text-ink-200"}`}>{option.name}</span>
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </section>
    );
}
