"use client";

/**
 * The Companions tab as the chat (the owner, 2026-11-06; iOS
 * `CompanionsTabView`'s chat root): the animal they were with last, open, in
 * the conversation the Talk page renders full-screen; the others a switch
 * away, like a model switcher. On a wide screen their animals are a column
 * beside the chat; on a phone the header's name (or its menu button) opens
 * them as a slide-over. A tap puts that animal's own conversation here.
 * Nothing moves between conversations: what was said to one animal stays
 * with it. The chat stays on its animal while the tab lives, so a message
 * from another animal is a dot on the switch, never a chat that changes
 * under them.
 */

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import {plusItemInput, takePhotoOpensCameraApp, type CaptureEntry} from "@/lib/capture-entry";
import {setPendingCaptureFile} from "@/lib/capture-handoff";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import AskConversation, {type AskConversationPage, type AskDrawerLabels} from "@/components/ask-animaldex/ask-conversation";
import {AskSubjectBridge} from "@/components/ask-animaldex/ask-animaldex-provider";
import {chatCaptureIdFor} from "@/components/companions/use-companions";
import {askDeclaredSubject} from "@/lib/ask-animaldex/subject";
import type {TalkWords} from "@/lib/ask-animaldex/talk";
import type {CompanionWords} from "@/lib/companion-bond";
import type {CompanionCard} from "@/lib/companion-cards";
import type {rosterLine} from "@/lib/companion-roster";
import type {CompanionTabRow} from "@/lib/companion-rows";
import {pickCompanionToOpen, rememberCompanion, rememberedCompanion, type CompanionsOpeningMemory} from "@/lib/companions-opening";
import {COMPANIONS_SWITCH_EVENT} from "@/components/companions/use-companion-roster";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

export type CompanionsChatEntry = {row: CompanionTabRow; line: ReturnType<typeof rosterLine>; time: number | null};

/** With more animals than fit a screen, a field to find one. */
const SEARCH_FROM = 9;

/** Before the first paint in the browser; a plain effect on the server, where there is no paint. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Fills from where it sits to the foot of the viewport, above the shell's bottom chrome. */
function useFillToFoot(ref: React.RefObject<HTMLDivElement | null>): string | undefined {
    const [height, setHeight] = useState<string | undefined>(undefined);
    useIsomorphicLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const measure = () => {
            const top = Math.max(0, Math.round(element.getBoundingClientRect().top + window.scrollY));
            // No bars under the chat (the owner, 2026-11-06): it runs to the foot everywhere.
            const reserve = 0;
            setHeight(`calc(100dvh - ${top}px - ${reserve}px)`);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [ref]);
    return height;
}

