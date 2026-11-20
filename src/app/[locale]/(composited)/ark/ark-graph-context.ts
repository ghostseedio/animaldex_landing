import {createContext} from "react";
import type {ArkGraphWords} from "@/lib/ark-graph-words";

/**
 * The reader's graph words (`ark.graph`), handed down from the population HUD to the graph pieces it loads lazily
 * (`ark-population-graph.tsx`). Its own tiny module so the HUD can hold the provider without the English that the
 * graphs fall back to: the Ark page's first JavaScript is frozen (decision 371). No provider (a test, an older bundle):
 * the graphs read English.
 */
export const ArkGraphWordsContext = createContext<ArkGraphWords | undefined>(undefined);
