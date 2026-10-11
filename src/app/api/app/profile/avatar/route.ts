import {NextResponse} from "next/server";
import sharp from "sharp";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * iOS `AvatarUploadService`: a JPEG of at most 1024px (quality 74) at
 * `avatars/<uid>/avatar.jpg`, plus 144/288/512 copies under `derived/`. The
 * URL carries `?v=<unix>` so caches pick up the new photo. Returns the URL;
 * the profile only points at it once Edit Profile is saved.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const form = await request.formData().catch(() => null);
    const file = form?.get("avatar");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({error: "Could not load that photo."}, {status: 400});
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({error: "That photo is too large."}, {status: 413});

    const input = Buffer.from(await file.arrayBuffer());
    let main: Buffer;
    try {
        main = await sharp(input).rotate().resize(1024, 1024, {fit: "inside", withoutEnlargement: true}).jpeg({quality: 74}).toBuffer();
    } catch {
        return NextResponse.json({error: "Could not load that photo."}, {status: 400});
    }

    // The path is fixed to the caller's own folder, so the service key cannot be steered elsewhere.
    const storage = (createSupabaseServiceClient() ?? supabase).storage.from("avatars");
    const folder = user.id.toLowerCase();
    const upload = await storage.upload(`${folder}/avatar.jpg`, main, {contentType: "image/jpeg", upsert: true, cacheControl: "3600"});
    if (upload.error) return NextResponse.json({error: "Could not prepare the avatar image."}, {status: 400});

    await Promise.all([144, 288, 512].map(async (size) => {
        const derived = await sharp(main).resize(size, size, {fit: "cover"}).jpeg({quality: 80}).toBuffer();
        await storage.upload(`${folder}/derived/avatar_${size}.jpg`, derived, {contentType: "image/jpeg", upsert: true, cacheControl: "31536000"});
    })).catch(() => undefined);

    const {data} = storage.getPublicUrl(`${folder}/avatar.jpg`);
    return NextResponse.json({avatarUrl: `${data.publicUrl}?v=${Math.floor(Date.now() / 1000)}`});
}