export default function CompanionsChat({entries, cards, words, labels, talk, locale}: {
    entries: CompanionsChatEntry[];
    cards: CompanionCard[];
    words: CompanionWords;
    labels: AskDrawerLabels;
    talk: TalkWords;
    locale: string;
}) {
    const pathname = usePathname() ?? "/app";
    const {setBottomNavHidden, toggleMenu, profileName} = useAppShellChrome();
    // The phone's tab bar goes away while the chat fills the tab; the drawer carries the other tabs.
    useEffect(() => {
        setBottomNavHidden(true);
        return () => setBottomNavHidden(false);
    }, [setBottomNavHidden]);
    const rows = useMemo(() => entries.map((entry) => entry.row), [entries]);
    const [switchedTo, setSwitchedTo] = useState<string | null>(null);
    const [remembered, setRemembered] = useState<CompanionsOpeningMemory | null>(null);
    useEffect(() => setRemembered(rememberedCompanion()), []);

    const lastAtOf = useCallback(
        (row: CompanionTabRow) => entries.find((entry) => entry.row === row)?.time ?? row.lastActivityAt,
        [entries]
    );
    const current = useMemo(
        () => rows.find((row) => row.speciesProfileId === switchedTo) ?? pickCompanionToOpen(rows, lastAtOf, remembered),
        [rows, switchedTo, lastAtOf, remembered]
    );
    useEffect(() => {
        if (!current || switchedTo === current.speciesProfileId) return;
        setSwitchedTo(current.speciesProfileId);
        rememberCompanion(current.speciesProfileId);
    }, [current, switchedTo]);
    // The side menu's pick, when this chat is already on screen.
    useEffect(() => {
        const onSwitch = (event: Event) => {
            const id = (event as CustomEvent<string>).detail;
            if (typeof id === "string") setSwitchedTo(id);
        };
        window.addEventListener(COMPANIONS_SWITCH_EVENT, onSwitch);
        return () => window.removeEventListener(COMPANIONS_SWITCH_EVENT, onSwitch);
    }, []);

    const frame = useRef<HTMLDivElement | null>(null);
    const height = useFillToFoot(frame);
    const othersUnread = current ? rows.filter((row) => row.speciesProfileId !== current.speciesProfileId && row.unreadCount > 0).length : 0;
    const captureId = current ? chatCaptureIdFor(cards, current.speciesProfileId, current.captureId) : null;
    const avatarUrl = current?.slug ? getSpeciesImageRoute(current.slug) : null;
    // The shell's side menu (the owner, 2026-11-06): on a phone the slide-over; on a wide screen the sidebar is always there.
    const openSwitcher = useCallback(() => toggleMenu(), [toggleMenu]);

    // The "+" (the owner, 2026-11-06, after the Claude app): the phone's camera
    // app or the camera roll opens at once, from the tap on the item; the
    // picked file goes to the capture page's review (no scanner). A desktop
    // has no camera app, so its "Take a photo" is the scanner page.
    const router = useRouter();
    const [coarsePointer, setCoarsePointer] = useState(true);
    useEffect(() => {
        try {
            setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
        } catch {
            setCoarsePointer(true);
        }
    }, []);
    const onCaptureFile = useCallback((entry: CaptureEntry, file: File) => {
        setPendingCaptureFile(entry, file);
        router.push(`/app/capture?entry=${entry}`);
    }, [router]);

    // The subject as a value, never a row: the roster hands back new rows on every reload (a
    // message read, a thread changed), and a new subject object made the conversation read its
    // context and every owner fetch again, whose read reloaded the roster: a loop that ran for as
    // long as the chat was open (perf pass, 2026-11-06).
    const currentId = current?.speciesProfileId ?? null;
    const currentSlug = current?.slug ?? null;
    const currentAnimal = current?.animal ?? null;
    const currentTitle = current?.displayName ?? null;
    const subject = useMemo(
        () => (currentId ? askDeclaredSubject(pathname, {scope: "species", slug: currentSlug, name: currentAnimal, title: currentTitle, captureId}, null) : null),
        [currentId, pathname, currentSlug, currentAnimal, currentTitle, captureId]
    );

    const page = useMemo<AskConversationPage | null>(() => (currentId && subject
        ? {
            onMenu: openSwitcher,
            words: talk,
            onAskAnother: openSwitcher,
            initialQuestion: null,
            appHref: "/#download",
            subject: {
                subject,
                avatarUrl,
                companionSpeciesProfileId: currentId
            },
            switcher: {
                label: words.list.switcher,
                othersUnread,
                onOpen: openSwitcher,
                // The person's name, for the fixed greeting under the animal's face (the owner, 2026-11-06).
                personName: profileName ?? null,
                // The "+" by the composer: a new animal (the Claude app's "+").
                capture: {
                    label: words.list.captureAnAnimal,
                    items: [
                        takePhotoOpensCameraApp(coarsePointer)
                            ? {key: "camera", label: words.list.takePhoto, ...plusItemInput("camera")}
                            : {key: "camera", label: words.list.takePhoto, href: "/app/capture"},
                        {key: "library", label: words.list.uploadFromRoll, ...plusItemInput("library")}
                    ],
                    onFile: onCaptureFile
                }
            }
        }
        : null), [currentId, subject, openSwitcher, talk, avatarUrl, words.list.switcher, words.list.captureAnAnimal, words.list.takePhoto, words.list.uploadFromRoll, othersUnread, coarsePointer, onCaptureFile, profileName]);

    if (!current || !page) return null;
    return (
        <div
            ref={frame}
            style={{height}}
            className="-mx-4 -my-7 flex min-h-[420px] overflow-hidden sm:-mx-7 lg:-mx-10 lg:-my-10"
            data-testid="companions-chat"
        >
            <main className="flex min-w-0 flex-1 flex-col">
                <AskSubjectBridge
                    scope="species"
                    slug={current.slug}
                    name={current.animal}
                    title={current.displayName}
                    captureId={captureId}
                    avatarUrl={avatarUrl}
                    companionSpeciesProfileId={current.speciesProfileId}
                />
                <AskConversation key={current.speciesProfileId} labels={labels} presentation="page" page={page} />
            </main>
        </div>
    );
}
