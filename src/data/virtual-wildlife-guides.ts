import {createSupabaseServerClient} from "@/lib/supabase/server";

export type VirtualGuideMedia = {captureId: string; captureImageId: string; kind?: string};
export type VirtualGuideCard = {
    id: string; title: string; summary?: string; areaLabel: string; currencyCode: string;
    amountMinor: number; speciesCount: number; rareSpeciesCount: number; coverMedia?: VirtualGuideMedia[];
    status?: string; generationStatus?: string; publiclyVisible?: boolean;
};
export type VirtualGuideProfile = {
    cards: VirtualGuideCard[];
    autoPublish: boolean | null;
    noticeAcknowledged: boolean;
    publicEnabled: boolean;
    growing: {placeId: string; areaLabel: string; speciesCount: number; photoCount: number; speciesNeeded: number}[];
};

/** Auto-built place guides shown in the profile Shop. Owner details include drafts; public readers only get published guides. */
export async function getVirtualGuideProfile(userId: string, isOwner: boolean): Promise<VirtualGuideProfile> {
    const empty: VirtualGuideProfile = {cards: [], autoPublish: null, noticeAcknowledged: false, publicEnabled: false, growing: []};
    const supabase = createSupabaseServerClient();
    if (!supabase) return empty;
    if (isOwner) {
        const {data, error} = await supabase.rpc("get_my_wildlife_guides");
        if (error || !data) return empty;
        const payload = data as Record<string, unknown>;
        const settings = payload.settings as Record<string, unknown> | undefined;
        return {
            cards: Array.isArray(payload.guides) ? payload.guides as VirtualGuideCard[] : [],
            autoPublish: typeof settings?.autoPublish === "boolean" ? settings.autoPublish : true,
            noticeAcknowledged: Boolean(settings?.noticeAcknowledgedAt),
            publicEnabled: Boolean(payload.publicEnabled),
            growing: Array.isArray(payload.growing) ? payload.growing as VirtualGuideProfile["growing"] : []
        };
    }
    const {data, error} = await supabase.rpc("get_public_wildlife_guides", {p_user_id: userId, p_limit: 20});
    if (error || !Array.isArray(data)) return empty;
    return {...empty, cards: data as VirtualGuideCard[]};
}
