import {NextResponse} from "next/server";
import {normalizeUsername, usernameFormatProblem} from "@/lib/profile-editor";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/** iOS `isUsernameAvailable`: free, or already this user's. */
export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const username = normalizeUsername(new URL(request.url).searchParams.get("u") ?? "");
    const problem = usernameFormatProblem(username);
    if (problem?.kind === "invalid") return NextResponse.json({state: "invalid", message: problem.message});
    if (problem?.kind === "taken") return NextResponse.json({state: "taken"});

    const {data, error} = await supabase.from("profiles").select("id").ilike("username", username).limit(2);
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    const available = (data ?? []).every((row) => row.id === user.id);
    return NextResponse.json({state: available ? "available" : "taken"});
}
