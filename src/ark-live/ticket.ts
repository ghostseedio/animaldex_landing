/**
 * The control ticket (design §2.5; docs/ark/player-control-contract.md §2).
 *
 * `v1.<user>.<animal>.<island>.<exp>.<nonce>.<sig>`, where sig is base64url (no padding) of HMAC-SHA256 over everything
 * before the last dot, keyed with the decoded bytes of a base64 secret. The database mints it
 * (`voyage_control_ticket_v1`); `ark-live` verifies it here, with WebCrypto (the same in Node, a Worker and a browser).
 */

import {isIslandId, type IslandId} from "@/ark-live/islands";

export type Ticket = {user: string; animal: string; island: IslandId; exp: number; nonce: string};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64ToBytes(text: string): Uint8Array {
    const clean = text.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const out: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const ch of clean) {
        const v = B64.indexOf(ch);
        if (v < 0) throw new Error("bad base64");
        buffer = (buffer << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((buffer >> bits) & 0xff);
        }
    }
    return new Uint8Array(out);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const n = (a << 16) | (b << 8) | c;
        out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
        if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
        if (i + 2 < bytes.length) out += B64[n & 63];
    }
    return out.replace(/\+/g, "-").replace(/\//g, "_");
}

function subtle(): SubtleCrypto {
    const s = (globalThis as {crypto?: Crypto}).crypto?.subtle;
    if (!s) throw new Error("WebCrypto is not available");
    return s;
}

async function hmacKey(keyBase64: string): Promise<CryptoKey> {
    return subtle().importKey("raw", base64ToBytes(keyBase64), {name: "HMAC", hash: "SHA-256"}, false, ["sign", "verify"]);
}

export function ticketPayload(t: Ticket): string {
    return `v1.${t.user}.${t.animal}.${t.island}.${t.exp}.${t.nonce}`;
}

export async function signTicket(t: Ticket, keyBase64: string): Promise<string> {
    const payload = ticketPayload(t);
    const sig = await subtle().sign("HMAC", await hmacKey(keyBase64), new TextEncoder().encode(payload));
    return `${payload}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

export type TicketCheck = {ok: true; ticket: Ticket} | {ok: false; reason: "bad_ticket" | "expired"};

/** Parse and verify a ticket against the key and the clock (unix seconds). Never trusts a field before the signature. */
export async function verifyTicket(text: string, keyBase64: string, nowSeconds: number): Promise<TicketCheck> {
    if (typeof text !== "string" || text.length > 400) return {ok: false, reason: "bad_ticket"};
    const parts = text.split(".");
    if (parts.length !== 7 || parts[0] !== "v1") return {ok: false, reason: "bad_ticket"};
    const [, user, animal, island, expText, nonce, sig] = parts;
    if (!UUID.test(user) || !UUID.test(animal) || !UUID.test(nonce) || !isIslandId(island) || !/^\d{1,12}$/.test(expText)) return {ok: false, reason: "bad_ticket"};
    let sigBytes: Uint8Array;
    try {
        sigBytes = base64ToBytes(sig);
    } catch {
        return {ok: false, reason: "bad_ticket"};
    }
    if (sigBytes.length !== 32) return {ok: false, reason: "bad_ticket"};
    const payload = text.slice(0, text.lastIndexOf("."));
    const good = await subtle().verify("HMAC", await hmacKey(keyBase64), sigBytes, new TextEncoder().encode(payload));
    if (!good) return {ok: false, reason: "bad_ticket"};
    const exp = Number(expText);
    if (exp < nowSeconds) return {ok: false, reason: "expired"};
    return {ok: true, ticket: {user, animal, island, exp, nonce}};
}
