"use client";

import {useEffect, useState} from "react";
import {initializePaddleJs, type PaddleRuntimeEnvironment} from "@/lib/paddle-checkout";

export function PaddlePaymentLinkBootstrap({
    environment,
    clientToken
}: {
    environment: PaddleRuntimeEnvironment | null;
    clientToken: string;
}) {
    const [message, setMessage] = useState("Preparing AnimalDex checkout…");

    useEffect(() => {
        if (!environment || !clientToken) {
            setMessage("Web checkout is not available yet.");
            return;
        }
        void initializePaddleJs({environment, clientToken}).then(
            () => setMessage("AnimalDex checkout is ready."),
            (error) => setMessage(error instanceof Error ? error.message : "Checkout could not start.")
        );
    }, [clientToken, environment]);

    return (
        <p className="mt-4 max-w-md text-sm leading-6 text-white/60" role="status" aria-live="polite">
            {message}
        </p>
    );
}
