/**
 * Response shapes of the `identity-interview-next` edge function, as decoded by
 * IdentityNextInterviewResponse in the iOS repo (Models/IdentityProfile.swift).
 */

export type WildProfileRenderMessage = {
    text: string;
    delay_ms?: number | null;
};

export type WildProfileInterviewQuestion = {
    id: string;
    session_id: string;
    question_index: number;
    dimension?: string | null;
    sensitivity?: string | null;
    question_text: string;
    question_type?: string | null;
    skip_allowed?: boolean | null;
};

export type WildProfileInterviewState = {
    answered_count?: number;
    skipped_count?: number;
    readiness_score?: number;
    confidence_score?: number;
    recurring_themes?: string[] | null;
    covered_dimensions?: string[] | null;
    conversation_summary?: string | null;
};

export type WildProfileChatMessage = {
    id: string;
    role: "assistant" | "user" | string;
    content: string;
    question_id?: string | null;
    answer_id?: string | null;
    sensitivity?: string | null;
    created_at?: string | null;
    render_messages?: WildProfileRenderMessage[] | null;
    render_delay_ms?: number | null;
    expects_user_reply?: boolean | null;
    contains_question?: boolean | null;
    response_mode?: string | null;
};

export type WildProfileNextResponse = {
    status: "ask_question" | "ready_for_generation" | string;
    session_id: string;
    question?: WildProfileInterviewQuestion | null;
    state?: WildProfileInterviewState | null;
    messages?: WildProfileChatMessage[] | null;
};

export type WildProfileSession = {
    id: string;
    status: string;
    generation_error?: string | null;
};

/** What `/api/app/wild-profile` returns to the interview page. */
export type WildProfileInterviewPayload = {
    session: WildProfileSession;
    generating: boolean;
    response: WildProfileNextResponse | null;
};
