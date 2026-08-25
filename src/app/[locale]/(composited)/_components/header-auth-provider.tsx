"use client";

import {createContext, ReactNode, useContext, useEffect, useMemo, useState} from "react";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";

export type HeaderAuthSession = {
    user: {id: string; email: string | null} | null;
    username: string | null;
    displayName: string | null;
};

type HeaderAuthContextValue = {
    session: HeaderAuthSession;
};

const anonymousSession: HeaderAuthSession = {
    user: null,
    username: null,
    displayName: null
};

const HeaderAuthContext = createContext<HeaderAuthContextValue>({
    session: anonymousSession
});

export function HeaderAuthProvider({children}: {children: ReactNode}) {
    const [session, setSession] = useState<HeaderAuthSession>(anonymousSession);

    useEffect(() => {
        if (!requestHasSupabaseAuthCookie(document.cookie)) {
            return;
        }

        let isMounted = true;

        async function loadSession() {
            try {
                const response = await fetch("/api/auth/session", {cache: "no-store"});
                const payload = await response.json() as HeaderAuthSession;
                if (isMounted) setSession(payload);
            } catch {
                if (isMounted) setSession(anonymousSession);
            }
        }

        void loadSession();

        return () => {
            isMounted = false;
        };
    }, []);

    const value = useMemo(() => ({session}), [session]);

    return (
        <HeaderAuthContext.Provider value={value}>
            {children}
        </HeaderAuthContext.Provider>
    );
}

export function useHeaderAuth() {
    return useContext(HeaderAuthContext);
}
