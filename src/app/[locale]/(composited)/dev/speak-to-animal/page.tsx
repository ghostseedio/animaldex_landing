import type {Metadata} from "next";
import {notFound} from "next/navigation";
import SpeakToAnimalPreviewClient from "./preview-client";

/**
 * DEV ONLY: the drawer as the owner of a card sees it, without a signed-in
 * session, so the owner's parts of Speak to [Animal] (the bond, check-ins, the
 * animal's own messages, the Pro introduction) can be looked at with the
 * network mocked. 404s in production.
 *
 *   /dev/speak-to-animal                       the Gray Wolf, as its owner
 *   /dev/speak-to-animal?slug=red-fox&name=Red%20Fox&species=<id>
 *   /dev/speak-to-animal?visit=1               the same card, as a visitor
 */

export const metadata: Metadata = {title: "Speak to the animal preview", robots: {index: false, follow: false}};

export default function SpeakToAnimalPreviewPage({searchParams}: {searchParams: {slug?: string; name?: string; species?: string; capture?: string; visit?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    return (
        <SpeakToAnimalPreviewClient
            slug={searchParams.slug ?? "gray-wolf"}
            name={searchParams.name ?? "Gray Wolf"}
            speciesProfileId={searchParams.species ?? "59f1a1a9-cf08-4418-9baf-b20ddd00ceb3"}
            captureId={searchParams.capture ?? "00000000-0000-4000-8000-0000000000c1"}
            asOwner={searchParams.visit !== "1"}
        />
    );
}
