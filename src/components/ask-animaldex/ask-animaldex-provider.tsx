"use client";

/**
 * Who the assistant is talking about, and whether it is open.
 *
 * One drawer serves every page, so the subject is context rather than a prop. It
 * starts as whatever the route implies and any page can refine it by rendering
 * `AskSubjectBridge` — which is how a comparison, an article or a capture tells
 * the assistant what it is looking at without each of them owning a copy of the
 * conversation.
 */

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {usePathname} from "next/navigation";
import {
    askSubjectFromPath,
    emptyAskSubject,
    type AskSubject
} from "@/lib/ask-animaldex/subject";

/** The page-declared half of a subject. The route supplies the rest. */
export type AskSubjectDeclaration = {
    scope?: "species" | "general";
    slug?: string | null;
    name?: string | null;
    captureId?: string | null;
    /** The reader's own photo of this animal, so the photo medium can be offered. */
    photoUrl?: string | null;
    title?: string | null;
    summary?: string | null;
};

type AskContextValue = {
    subject: AskSubject;
    /** The reader's own photo URL, for the photo medium. Never sent to the model. */
    photoUrl: string | null;
    locale: string;
    isOpen: boolean;
    open: (question?: string) => void;
    close: () => void;
    /** A question the launcher was opened with, consumed once by the drawer. */
    takePendingQuestion: () => string | null;
};

const AskContext = createContext<AskContextValue | null>(null);

export function AskAnimalDexProvider({locale, children}: {locale: string; children: React.ReactNode}) {
    const pathname = usePathname() ?? "/";
    const [declaration, setDeclaration] = useState<AskSubjectDeclaration | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const pendingQuestion = useRef<string | null>(null);

    // A page's declaration belongs to that page. Navigating away without the
    // next page declaring anything would otherwise leave the assistant claiming
    // to be about the animal the reader just left.
    useEffect(() => {
        setDeclaration(null);
    }, [pathname]);

    const subject = useMemo<AskSubject>(() => {
        const fromPath = askSubjectFromPath(pathname);
        if (!declaration) return fromPath;
        const slug = declaration.slug ?? fromPath.slug;
        return {
            ...fromPath,
            slug,
            scope: slug && (declaration.scope ?? fromPath.scope) === "species" ? "species" : "general",
            name: declaration.name ?? fromPath.name,
            captureId: declaration.captureId ?? fromPath.captureId,
            hasReaderPhoto: Boolean(declaration.photoUrl),
            title: declaration.title ?? fromPath.title,
            summary: declaration.summary ?? fromPath.summary
        };
    }, [pathname, declaration]);

    const open = useCallback((question?: string) => {
        if (question && question.trim()) pendingQuestion.current = question.trim();
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        pendingQuestion.current = null;
        setIsOpen(false);
    }, []);

    const takePendingQuestion = useCallback(() => {
        const question = pendingQuestion.current;
        pendingQuestion.current = null;
        return question;
    }, []);

    const value = useMemo<AskContextValue>(() => ({
        subject,
        photoUrl: declaration?.photoUrl ?? null,
        locale,
        isOpen,
        open,
        close,
        takePendingQuestion
    }), [subject, declaration?.photoUrl, locale, isOpen, open, close, takePendingQuestion]);

    return (
        <AskContext.Provider value={value}>
            <AskSubjectDeclarationContext.Provider value={setDeclaration}>
                {children}
            </AskSubjectDeclarationContext.Provider>
        </AskContext.Provider>
    );
}

const AskSubjectDeclarationContext = createContext<
    ((declaration: AskSubjectDeclaration | null) => void) | null
>(null);

/**
 * Falls back to a route-derived subject when no provider is mounted, so a
 * component using this hook cannot crash a page that forgot the provider.
 */
export function useAskAnimalDex(): AskContextValue {
    const value = useContext(AskContext);
    if (value) return value;
    return {
        subject: emptyAskSubject(),
        photoUrl: null,
        locale: "en",
        isOpen: false,
        open: () => undefined,
        close: () => undefined,
        takePendingQuestion: () => null
    };
}

/**
 * Rendered by a page to tell the assistant what that page is about.
 *
 * Renders nothing. A server page can drop it anywhere in its tree, which keeps
 * the subject next to the content it describes instead of duplicated in a route
 * table the drawer would have to maintain.
 */
export function AskSubjectBridge(declaration: AskSubjectDeclaration) {
    const setDeclaration = useContext(AskSubjectDeclarationContext);
    const serialized = JSON.stringify(declaration);

    useEffect(() => {
        if (!setDeclaration) return;
        setDeclaration(JSON.parse(serialized) as AskSubjectDeclaration);
        // Declarations are cleared on navigation by the provider, so unmounting
        // only needs to clear the case where a page swaps its own subject.
    }, [setDeclaration, serialized]);

    return null;
}
