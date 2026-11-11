/**
 * The runtime bridge's messages and the browser's own power sources
 * (docs/ark/runtime-bridge.md). The apps post `ark:visible` and `ark:power`
 * into the WebView; the web reads the page's visibility, the Battery API and
 * the Compute Pressure API where the browser has them. The governor
 * (`governor.ts`) merges them; the host's word wins.
 */

import {LOW_BATTERY, type ArkPower, type ArkThermal, type RenderGovernor} from "@/ark-scene/runtime/governor";

const THERMALS: readonly ArkThermal[] = ["nominal", "fair", "serious", "critical"];

/** `{type: "ark:visible", visible}` (or `value`): the panel shown (true) or covered / the app in the background (false). Null when malformed. */
export function parseVisibleMessage(message: unknown): boolean | null {
    if (!message || typeof message !== "object") return null;
    const row = message as Record<string, unknown>;
    if (row.type !== "ark:visible") return null;
    const value = "visible" in row ? row.visible : row.value;
    return typeof value === "boolean" ? value : null;
}

/**
 * `{type: "ark:power", saver?, thermal?, battery?, charging?}` (or the same fields under `power`; `power: null` hands
 * back to the browser's sources). Unknown or malformed fields are dropped, never guessed. Returns undefined when the
 * message is not an `ark:power`.
 */
export function parsePowerMessage(message: unknown): Partial<ArkPower> | null | undefined {
    if (!message || typeof message !== "object") return undefined;
    const row = message as Record<string, unknown>;
    if (row.type !== "ark:power") return undefined;
    if ("power" in row && row.power === null) return null;
    const source = row.power && typeof row.power === "object" ? row.power as Record<string, unknown> : row;
    const power: Partial<ArkPower> = {};
    if (typeof source.saver === "boolean") power.saver = source.saver;
    if (typeof source.thermal === "string" && (THERMALS as readonly string[]).includes(source.thermal)) power.thermal = source.thermal as ArkThermal;
    const battery = typeof source.battery === "number" ? source.battery : null;
    if (battery !== null && Number.isFinite(battery)) power.battery = Math.min(Math.max(battery > 1 ? battery / 100 : battery, 0), 1);
    if (typeof source.charging === "boolean") power.charging = source.charging;
    return power;
}

/** The Compute Pressure API's states, as heat. */
export function pressureThermal(state: string): ArkThermal {
    return state === "critical" ? "critical" : state === "serious" ? "serious" : state === "fair" ? "fair" : "nominal";
}

type BatteryManager = EventTarget & {level: number; charging: boolean};
type PressureRecord = {source: string; state: string};
type PressureObserverLike = {observe: (source: string, options?: {sampleInterval?: number}) => Promise<void>; disconnect: () => void};

/**
 * The page's visibility, the battery and the CPU's pressure, into the governor. Every source is optional; none of them
 * throws when it is missing (Safari has neither the Battery nor the Compute Pressure API).
 */
export function watchBrowserPower(governor: RenderGovernor): () => void {
    const stops: Array<() => void> = [];
    if (typeof document !== "undefined") {
        const onVisibility = () => governor.setDocumentHidden(document.visibilityState === "hidden");
        onVisibility();
        document.addEventListener("visibilitychange", onVisibility);
        // Back from the back-forward cache: the page is shown again without a visibilitychange on some browsers.
        const onShow = () => governor.setDocumentHidden(false);
        const onHide = () => governor.setDocumentHidden(true);
        window.addEventListener("pageshow", onShow);
        window.addEventListener("pagehide", onHide);
        stops.push(() => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pageshow", onShow);
            window.removeEventListener("pagehide", onHide);
        });
    }
    if (typeof navigator !== "undefined") {
        const getBattery = (navigator as Navigator & {getBattery?: () => Promise<BatteryManager>}).getBattery;
        if (typeof getBattery === "function") {
            let battery: BatteryManager | null = null;
            let stopped = false;
            const read = () => {
                if (battery) governor.setBrowserPower({battery: battery.level, charging: battery.charging});
            };
            getBattery.call(navigator).then((manager) => {
                if (stopped) return;
                battery = manager;
                read();
                manager.addEventListener("levelchange", read);
                manager.addEventListener("chargingchange", read);
            }).catch(() => undefined);
            stops.push(() => {
                stopped = true;
                battery?.removeEventListener("levelchange", read);
                battery?.removeEventListener("chargingchange", read);
            });
        }
    }
    const Pressure = (globalThis as {PressureObserver?: new (callback: (records: PressureRecord[]) => void) => PressureObserverLike}).PressureObserver;
    if (typeof Pressure === "function") {
        try {
            const observer = new Pressure((records) => {
                const last = records[records.length - 1];
                if (last) governor.setBrowserPower({thermal: pressureThermal(last.state)});
            });
            observer.observe("cpu", {sampleInterval: 2000}).catch(() => undefined);
            stops.push(() => observer.disconnect());
        } catch {
            // Not allowed here (a permissions policy, an insecure context): no heat reading.
        }
    }
    return () => stops.forEach((stop) => stop());
}

/** Whether a battery reading alone counts as saver (for the bridge doc and the tests). */
export function lowBattery(power: Partial<ArkPower>): boolean {
    return typeof power.battery === "number" && power.battery <= LOW_BATTERY && power.charging === false;
}
