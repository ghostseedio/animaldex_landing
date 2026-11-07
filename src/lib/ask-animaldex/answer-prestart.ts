/* Ported from the apps' supabase/functions/_shared/answer-prestart.ts (the small-talk shortcut, 2026-11-07): keep the two in step. */
/// A reply's model started before the turn may show it (the small-talk
/// shortcut, 2026-11-07).
///
/// Nothing reaches the person before a turn's crisis check says no (about
/// 1 s, its own model call). A small-talk turn needs no verdict, so its reply
/// can start beside that check: the model's first byte arrives while the
/// check runs, instead of after it. The source starts now. What it says before
/// the turn reads it is kept, and handed over first when the turn does. If the
/// check says crisis, the caller aborts the request and nothing of it is ever
/// read.

export type AnswerDeltaSource = (emit: (delta: string) => void) => Promise<void>;

export function prestartAnswerSource(source: AnswerDeltaSource, onStart?: () => void): AnswerDeltaSource {
  const early: string[] = [];
  let sink: ((delta: string) => void) | null = null;
  onStart?.();
  const running = source((delta) => {
    if (sink) sink(delta);
    else early.push(delta);
  });
  // Read (and thrown) by whoever takes the reply; never unhandled before then.
  running.catch(() => undefined);
  return async (emit) => {
    for (const delta of early.splice(0)) emit(delta);
    sink = emit;
    await running;
  };
}
