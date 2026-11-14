/**
 * Whether a server foray is a hunt as the card and the live log say it: the one rule between how the foray is drawn
 * (`hunting.ts` huntStyle) and how it is worded (`animal-status.ts` forayActivity). Every hunt style but the two
 * foragers' (`forage`: a boar, a goose, a tortoise nose down; `glean`: a robin, a sunbird flitting from spot to spot)
 * is a hunt; a forager's foray is said as its own feeding, unless its profile itself stalks (a cormorant is fishing).
 * Import-free, so the card's module does not pull the positions atlas's code in.
 */
export function forayIsHunt(style: string | null | undefined): boolean {
    return style != null && style !== "forage" && style !== "glean";
}
