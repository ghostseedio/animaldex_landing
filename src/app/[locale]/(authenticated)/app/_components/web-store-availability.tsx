"use client";

import {createContext, useContext, type ReactNode} from "react";
import type {WebStoreProductCode} from "@/lib/web-store-catalog";

export type WebStoreAvailability = Record<WebStoreProductCode, boolean>;

/** Nothing is on sale until the server says so: the checkout route checks again either way. */
const NOTHING_ON_SALE: WebStoreAvailability = {purchase_25: false, purchase_100: false, pro_upgrade: false};

const WebStoreAvailabilityContext = createContext<WebStoreAvailability>(NOTHING_ON_SALE);

/**
 * Which Credits and Pro products the website can sell, worked out on the
 * server from the Paddle configuration (`paddleProductAvailability`). A
 * product whose Price ID is missing shows as unavailable; the others stay
 * on sale.
 */
export function WebStoreAvailabilityProvider({availability, children}: {availability: WebStoreAvailability; children: ReactNode}) {
    return <WebStoreAvailabilityContext.Provider value={availability}>{children}</WebStoreAvailabilityContext.Provider>;
}

export function useWebStoreAvailability() {
    return useContext(WebStoreAvailabilityContext);
}
