// PERF-WEB verifier NET-8: the real decoders for an in-browser timing (bundled by .audit-network-verify-net8-browser.mjs).
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {decodeArkFounders} from "@/lib/ark-founders";
import {arkSeenStates, arkSeenStatesToPin} from "@/ark-scene/seen/hooks";

(globalThis as unknown as {__net8: unknown}).__net8 = {decodeArkSnapshot, decodeArkFounders, arkSeenStates, arkSeenStatesToPin};
