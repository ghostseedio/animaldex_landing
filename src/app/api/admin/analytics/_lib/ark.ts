import "server-only";
import { fetchRows, isMissingTableError } from "@/app/api/admin/growth/_lib/rows";
import { addDays, dayStartMs } from "@/lib/product-analytics";
import {
  ARK_BASELINE_FROM,
  ARK_LAUNCH_DAY,
  summarizeArkMeasure,
  type ArkArrivalRow,
  type ArkMeasureSummary,
  type ArkSeenRow,
  type ArkTrialRow,
  type ArkWebEventRow,
} from "@/lib/ark-measure";

/**
 * The Ark tab of /admin/metrics: server counts first (steps, arrivals,
 * arrivals seen), the website's events for opens and time. Read with the
 * service role, never a step's words, an account's text or anything but ids,
 * timestamps, statuses and outcomes. Each source degrades on its own: a
 * table that is not there yet (life v2's voyage_events, ark_seen_events,
 * web_ark_events) leaves a note, never a failed page.
 */

export type ArkMeasurePanel = {
  from: string;
  to: string;
  launchDay: string;
  summary: ArkMeasureSummary;
  /** Where arrivals were counted from. */
  arrivalsFrom: "voyage_events" | "voyage_animals" | "none";
  seenRecorded: boolean;
  eventsRecorded: boolean;
  notes: string[];
};

async function optional<T>(table: string, query: string, notes: string[], note: string): Promise<T[] | null> {
  try {
    return await fetchRows<T>(table, query);
  } catch (error) {
    if (isMissingTableError(error, table)) {
      notes.push(note);
      return null;
    }
    throw error;
  }
}

/** Arrivals: the life log's 'arrival' events once life v2 is applied (they include its backfill), else voyage_animals (v1: every animal arrived). */
async function loadArrivals(notes: string[]): Promise<{ rows: ArkArrivalRow[]; from: ArkMeasurePanel["arrivalsFrom"] }> {
  const animals = await optional<{ id: string; owner_user_id: string | null; arrived_at: string }>(
    "voyage_animals",
    "select=id,owner_user_id,arrived_at&order=arrived_at.asc",
    notes,
    "No arrivals: voyage_animals is missing (AnimalDex migration 20261111100000, Ark v1).",
  );
  if (!animals) return { rows: [], from: "none" };
  const owners = new Map(animals.map((animal) => [animal.id, animal.owner_user_id]));
  const events = await optional<{ animal_id: string | null; at: string }>(
    "voyage_events",
    "select=animal_id,at&kind=eq.arrival&order=at.asc",
    notes,
    "Arrivals are counted from voyage_animals.arrived_at until Ark life v2 (voyage_events) is applied.",
  );
  if (events) {
    return {
      rows: events.filter((event) => event.animal_id).map((event) => ({ animal_id: event.animal_id!, owner_user_id: owners.get(event.animal_id!) ?? null, arrived_at: event.at })),
      from: "voyage_events",
    };
  }
  return { rows: animals.map((animal) => ({ animal_id: animal.id, owner_user_id: animal.owner_user_id, arrived_at: animal.arrived_at })), from: "voyage_animals" };
}

export async function loadArkMeasure(range: { from: string; to: string; includeTesters: boolean }): Promise<ArkMeasurePanel> {
  const notes: string[] = [];
  // The weeks before the launch are always in view: they are the baseline.
  const from = range.from < ARK_BASELINE_FROM ? range.from : ARK_BASELINE_FROM;
  const to = range.to;
  const end = encodeURIComponent(new Date(dayStartMs(addDays(to, 1))).toISOString());
  const start = encodeURIComponent(new Date(dayStartMs(from)).toISOString());

  const [trials, testers, arrivals, seen, events] = await Promise.all([
    // Only ids, times, status and outcome: never the step, the account of it or its evidence.
    fetchRows<ArkTrialRow>("animal_companion_trials", `select=user_id,set_at,done_at,status,outcome&set_at=lt.${end}&order=set_at.asc`),
    fetchRows<{ id: string }>("profiles", "select=id&is_dev_tester=eq.true"),
    loadArrivals(notes),
    optional<ArkSeenRow>(
      "ark_seen_events",
      "select=user_id,animal_id,seen_at,surface&order=seen_at.asc",
      notes,
      "\"Arrival seen\" is recorded once AnimalDex migration 20261111150000 (ark_seen_events) is applied.",
    ),
    optional<ArkWebEventRow>(
      "web_ark_events",
      `select=event,source,seconds,created_at&created_at=gte.${start}&created_at=lt.${end}&order=created_at.asc`,
      notes,
      "Ark opens, time and taps are recorded once landing migration 20261110130000 (web_ark_events) is applied. The apps send theirs to Firebase only.",
    ),
  ]);
  if (events) notes.push("Opens, time and taps are the website's only (web_ark_events); the apps report theirs to Firebase. They carry no account, so dev testers cannot be left out of them.");

  const summary = summarizeArkMeasure({
    from,
    to,
    trials,
    arrivals: arrivals.rows,
    seen,
    events,
    testers: new Set(testers.map((row) => row.id)),
    includeTesters: range.includeTesters,
  });
  return { from, to, launchDay: ARK_LAUNCH_DAY, summary, arrivalsFrom: arrivals.from, seenRecorded: seen !== null, eventsRecorded: events !== null, notes };
}
