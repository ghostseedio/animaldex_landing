import type { Platform } from "@/lib/product-analytics";

/** Platform identity colours: validated as a set on the admin's dark surface (dataviz validator, all pairs). */
export const platformColors: Record<Platform, string> = {
  ios: "#3987e5",
  android: "#199e70",
  web: "#d95926",
  unknown: "#5b6b61",
};
export const platformLabels: Record<Platform, string> = { ios: "iOS", android: "Android", web: "Web", unknown: "Unknown" };
export const storeColors = { app_store: platformColors.ios, google_play: platformColors.android, web: platformColors.web, unknown: platformColors.unknown };
export const storeLabels = { app_store: "App Store", google_play: "Google Play", web: "Web (Paddle/Stripe)", unknown: "Unknown store" };

/** Single-series marks wear the brand lime; colours that mean a platform are never reused for anything else. */
export const singleSeriesColor = "#59f176";
export const chartAxis = "#84958b";
export const chartGrid = "rgba(255,255,255,.07)";
export const chartBaseline = "rgba(255,255,255,.18)";

export function num(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en").format(Math.round(value * 10) / 10);
}

export function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

export function usd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

export function share(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export type Delta = { text: string; tone: "good" | "bad" | "neutral" } | null;

/** Change of a count, as a percentage of the previous period. */
export function countDelta(current: number | null | undefined, previous: number | null | undefined, higherIsBetter = true, format: (value: number) => string = num): Delta {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? { text: "no change", tone: "neutral" } : { text: `+${format(current)} from 0`, tone: higherIsBetter ? "good" : "bad" };
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  if (change === 0) return { text: "no change", tone: "neutral" };
  const good = change > 0 === higherIsBetter;
  return { text: `${change > 0 ? "+" : ""}${change}%`, tone: good ? "good" : "bad" };
}

/** Change of a rate, in percentage points: a rate's percentage change misleads. */
export function rateDelta(current: number | null | undefined, previous: number | null | undefined): Delta {
  if (current == null || previous == null) return null;
  const change = Math.round((current - previous) * 10) / 10;
  if (change === 0) return { text: "no change", tone: "neutral" };
  return { text: `${change > 0 ? "+" : ""}${change} pts`, tone: change > 0 ? "good" : "bad" };
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dayLabel(day: string, withYear = false) {
  const text = `${months[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
  return withYear ? `${text}, ${day.slice(0, 4)}` : text;
}

export function rangeLabel(from: string, to: string) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${dayLabel(from, !sameYear)} – ${dayLabel(to, true)}`;
}
