/**
 * Plays the animal's voice at its own pace without changing its pitch, as
 * the streamed audio arrives.
 *
 * ElevenLabs' Flash ignores `speed`, so the server sends the speed as the
 * call's `rate` and the listener applies it (iOS through an
 * AVAudioUnitTimePitch, 0.75–1.25). Web Audio's playbackRate would shift the
 * pitch with it, so this is a streaming WSOLA: 40 ms Hann frames laid down
 * every 20 ms of output, each taken from where the input has got to (20 ms ×
 * rate on) within ±6 ms, at the offset that best continues the frame before.
 * At rate 1 it hands the input straight through.
 */

export class StreamingTimeStretch {
    readonly rate: number;
    private readonly frame: number;
    private readonly hop: number;
    private readonly tolerance: number;
    private readonly window: Float32Array;
    /** Input not yet used, from absolute sample `bufferStart`. */
    private buffer = new Float32Array(0);
    private bufferStart = 0;
    private frameIndex = 0;
    /** Where the previous frame was taken from (absolute), -1 before the first. */
    private previous = -1;
    private readonly overlap: Float32Array;
    private ended = false;

    constructor(rate: number, sampleRate = 24_000) {
        this.rate = Math.min(Math.max(rate, 0.75), 1.25);
        this.frame = Math.round(sampleRate * 0.04 / 2) * 2;
        this.hop = this.frame / 2;
        this.tolerance = Math.round(sampleRate * 0.006);
        this.window = new Float32Array(this.frame);
        for (let i = 0; i < this.frame; i++) this.window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / this.frame);
        this.overlap = new Float32Array(this.frame);
    }

    /** At (nearly) normal speed nothing is stretched. */
    get isIdentity(): boolean {
        return Math.abs(this.rate - 1) < 0.005;
    }

    /** More input; returns the output that is complete so far. */
    push(input: Float32Array): Float32Array {
        if (this.isIdentity) return input;
        if (this.ended) return new Float32Array(0);
        this.append(input);
        return this.run(false);
    }

    /** The input has ended: the rest of the output. */
    flush(): Float32Array {
        if (this.isIdentity || this.ended) return new Float32Array(0);
        const realEnd = this.bufferStart + this.buffer.length;
        this.append(new Float32Array(this.frame + 2 * this.tolerance));
        const out = this.run(true, realEnd);
        this.ended = true;
        return out;
    }

    private append(input: Float32Array) {
        const next = new Float32Array(this.buffer.length + input.length);
        next.set(this.buffer, 0);
        next.set(input, this.buffer.length);
        this.buffer = next;
    }

    private sample(at: number): number {
        const index = at - this.bufferStart;
        return index >= 0 && index < this.buffer.length ? this.buffer[index] : 0;
    }

    private run(flushing: boolean, realEnd = Number.POSITIVE_INFINITY): Float32Array {
        const chunks: Float32Array[] = [];
        const available = this.bufferStart + this.buffer.length;
        for (;;) {
            const nominal = Math.round(this.frameIndex * this.hop * this.rate);
            if (flushing && nominal >= realEnd) break;
            const needed = Math.max(nominal + this.tolerance, this.previous + this.hop) + this.frame;
            if (needed > available) break;
            const from = this.previous < 0 ? nominal : this.bestOffset(nominal);
            for (let i = 0; i < this.frame; i++) this.overlap[i] += this.window[i] * this.sample(from + i);
            chunks.push(this.overlap.slice(0, this.hop));
            this.overlap.copyWithin(0, this.hop);
            this.overlap.fill(0, this.hop);
            this.previous = from;
            this.frameIndex += 1;
            this.trim(Math.min(Math.round(this.frameIndex * this.hop * this.rate) - this.tolerance, this.previous + this.hop));
        }
        if (flushing) chunks.push(this.overlap.slice(0, this.hop));
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const out = new Float32Array(total);
        let at = 0;
        for (const chunk of chunks) {
            out.set(chunk, at);
            at += chunk.length;
        }
        return out;
    }

    /** The start within ±tolerance of `nominal` whose first half best continues the previous frame. */
    private bestOffset(nominal: number): number {
        const natural = this.previous + this.hop;
        const compare = (start: number, stride: number) => {
            let sum = 0;
            for (let i = 0; i < this.hop; i += stride) sum += this.sample(natural + i) * this.sample(start + i);
            return sum;
        };
        const low = Math.max(this.bufferStart, nominal - this.tolerance);
        const high = nominal + this.tolerance;
        let best = Math.max(low, Math.min(high, nominal));
        let bestScore = Number.NEGATIVE_INFINITY;
        // Coarse, then fine around the best.
        for (let start = low; start <= high; start += 3) {
            const score = compare(start, 2);
            if (score > bestScore) {
                bestScore = score;
                best = start;
            }
        }
        const coarse = best;
        bestScore = Number.NEGATIVE_INFINITY;
        for (let start = Math.max(low, coarse - 2); start <= Math.min(high, coarse + 2); start++) {
            const score = compare(start, 1);
            if (score > bestScore) {
                bestScore = score;
                best = start;
            }
        }
        return best;
    }

    private trim(keepFrom: number) {
        const drop = Math.min(Math.max(0, keepFrom - this.bufferStart), this.buffer.length);
        if (drop < 4096) return;
        this.buffer = this.buffer.slice(drop);
        this.bufferStart += drop;
    }
}
