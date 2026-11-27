"use client";

import {createContext, useContext, type ReactNode} from "react";
import {SETTINGS_WORDS_EN, type SettingsWords} from "@/lib/settings-words";

const SettingsWordsContext = createContext<SettingsWords>(SETTINGS_WORDS_EN);

/** The Settings screens' words (settings/layout.tsx reads them on the server), for the client rows. */
export function SettingsWordsProvider({words, children}: {words: SettingsWords; children: ReactNode}) {
    return <SettingsWordsContext.Provider value={words}>{children}</SettingsWordsContext.Provider>;
}

export function useSettingsWords(): SettingsWords {
    return useContext(SettingsWordsContext);
}
