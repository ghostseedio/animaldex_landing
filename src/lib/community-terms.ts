/**
 * The Community Terms (iOS `TermsAgreementView`, `CommunityTerms`): asked the
 * first time a person sends a capture, which goes to Explore. As on iOS the
 * agreement is a flag on the device (`animaldex.acceptedCommunityTerms.v1`),
 * not a server row; the capture rules are the server-held agreement.
 */

export const COMMUNITY_TERMS_KEY = "animaldex.acceptedCommunityTerms.v1";

type TermsStorage = Pick<Storage, "getItem" | "setItem">;

export function hasAcceptedCommunityTerms(storage: TermsStorage | null): boolean {
    try {
        return storage?.getItem(COMMUNITY_TERMS_KEY) === "true";
    } catch {
        // No storage (a private window that refuses it): never block a
        // capture on a flag that cannot be kept; ask each time instead.
        return false;
    }
}

export function acceptCommunityTerms(storage: TermsStorage | null): void {
    try {
        storage?.setItem(COMMUNITY_TERMS_KEY, "true");
    } catch {
        // Agreed for this page either way.
    }
}
