/* Ported from the apps' supabase/functions/_shared/animal-small-talk.ts (the small-talk shortcut, 2026-11-07): keep the two in step. */
/// Small talk the words alone can route (the owner's "small-talk shortcut",
/// 2026-11-07).
///
/// Every typed turn waits for its kind's verdict before the reply starts,
/// because the verdict also says what the turn is (animal-kind-verdict.ts):
/// about 1.2 to 2 s. A hello, a thanks or a laugh has no side to take and
/// always goes to the small-talk model, so it need not wait: when the whole
/// message is one of a few small-talk phrases, the turn is chat by its words.
///
/// Conservative on purpose. The whole message must be the phrase, with the
/// animal's own name allowed beside it:
/// - three words or fewer;
/// - no question mark;
/// - nothing the problem, decision or idea words catch (animal-turn-kind.ts);
/// - an "ok" never when the animal's last message asked something (it may be
///   a yes).
/// Anything else waits for the verdict as before. This only routes the turn:
/// the reply is still the model's own (no hardcoded replies), and a crisis is
/// still read by its own check.

import { heuristicTurnKind } from "./turn-kind";

/// Whole small-talk messages: hellos, thanks, laughs and reactions, goodbyes.
/// One short word may follow ("hi there", "thanks again").
const SMALL_TALK = new RegExp(
  "^(?:" + [
    // Hellos.
    "hi+", "hey+", "hello+", "hiya", "heya", "yo+", "howdy", "gm",
    "good (?:morning|afternoon|evening)", "morning", "evening",
    "hola", "bonjour", "salut", "hallo", "ciao", "halo", "hai",
    // Thanks.
    "thanks+", "thank you", "thx", "ty", "tysm", "cheers", "many thanks",
    // Laughs and reactions.
    "lo+l", "lmao+", "(?:ha){2,}h?", "(?:he){2,}h?", "nice", "cool", "wow", "aw+", "omg",
    // Goodbyes.
    "bye+", "bye bye", "goodbye", "good night", "night", "nite", "gn", "cya", "see ya", "see you",
    "later", "ttyl", "gtg", "g2g", "brb",
  ].join("|") + ")(?: (?:there|again|friend|buddy|too))?$",
);

/// Acknowledgements: small talk unless the animal's last message asked
/// something, when "ok" may be a yes to it.
const ACKNOWLEDGEMENT = /^(?:ok(?:ay)?|k+|okie|alright|got it|sounds good|fair enough)$/;

/// Words in a name that are not the name ("Luna the Red Fox").
const NAME_FILLER = new Set(["the", "a", "an", "of", "and", "my"]);

const MAX_WORDS = 3;
const MAX_CHARACTERS = 60;

/// Lower case, curly apostrophes straightened, and nothing but letters,
/// digits, apostrophes and single spaces (emoji and punctuation dropped).
function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/// The animal's last message ended on a question.
export function animalAskedLast(lastAnimalMessage: string | null | undefined): boolean {
  // Trailing emoji, quotes, brackets and markdown are not the sentence's end.
  return (lastAnimalMessage ?? "").replace(/[^\p{L}\p{N}?.!]+$/u, "").endsWith("?");
}

/// Small talk known from the request alone, before the animal's names are
/// read: its kind's verdict is then never started (it was started and never
/// read, one Haiku call per hello). Without the names it only ever finds less
/// than smallTalkByWords with them: "hi" here, "hi Luna" only with the names
/// (its verdict still starts, as before).
export function smallTalkBeforeLoads(input: {
  message: string;
  history: Array<{ role: string; content: string }>;
}): boolean {
  return smallTalkByWords({
    message: input.message,
    lastAnimalMessage: input.history.filter((turn) => turn.role === "assistant").at(-1)?.content ?? null,
  });
}

/// The turn is small talk by its words alone: it may go to the small-talk
/// model without waiting for its kind's verdict.
export function smallTalkByWords(input: {
  message: string;
  /// The animal's names in this chat (its nickname, its kind): allowed beside the phrase.
  names?: Array<string | null | undefined>;
  /// The animal's last message in the conversation, if any.
  lastAnimalMessage?: string | null;
}): boolean {
  const raw = input.message.trim();
  if (!raw || raw.length > MAX_CHARACTERS || raw.includes("?")) return false;
  const text = normalized(raw);
  const tokens = text ? text.split(" ") : [];
  if (tokens.length === 0 || tokens.length > MAX_WORDS) return false;
  // A problem, a decision or an idea, however short, waits for the verdict.
  const kind = heuristicTurnKind(raw);
  if (kind === "problem" || kind === "decision" || kind === "idea") return false;
  const names = new Set(
    (input.names ?? [])
      .flatMap((name) => normalized(name ?? "").split(" "))
      .filter((word) => word.length >= 2 && !NAME_FILLER.has(word)),
  );
  const phrase = tokens.filter((word) => !names.has(word)).join(" ");
  if (!phrase) return false;
  if (ACKNOWLEDGEMENT.test(phrase)) return !animalAskedLast(input.lastAnimalMessage);
  return SMALL_TALK.test(phrase);
}
