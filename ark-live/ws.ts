/**
 * A small WebSocket server transport (RFC 6455) for `ark-live`, with no dependency: the handshake, frames in
 * (masked, any length up to the cap, fragmented or not), frames out (unmasked), ping, pong and close.
 *
 * This file and `server.mts` are the only Node-specific parts of the server (design §2.7): the room core in
 * `src/ark-live/` runs anywhere.
 */

import {createHash} from "node:crypto";
import type {IncomingMessage} from "node:http";
import type {Duplex} from "node:stream";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** The largest message a client may send (a pose is 21 B; the biggest text message is a ticket, about 200 B). */
export const MAX_MESSAGE_BYTES = 4096;
/** Past this much unsent data a slow viewer's snapshots are skipped (it gets the next one instead). */
export const BACKPRESSURE_BYTES = 256 * 1024;

export type WsHandlers = {
    onText: (text: string) => void;
    onBinary: (data: Uint8Array) => void;
    onClose: (code: number) => void;
};

export class WsConnection {
    private buffer = Buffer.alloc(0);
    private fragments: Buffer[] = [];
    private fragmentOpcode = 0;
    private closed = false;
    handlers: WsHandlers | null = null;

    constructor(private readonly socket: Duplex) {
        socket.on("data", (chunk: Buffer) => this.onData(chunk));
        socket.on("close", () => this.finish(1006));
        socket.on("error", () => this.finish(1006));
    }

    /** Unsent bytes waiting in the socket (the caller skips snapshots past `BACKPRESSURE_BYTES`). */
    pending(): number {
        return (this.socket as unknown as {writableLength?: number}).writableLength ?? 0;
    }

    isOpen(): boolean {
        return !this.closed;
    }

    sendText(text: string): void {
        this.write(1, Buffer.from(text, "utf8"));
    }

    sendBinary(data: ArrayBuffer | Uint8Array): void {
        this.write(2, Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data));
    }

    close(code = 1000, reason = ""): void {
        if (this.closed) return;
        const body = Buffer.alloc(2 + Buffer.byteLength(reason));
        body.writeUInt16BE(code, 0);
        body.write(reason, 2);
        this.write(8, body);
        this.socket.end();
        this.finish(code);
    }

    private finish(code: number): void {
        if (this.closed) return;
        this.closed = true;
        this.handlers?.onClose(code);
        this.socket.destroy();
    }

    private write(opcode: number, payload: Buffer): void {
        if (this.closed) return;
        const len = payload.length;
        let header: Buffer;
        if (len < 126) {
            header = Buffer.from([0x80 | opcode, len]);
        } else if (len < 65536) {
            header = Buffer.alloc(4);
            header[0] = 0x80 | opcode;
            header[1] = 126;
            header.writeUInt16BE(len, 2);
        } else {
            header = Buffer.alloc(10);
            header[0] = 0x80 | opcode;
            header[1] = 127;
            header.writeBigUInt64BE(BigInt(len), 2);
        }
        this.socket.write(Buffer.concat([header, payload]));
    }

    private onData(chunk: Buffer): void {
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        for (;;) {
            if (this.buffer.length < 2) return;
            const b0 = this.buffer[0];
            const b1 = this.buffer[1];
            const fin = (b0 & 0x80) !== 0;
            const opcode = b0 & 0x0f;
            const masked = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f;
            let offset = 2;
            if (len === 126) {
                if (this.buffer.length < 4) return;
                len = this.buffer.readUInt16BE(2);
                offset = 4;
            } else if (len === 127) {
                if (this.buffer.length < 10) return;
                const big = this.buffer.readBigUInt64BE(2);
                if (big > BigInt(MAX_MESSAGE_BYTES)) return this.close(1009, "too big");
                len = Number(big);
                offset = 10;
            }
            // Clients must mask (RFC 6455 §5.1); anything over the cap is refused.
            if (!masked) return this.close(1002, "unmasked");
            if (len > MAX_MESSAGE_BYTES) return this.close(1009, "too big");
            if (this.buffer.length < offset + 4 + len) return;
            const mask = this.buffer.subarray(offset, offset + 4);
            const payload = Buffer.alloc(len);
            for (let i = 0; i < len; i++) payload[i] = this.buffer[offset + 4 + i] ^ mask[i & 3];
            this.buffer = this.buffer.subarray(offset + 4 + len);
            this.onFrame(fin, opcode, payload);
            if (this.closed) return;
        }
    }

    private onFrame(fin: boolean, opcode: number, payload: Buffer): void {
        switch (opcode) {
            case 0: {
                // Continuation.
                if (!this.fragmentOpcode) return this.close(1002, "continuation");
                this.fragments.push(payload);
                const total = this.fragments.reduce((sum, b) => sum + b.length, 0);
                if (total > MAX_MESSAGE_BYTES) return this.close(1009, "too big");
                if (fin) {
                    const whole = Buffer.concat(this.fragments);
                    const op = this.fragmentOpcode;
                    this.fragments = [];
                    this.fragmentOpcode = 0;
                    this.deliver(op, whole);
                }
                return;
            }
            case 1:
            case 2:
                if (!fin) {
                    this.fragmentOpcode = opcode;
                    this.fragments = [payload];
                    return;
                }
                this.deliver(opcode, payload);
                return;
            case 8:
                this.close(payload.length >= 2 ? payload.readUInt16BE(0) : 1000);
                return;
            case 9:
                this.write(10, payload);
                return;
            case 10:
                return;
            default:
                this.close(1002, "opcode");
        }
    }

    private deliver(opcode: number, payload: Buffer): void {
        if (!this.handlers) return;
        if (opcode === 1) this.handlers.onText(payload.toString("utf8"));
        else this.handlers.onBinary(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength));
    }
}

/** Answer an HTTP upgrade with the WebSocket handshake; null (and the socket closed) when it isn't a valid one. */
export function acceptUpgrade(req: IncomingMessage, socket: Duplex): WsConnection | null {
    const key = req.headers["sec-websocket-key"];
    const version = req.headers["sec-websocket-version"];
    if (typeof key !== "string" || version !== "13" || String(req.headers.upgrade ?? "").toLowerCase() !== "websocket") {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        return null;
    }
    const accept = createHash("sha1").update(key + GUID).digest("base64");
    socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, "", ""].join("\r\n"));
    (socket as unknown as {setNoDelay?: (on: boolean) => void}).setNoDelay?.(true);
    return new WsConnection(socket);
}
