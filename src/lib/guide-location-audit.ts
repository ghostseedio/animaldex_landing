import {
    titleStructuredLocationLooksInconsistent,
    isGuideListingIndexable
} from "./guide-listing-quality";
import {
    guideAreaServedName,
    guideNormalizedLocality,
    type PublicGuideListing
} from "./guide-marketplace-core";

export type PublishedGuideLocationAudit = {
    id: string;
    title: string;
    publicArea: string;
    normalizedLocation: string;
    country: string;
    possibleMismatch: boolean;
    indexable: boolean;
};

export function auditPublishedGuideLocations(listings: PublicGuideListing[]): PublishedGuideLocationAudit[] {
    return listings.map((listing) => {
        const publicArea = listing.public_area_label.replace(/\s+/g, " ").trim();
        return {
            id: listing.id,
            title: listing.title.replace(/\s+/g, " ").trim(),
            publicArea,
            normalizedLocation: guideNormalizedLocality(listing) || guideAreaServedName(listing),
            country: listing.country_code,
            possibleMismatch: titleStructuredLocationLooksInconsistent(listing.title, {
                publicAreaLabel: listing.public_area_label,
                publicLocality: listing.public_locality,
                publicAdminArea: listing.public_admin_area,
                publicPlaceName: listing.public_place_name
            }),
            indexable: isGuideListingIndexable(listing)
        };
    });
}
