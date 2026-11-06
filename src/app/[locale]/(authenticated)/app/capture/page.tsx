import {AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import CaptureClient from "@/app/[locale]/(authenticated)/app/capture/capture-client";
import {captureEntryFromParam} from "@/lib/capture-entry";

/**
 * The scanner, or (from the chat's "+", `?entry=camera|library`) the phone's
 * camera app or the camera roll at once, with the same review after.
 */
export default function CapturePage({searchParams}: {searchParams?: {entry?: string | string[]}}) {
    const entry = captureEntryFromParam(searchParams?.entry);
    const description = entry === "library"
        ? "A photo from your camera roll. AnimalDex checks it is one you took, asks where it was, then runs the same analysis as the apps."
        : entry === "camera"
            ? "A photo from your camera. AnimalDex runs the same authenticity and analysis checks as the apps."
            : "Live camera capture only. AnimalDex requires camera and location access, then runs the same authenticity and analysis checks as the iOS app.";
    return <div className="space-y-8"><AppPageHeader eyebrow="AI animal scanner" title="Add capture" description={description}/><CaptureClient entry={entry}/></div>;
}
