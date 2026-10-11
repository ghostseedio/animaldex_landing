/**
 * Where the person was when they started an OAuth sign-in, set by
 * /api/auth/oauth and read by /auth/callback when the `next` query param did
 * not survive the round trip through Supabase.
 */
export const AUTH_NEXT_COOKIE = "animaldex-auth-next";
