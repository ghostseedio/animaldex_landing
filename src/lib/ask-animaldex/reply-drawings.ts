/* Ported from the apps' supabase/functions/_shared/reply-drawings.ts (the drawing flag, 2026-11-07): keep the two in step. */
/**
 * What a finished reply drew, by its fence markers only (the owner,
 * 2026-11-07: "Add a flag", instead of reading replies to count drawings).
 *
 * A reply's drawings are its fenced blocks: a text diagram (```text, ``` or
 * any other language: the clients' diagram panel) or an `animaldex-*` block
 * (flow, scale, chart, photo, card, loop, image…). This counts the fences by
 * kind, read from the opening marker's language alone, the way the clients
 * open them (a line starting with ```, toggling). Nothing of the reply's
 * words is read or kept: the result is a few kind names and counts, written
 * to the turn's `animal_chat_timing` line as `notes.drew`.
 *
 * `{}` says the reply drew nothing (a line without `drew` is an older build).
 *
 * The web's copy (`src/lib/ask-animaldex/reply-drawings.ts`) is this file
 * word for word, so the app's and the web's timing lines read alike.
 */

export type ReplyDrawings = Record<string, number>;

/** A kind name is a short marker word; anything else is counted as "other". */
const KIND = /^[a-z0-9_]{1,24}$/;

/** The kind a fence's opening line names. */
export function drawingKind(openingLine: string): string {
  const language = openingLine.trim().slice(3).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!language.startsWith("animaldex-")) return "text";
  const kind = language.slice("animaldex-".length).replace(/-/g, "_");
  return KIND.test(kind) ? kind : "other";
}

/** The reply's drawings, counted by kind: `{"text":1,"loop":1}`, or `{}`. */
export function replyDrawings(answer: string): ReplyDrawings {
  const drew: ReplyDrawings = {};
  let open = false;
  for (const line of answer.split("\n")) {
    if (!line.trimStart().startsWith("```")) continue;
    if (open) {
      open = false;
      continue;
    }
    open = true;
    const kind = drawingKind(line);
    drew[kind] = (drew[kind] ?? 0) + 1;
  }
  return drew;
}
