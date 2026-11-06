import type {Metadata} from "next";
import {notFound} from "next/navigation";
import CaptureClient, {type CaptureGalleryFixture} from "@/app/[locale]/(authenticated)/app/capture/capture-client";
import {captureEntryFromParam} from "@/lib/capture-entry";

/**
 * DEV ONLY: the chat's "+" entries on the capture page, drawn from a fixture
 * with no network, so each state can be looked at without a session or a
 * camera. 404s in production.
 *
 *   /dev/capture/plus?entry=library&state=review     a roll photo at its review, the file's pin to confirm
 *   /dev/capture/plus?entry=library&state=idle       the offer of the roll (nothing picked yet)
 *   /dev/capture/plus?entry=library&state=rejected   a pick turned away (a screenshot)
 *   /dev/capture/plus?entry=library&state=credits    the review short of credits
 *   /dev/capture/plus?entry=camera&state=review      a camera-app still at its review
 *   /dev/capture/plus?entry=camera&state=idle        the offer of the camera
 */

export const metadata: Metadata = {title: "Capture plus gallery", robots: {index: false, follow: false}};

const STATES = new Set<CaptureGalleryFixture["state"]>(["idle", "review", "rejected", "credits"]);

export default function CapturePlusGalleryPage({searchParams}: {searchParams?: {entry?: string; state?: string; image?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const entry = captureEntryFromParam(searchParams?.entry) ?? "library";
    const state = STATES.has(searchParams?.state as CaptureGalleryFixture["state"]) ? searchParams!.state as CaptureGalleryFixture["state"] : "review";
    const imageUrl = searchParams?.image?.startsWith("/") ? searchParams.image : "/images/features/en/camera.png";
    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            <p className="mb-4 text-xs uppercase tracking-wide text-white/40">Dev gallery · {entry} · {state}</p>
            <CaptureClient entry={entry} gallery={{entry, imageUrl, state}} />
        </div>
    );
}
