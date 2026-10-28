/**
 * Whether a voice call is offered.
 *
 * On iOS the call is in test builds only for now (AnimalPowerAskViews
 * `talkingModel` is nil outside DEBUG), so the web matches: it is on in
 * development and, in production, only once NEXT_PUBLIC_ANIMAL_CALLS is "on".
 * Publishing the models' glTF files alone launches nothing.
 *
 * A call needs a signed-in reader, as in the apps, where its spoken replies
 * come from the reader's own allowance. Development lets a signed-out reader
 * call, so a call can be tried locally with `?callScript=`.
 *
 * The drawer asks before showing the microphone, and the stream route asks
 * again before it answers a turn as a call.
 */
type CallEnv = {NODE_ENV?: string; NEXT_PUBLIC_ANIMAL_CALLS?: string};

export function askCallsOffered(signedIn: boolean, env: CallEnv = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ANIMAL_CALLS: process.env.NEXT_PUBLIC_ANIMAL_CALLS
}): boolean {
    const development = env.NODE_ENV !== "production";
    if (!development && env.NEXT_PUBLIC_ANIMAL_CALLS?.trim() !== "on") return false;
    return signedIn || development;
}
