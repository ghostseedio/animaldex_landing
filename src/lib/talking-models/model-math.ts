/**
 * The numbers behind a talking animal on a call, apart from the renderer so
 * they can be tested: its blink, how its mouth follows the voice, where the
 * camera sits, how the view zooms, and how the waves round the microphone
 * swell. Ports of the iOS `AnimalTalkingModel.swift` (`eyeOpenness`,
 * `AnimalMouthEnvelope`, `AnimalTalkingFraming`, `AnimalTalkingOrbit`) and
 * `AnimalVoiceCallView.swift` (`AnimalCallWaveMeter`).
 */

export type Vec3 = [number, number, number];

/** 1 open, near 0 shut: a quick blink about every four seconds, now and then a double one. */
export function eyeOpenness(time: number): number {
    const period = 4.1;
    const phase = time % period;
    const cycle = Math.trunc(time / period);
    const blink = (start: number) => {
        const d = phase - start;
        if (d < 0 || d >= 0.16) return 1;
        return 0.1 + 0.9 * Math.abs(d - 0.08) / 0.08;
    };
    const first = blink(0);
    const second = cycle % 3 === 2 ? blink(0.24) : 1;
    return Math.min(first, second);
}

/**
 * Turns how loud the voice is into how open the mouth is: quick to open on a
 * syllable, a little slower to close, shut in the pauses.
 */
export class MouthEnvelope {
    /** Quieter than this is a closed mouth; louder than `loudDecibels` is wide open. */
    quietDecibels = -42;
    loudDecibels = -14;
    openness = 0;

    /** `decibels` is the level now (dBFS); `elapsed` the seconds since the last call. */
    update(decibels: number, elapsed: number): number {
        const span = this.loudDecibels - this.quietDecibels;
        const target = Math.min(Math.max((decibels - this.quietDecibels) / span, 0), 1);
        // Opening takes ~40 ms, closing ~90 ms.
        const tau = target > this.openness ? 0.04 : 0.09;
        const blend = 1 - Math.exp(-Math.max(elapsed, 0) / tau);
        this.openness += (target - this.openness) * blend;
        return this.openness;
    }

    reset() {
        this.openness = 0;
    }
}

/** Smooths the voice's level into 0…1 for the waves: up quickly, down gently. */
export class WaveMeter {
    private value = 0;
    private last: number | null = null;

    update(decibels: number, time: number): number {
        const target = Math.min(Math.max((decibels + 50) / 36, 0), 1);
        const elapsed = this.last === null ? 0 : Math.min(Math.max(time - this.last, 0), 0.1);
        this.last = time;
        const tau = target > this.value ? 0.05 : 0.18;
        this.value += (target - this.value) * (1 - Math.exp(-elapsed / tau));
        return this.value;
    }
}

/** The camera's vertical field of view, in degrees. */
export const FIELD_OF_VIEW = 26;

const length = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

/**
 * Where the camera sits for a turn of the view away from the rest pose. At
 * rest it is the three-quarter view aimed a little towards the head; turned
 * away from it, the camera circles the box's middle and backs off, so the
 * whole animal fits from any side.
 */
export class TalkingFraming {
    static readonly restYaw = Math.atan2(0.62, 1.0);
    static readonly restPitch = Math.asin(0.30 / length([0.62, 0.30, 1.0]));
    /** From just above the floor (never under it) to nearly overhead. */
    static readonly pitchRange: [number, number] = [0.02, 1.2];

    constructor(
        readonly restCenter: Vec3,
        readonly restDistance: number,
        readonly orbitCenter: Vec3,
        readonly orbitDistance: number,
        /** Added to the rest pitch: a flat animal is seen from higher up. */
        readonly restLift = 0
    ) {}

    /** From the model's bounding box (natural look), as `AnimalTalkingStage.framing`. */
    static forBox(lowest: Vec3, highest: Vec3, restLift = 0): TalkingFraming {
        const middle: Vec3 = [(lowest[0] + highest[0]) / 2, (lowest[1] + highest[1]) / 2, (lowest[2] + highest[2]) / 2];
        // Seen three-quarter on, the near head looks bigger than the far tail:
        // aiming a little towards the head puts the animal in the middle.
        const center: Vec3 = [middle[0], middle[1], middle[2] + (highest[2] - lowest[2]) * 0.2];
        const diagonal = length([highest[0] - lowest[0], highest[1] - lowest[1], highest[2] - lowest[2]]);
        // Half the box's diagonal is roomier than the animal needs.
        const radius = diagonal / 2 * 0.74;
        const fov = FIELD_OF_VIEW * Math.PI / 180;
        const restDistance = radius / Math.tan(fov / 2) * 1.02;
        // Turned round, the whole animal has to fit from any side: a sphere
        // about the box's middle (corners are rarely filled, hence 0.9).
        const sphere = diagonal / 2 * 0.9;
        return new TalkingFraming(center, restDistance, middle, Math.max(sphere / Math.sin(fov / 2), restDistance), restLift);
    }

