"use client";

import {useEffect, useState} from "react";
import {AskSubjectBridge, useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

export default function SpeakToAnimalPreviewClient({slug, name, speciesProfileId, captureId, asOwner}: {
    slug: string;
    name: string;
    speciesProfileId: string;
    captureId: string;
    asOwner: boolean;
}) {
    const {open} = useAskAnimalDex();
    // Declared once mounted: the provider clears declarations as a page
    // first mounts, which would otherwise take this one back at once.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return (
        <div className="px-5 py-10 sm:px-8">
            {mounted ? <AskSubjectBridge
                scope="species"
                slug={slug}
                name={name}
                captureId={captureId}
                avatarUrl={getSpeciesImageRoute(slug)}
                companionSpeciesProfileId={asOwner ? speciesProfileId : null}
            /> : null}
            <h1 className="font-display text-3xl text-white">Speak to the animal preview</h1>
            <p className="mt-2 text-sm text-ink-300">Dev only. The drawer on a card, {asOwner ? "as its owner" : "as a visitor"}; mock the network to see the signed-in parts.</p>
            <button
                type="button"
                data-testid="open-chat"
                onClick={() => open()}
                className="mt-6 rounded-full bg-primary-400 px-5 py-2.5 text-sm font-bold text-canvas-950"
            >
                Open the chat
            </button>
        </div>
    );
}
