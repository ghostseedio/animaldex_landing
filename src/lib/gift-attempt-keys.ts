/**
 * One idempotency key per gift attempt. A retry of the same Gift to the same
 * capture (after a timeout, a dropped connection, or a second click on Send
 * after an error, even after closing and reopening the sheet) reuses the key,
 * so `send_capture_gift` returns the Gift it already made instead of charging
 * again. The key is dropped only once the server confirms the Gift; the next
 * send of that Gift is a new attempt.
 */
export class GiftAttemptKeys {
    private readonly pending = new Map<string, string>();

    constructor(private readonly makeKey: () => string = () => crypto.randomUUID()) {}

    key(captureId: string, definitionId: string): string {
        const slot = `${captureId}|${definitionId}`;
        let key = this.pending.get(slot);
        if (!key) {
            key = this.makeKey();
            this.pending.set(slot, key);
        }
        return key;
    }

    succeeded(captureId: string, definitionId: string): void {
        this.pending.delete(`${captureId}|${definitionId}`);
    }
}

/** The tab's open gift attempts, shared by every Gift sheet. */
export const giftAttemptKeys = new GiftAttemptKeys();
