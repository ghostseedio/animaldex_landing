import {NextRequest, NextResponse} from "next/server";
import {SPECIES_NO_IMAGE_SRC} from "@/data/species-images";
import {getDiscoverAnimalTrialEvidenceReference} from "@/data/discover-timeline";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";

/**
 * The still behind an Animal Trial Discover post.
 *
 * Evidence lives in the private `journal-proofs` bucket next to Daily
 * Companion proofs and written answers. The only thing this route will sign
 * is a path the public post view publishes for this post id — which is the
 * same test the phone's storage policy (`journal_proof_is_shared_animal_trial`)
 * applies — so a Trial that is private, unfinished, or someone's written
 * account is never reachable by guessing a path.
 */
function redirectWithBrowserCache(url: URL | string) {
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=1800");
    return response;
}

export async function GET(request: NextRequest, {params}: {params: {postId: string}}) {
    const fallback = new URL(SPECIES_NO_IMAGE_SRC, request.url);
    try {
        const reference = await getDiscoverAnimalTrialEvidenceReference(params.postId ?? "");
        if (!reference) return redirectWithBrowserCache(fallback);

        const signedUrl = await createSignedStorageUrl(reference.bucket, reference.path);
        return redirectWithBrowserCache(signedUrl ?? fallback);
    } catch {
        return redirectWithBrowserCache(fallback);
    }
}

export const dynamic = "force-dynamic";
