import {AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import CaptureClient from "@/app/[locale]/(authenticated)/app/capture/capture-client";

export default function CapturePage() {return <div className="space-y-8"><AppPageHeader eyebrow="AI animal scanner" title="Add capture" description="Live camera capture only. AnimalDex requires camera and location access, then runs the same authenticity and analysis checks as the iOS app."/><CaptureClient/></div>;}
