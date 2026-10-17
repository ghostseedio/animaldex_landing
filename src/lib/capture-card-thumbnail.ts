/**
 * The small rendition a public capture gets on a ~400px card.
 *
 * The capture image route redirects to the full-size original (140–175 KB per
 * photo), which the home page's four recent-capture cards then scale down in
 * the browser. `/api/capture-images/<id>/card` instead signs a storage *render*
 * URL at this size, so the card downloads roughly a fifth of the bytes.
 *
 * Signing stays in that route, on request, with the service key present. The
 * page render itself only rewrites the URL: a signing fetch inside an ISR
 * render would mark the page dynamic (a `cache: "no-store"` fetch sets the
 * route's revalidate to 0 in Next 13.5), and the production image is built
 * without the service key anyway, so build-time HTML could not carry a signed
 * URL at all.
 */
export const CAPTURE_CARD_THUMBNAIL_TRANSFORM = {width: 640, height: 480, quality: 76, resize: "cover"} as const;

const CAPTURE_IMAGE_ROUTE = /^\/api\/capture-images\/([^/?#]+)(\?[^#]*)?$/;

/**
 * `/api/capture-images/<id>?…` → `/api/capture-images/<id>/card?…`, with the
 * same bucket/path/mime/kind query, so the card route resolves exactly the
 * object the original route would. Anything else comes back unchanged.
 */
export function toCaptureCardThumbnailRoute(imageSrc: string) {
    const match = CAPTURE_IMAGE_ROUTE.exec(imageSrc);
    if (!match) return imageSrc;
    const [, captureId, query = ""] = match;
    return `/api/capture-images/${captureId}/card${query}`;
}