    /** `yaw` and `pitch` are the viewer's turn away from the rest view, in radians; `zoom` scales the distance (below 1 is closer). */
    pose(yaw: number, pitch: number, zoom = 1): {position: Vec3; target: Vec3} {
        const away = Math.min(1, Math.max(Math.abs(remainder(yaw, 2 * Math.PI)), Math.abs(pitch)) / 0.7);
        const t = away * away * (3 - 2 * away);
        const center: Vec3 = [
            this.restCenter[0] + (this.orbitCenter[0] - this.restCenter[0]) * t,
            this.restCenter[1] + (this.orbitCenter[1] - this.restCenter[1]) * t,
            this.restCenter[2] + (this.orbitCenter[2] - this.restCenter[2]) * t
        ];
        const distance = (this.restDistance + (this.orbitDistance - this.restDistance) * t) * zoom;
        const y = TalkingFraming.restYaw + yaw;
        const [low, high] = TalkingFraming.pitchRange;
        const p = Math.min(Math.max(TalkingFraming.restPitch + this.restLift + pitch, low), high);
        return {
            position: [
                center[0] + Math.cos(p) * Math.sin(y) * distance,
                center[1] + Math.sin(p) * distance,
                center[2] + Math.cos(p) * Math.cos(y) * distance
            ],
            target: center
        };
    }
}

/** Swift's `remainder(dividingBy:)`: the IEEE remainder, in [-m/2, m/2]. */
export function remainder(value: number, modulus: number): number {
    return value - modulus * Math.round(value / modulus);
}

/**
 * The view's zoom (the animal itself is turned by the grip): two fingers
 * pinch it closer or further, a double tap goes home. Yaw and pitch stay at
 * rest, as on iOS since the owner's 2026-10-28 rework.
 */
export class TalkingOrbit {
    yaw = 0;
    pitch = 0;
    /** 1 at rest; below 1 is closer. */
    zoom = 1;
    private velocity: [number, number] = [0, 0];
    private touching = false;
    private homing = false;

    static readonly radiansPerPoint = 0.009;
    static readonly zoomRange: [number, number] = [0.4, 1.6];

    /** Two fingers: slid `tilt` points down, twisted `twist` radians, pinched by `pinch` (above 1 spreads them: closer). */
    twoFingers(tilt: number, twist: number, pinch: number) {
        this.touching = true;
        this.pitch = this.clampedPitch(this.pitch + tilt * TalkingOrbit.radiansPerPoint);
        this.yaw += twist;
        const [low, high] = TalkingOrbit.zoomRange;
        this.zoom = Math.min(Math.max(this.zoom / Math.max(pinch, 0.01), low), high);
    }

    release() {
        this.touching = false;
        this.velocity = [0, 0];
    }

    /** Back to the usual view, now (a double tap). */
    home() {
        this.homing = true;
        this.touching = false;
        this.velocity = [0, 0];
    }

    step(elapsed: number) {
        if (this.touching || elapsed <= 0) return;
        this.yaw += this.velocity[0] * elapsed;
        this.pitch = this.clampedPitch(this.pitch + this.velocity[1] * elapsed);
        const decay = Math.exp(-4.5 * elapsed);
        this.velocity = [this.velocity[0] * decay, this.velocity[1] * decay];
        if (Math.hypot(this.velocity[0], this.velocity[1]) < 0.02) this.velocity = [0, 0];
        // Only a double tap brings it home (owner, 2026-10-28: no reset after 6 s).
        if (!this.homing) return;
        // Home the short way round.
        this.yaw = remainder(this.yaw, 2 * Math.PI);
        const k = 1 - Math.exp(-7 * elapsed);
        this.yaw -= this.yaw * k;
        this.pitch -= this.pitch * k;
        this.zoom += (1 - this.zoom) * k;
        if (Math.abs(this.yaw) < 0.002 && Math.abs(this.pitch) < 0.002 && Math.abs(this.zoom - 1) < 0.002) {
            this.homing = false;
            this.yaw = 0;
            this.pitch = 0;
            this.zoom = 1;
        }
    }

    private clampedPitch(value: number): number {
        const [low, high] = TalkingFraming.pitchRange;
        return Math.min(Math.max(value, low - TalkingFraming.restPitch), high - TalkingFraming.restPitch);
    }
}

/**
 * A finger at `point` on a ball centred at `center` on screen (pixels, y
 * down), as a direction in the camera's space (x right, y up, z towards the
 * viewer). Outside the ball it slides onto a gentle curve, so a drag past the
 * animal's edge still turns it smoothly (`AnimalGrip.ballPoint`).
 */
export function ballPoint(point: [number, number], center: [number, number], radius: number): Vec3 {
    const x = (point[0] - center[0]) / Math.max(radius, 1);
    const y = -(point[1] - center[1]) / Math.max(radius, 1);
    const d2 = x * x + y * y;
    const z = d2 <= 0.5 ? Math.sqrt(1 - d2) : 0.5 / Math.sqrt(d2);
    const n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
}
