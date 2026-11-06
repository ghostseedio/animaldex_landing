import CaptureClient from "@/app/[locale]/(authenticated)/app/capture/capture-client";
import {captureEntryFromParam} from "@/lib/capture-entry";
import {getCaptureWords} from "@/loaders/capture-words";

/**
 * The scanner, or (from the chat's "+", `?entry=camera|library`) the phone's
 * camera app or the camera roll at once, with the same review after. Like
 * iOS's camera cover it has no page header: the priming says what it is for.
 */
export default async function CapturePage({params, searchParams}: {params: {locale: string}; searchParams?: {entry?: string | string[]}}) {
    const entry = captureEntryFromParam(searchParams?.entry);
    const words = await getCaptureWords(params.locale);
    return <div className="space-y-8"><h1 className="sr-only">{words.scanner.primingTitle}</h1><CaptureClient entry={entry} words={words}/></div>;
}
