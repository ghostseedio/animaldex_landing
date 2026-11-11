"""Make the Ark's ambient beds: seamless, loudness-normalised mono loops for phones.

Reads the recipe (beds.recipe.json beside this file), the downloaded source
recordings (--downloads; each recipe source has its download URL and licence
page), and writes for each bed:

  public/ark/sound/ambient/<id>.webm   Opus in WebM (Chrome, Firefox, Safari 17+)
  public/ark/sound/ambient/<id>.m4a    AAC-LC in MP4 (the fallback; AudioToolbox, so macOS)

plus, in --work, the loop WAV, a check sheet (<id>-check.png: the whole loop's
spectrogram over its waveform, and the seam twice over: 6 s either side of the
loop point, decoded from each encode), and report.json with the loop length,
loudness, true peak and seam numbers for every bed.

The loop: a stretch of the recording L + X seconds long; its last X seconds
are crossfaded into its first X (equal power for uncorrelated sound), so
sample L-1 runs straight into sample 0. L is searched within the recipe's
range for the point where the head and the tail sound most alike (envelope
and spectrum), so the crossfade blends like with like. A limiter (run round
the loop, so its gain is continuous across the loop point) holds the peaks
while the loop is brought to its loudness. Each file holds the loop with PAD
seconds of its own end before it and of its own start after it: the engine
loops from PAD to PAD + L. Decoded, both encodes line up with the loop to the
sample (checked) and match its loudness (each encode is measured and redone
with a correcting gain).

Needs ffmpeg (with libopus and AudioToolbox's aac_at, i.e. on macOS) and Python 3 with numpy. No network, no paid
services. Run from the landing repo root:

  python3 scripts/ark-ambient/make_beds.py --downloads <dir> --work <dir> [--only rain,surf]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

import numpy as np

SR = 48000
# Seconds of wrap-around padding either side of the loop in each file: the engine loops from PAD to PAD + loopSeconds.
PAD = 0.5
FFMPEG = os.environ.get("FFMPEG", "/opt/homebrew/bin/ffmpeg")
HERE = os.path.dirname(os.path.abspath(__file__))


def run(args: list[str], data: bytes | None = None) -> bytes:
    return subprocess.run(args, input=data, capture_output=True, check=True).stdout


def decode(path: str, start: float = 0.0, duration: float | None = None, filters: str = "") -> np.ndarray:
    # No -ss at 0: seeking an Opus or AAC file to 0 drops its first frame after the encoder delay.
    args = [FFMPEG, "-v", "error"] + (["-ss", f"{start:.3f}"] if start > 0 else [])
    if duration is not None:
        args += ["-t", f"{duration:.3f}"]
    args += ["-i", path]
    chain = "aformat=channel_layouts=mono" + (f",{filters}" if filters else "")
    args += ["-af", chain, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"]
    return np.frombuffer(run(args), dtype=np.float32).astype(np.float64)


def write_wav(path: str, x: np.ndarray) -> None:
    run([FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_f32le", path], x.astype(np.float32).tobytes())


def loudness(x: np.ndarray) -> dict:
    """EBU R128 of the loop played three times over (so the gating sees it as it is heard), with true peak."""
    tiled = np.tile(x, 3).astype(np.float32).tobytes()
    out = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"], input=tiled, capture_output=True, check=True).stderr.decode("utf-8", "replace")
    summary = out[out.rfind("Summary:"):]
    def num(label: str) -> float:
        m = re.search(label + r":\s+(-?[0-9.]+|-inf)", summary)
        return float("-inf") if not m or m.group(1) == "-inf" else float(m.group(1))
    return {"lufs": num("I"), "lra": num("LRA"), "true_peak": num("Peak")}


def limit(x: np.ndarray, ceiling_db: float) -> np.ndarray:
    """A look-ahead peak limiter run round the loop (the end feeds the start), so the gain is continuous across the loop point."""
    c = 10 ** (ceiling_db / 20)
    frame = SR // 1000  # 1 ms
    pad = SR  # 1 s of the loop's other end on each side
    tiled = np.concatenate([x[-pad:], x, x[:pad]])
    n = len(tiled) // frame
    peaks = np.abs(tiled[: n * frame]).reshape(n, frame).max(axis=1)
    need = np.minimum(1.0, c / np.maximum(peaks, 1e-9))
    a = 3  # frames of look-ahead either side
    padded = np.concatenate([np.ones(2 * a), need, np.ones(2 * a)])
    gmin = np.min(np.lib.stride_tricks.sliding_window_view(padded, 4 * a + 1), axis=1)
    # Release: the gain recovers with a ~80 ms time constant, never above what the look-ahead allows.
    rel = 1 - np.exp(-1 / 80)
    g = np.empty_like(gmin)
    level = 1.0
    for k in range(len(gmin)):
        level = min(gmin[k], level + (1 - level) * rel)
        g[k] = level
    smooth = np.convolve(np.concatenate([np.full(a, g[0]), g, np.full(a, g[-1])]), np.ones(2 * a + 1) / (2 * a + 1), mode="valid")
    centres = (np.arange(n) + 0.5) * frame
    gain = np.interp(np.arange(len(tiled)), centres, smooth)
    return (tiled * gain)[pad: pad + len(x)]


def envelope(x: np.ndarray, hop: int = 480) -> np.ndarray:
    n = len(x) // hop
    return np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)


def band_spectrum(x: np.ndarray) -> np.ndarray:
    """Third-octave-ish band levels (dB) of a stretch."""
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    edges = 60 * 2 ** (np.arange(0, 25) / 3)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        sel = (freqs >= lo) & (freqs < min(hi, 16000))
        out.append(10 * np.log10(spec[sel].sum() + 1e-20) if sel.any() else -200)
    return np.array(out)


def choose_length(x: np.ndarray, lo: float, hi: float, fade: float) -> float:
    """The loop length in [lo, hi] where the tail (L .. L+X) sounds most like the head (0 .. X)."""
    X = int(fade * SR)
    head = x[:X]
    head_env = np.log(envelope(head))
    head_spec = band_spectrum(head)
    best = None
    step = int(0.01 * SR)
    for L in range(int(lo * SR), int(hi * SR) + 1, step):
        tail = x[L:L + X]
        if len(tail) < X:
            break
        env = np.log(envelope(tail))
        level = abs(np.mean(env) - np.mean(head_env))
        shape = np.mean(np.abs((env - env.mean()) - (head_env - head_env.mean())))
        spec = np.mean(np.abs(band_spectrum(tail) - head_spec))
        score = level * 4 + shape + spec * 0.15
        if best is None or score < best[0]:
            best = (score, L)
    assert best is not None, "source too short for the loop range"
    return best[1] / SR


def make_loop(x: np.ndarray, L: float, fade: float) -> np.ndarray:
    n = int(round(L * SR))
    X = int(round(fade * SR))
    head = x[:X]
    tail = x[n:n + X]
    r = float(np.dot(head, tail) / (np.linalg.norm(head) * np.linalg.norm(tail) + 1e-12))
    t = (np.arange(X) + 0.5) / X
    if abs(r) < 0.3:
        fade_in, fade_out = np.sin(t * np.pi / 2), np.cos(t * np.pi / 2)
    else:
        fade_in, fade_out = t, 1 - t
    out = x[:n].copy()
    out[:X] = head * fade_in + tail * fade_out
    return out


def seam_numbers(loop: np.ndarray) -> dict:
    """How the loop point compares with every other moment of the loop: envelope step (dB, 10 ms frames), spectral change over 0.5 s, sample step."""
    n = len(loop)
    tiled = np.concatenate([loop, loop])
    env = 20 * np.log10(envelope(tiled, 480))
    steps = np.abs(np.diff(env))
    seam_frame = n // 480
    seam_step = float(np.max(steps[seam_frame - 2: seam_frame + 2]))
    w = SR // 2
    def change(at: int) -> float:
        return float(np.mean(np.abs(band_spectrum(tiled[at - w:at]) - band_spectrum(tiled[at:at + w]))))
    seam_change = change(n)
    others = [change(int(k)) for k in np.linspace(w, n - w, 40)[1:-1]]
    sample_step = float(abs(loop[-1] - loop[0]))
    diffs = np.abs(np.diff(loop))
    return {
        "env_step_db": round(seam_step, 2),
        "env_step_p99_db": round(float(np.percentile(steps[: len(steps) // 2], 99)), 2),
        "spectral_change_db": round(seam_change, 2),
        "spectral_change_median_db": round(float(np.median(others)), 2),
        "spectral_change_max_db": round(float(np.max(others)), 2),
        "sample_step": round(sample_step, 5),
        "sample_step_p999": round(float(np.percentile(diffs, 99.9)), 5),
    }


def check_sheet(work: str, bed: str, loop: np.ndarray, decoded: dict[str, np.ndarray]) -> str:
    """Whole loop spectrogram + waveform; then 12 s around the loop point for each encode, webm then m4a (the seam is the red line, mid-waveform)."""
    parts = []
    full = os.path.join(work, f"{bed}-sheet-full.png")
    wav = os.path.join(work, f"{bed}-sheet.wav")
    write_wav(wav, loop)
    run([FFMPEG, "-v", "error", "-y", "-i", wav, "-filter_complex",
         "[0:a]asplit[a][b];[a]showspectrumpic=s=1100x260:legend=1:fscale=log:color=intensity:scale=log:gain=2,pad=1400:ih[s];"
         "[b]showwavespic=s=1400x90:colors=0x66ccff:scale=sqrt[w];[s][w]vstack=inputs=2", "-frames:v", "1", full])
    parts.append(full)
    for fmt, y in decoded.items():
        n = len(y)
        around = np.concatenate([y[n - 6 * SR:], y[: 6 * SR]])
        swav = os.path.join(work, f"{bed}-seam-{fmt}.wav")
        spng = os.path.join(work, f"{bed}-seam-{fmt}.png")
        write_wav(swav, around)
        run([FFMPEG, "-v", "error", "-y", "-i", swav, "-filter_complex",
             "[0:a]asplit[a][b];[a]showspectrumpic=s=1100x200:legend=1:fscale=log:color=intensity:scale=log:gain=2,pad=1400:ih[s];"
             "[b]showwavespic=s=1400x70:colors=0xffcc66:scale=sqrt,drawbox=x=699:y=0:w=2:h=ih:color=red@0.9:t=fill[w];[s][w]vstack=inputs=2",
             "-frames:v", "1", spng])
        parts.append(spng)
    sheet = os.path.join(work, f"{bed}-check.png")
    args = [FFMPEG, "-v", "error", "-y"]
    for p in parts:
        args += ["-i", p]
    args += ["-filter_complex", "".join(f"[{i}:v]" for i in range(len(parts))) + f"vstack=inputs={len(parts)}", "-frames:v", "1", sheet]
    run(args)
    return sheet


def padded(loop: np.ndarray) -> np.ndarray:
    """The loop with PAD seconds of its own end before it and of its own start after it: the encoders are settled by
    the loop point, and a decoder that trims its codec delay a little differently still loops continuous sound."""
    p = int(PAD * SR)
    return np.concatenate([loop[-p:], loop, loop[:p]])


def encode_one(loop: np.ndarray, work: str, path: str, fmt: str, kbps: int, gain_db: float = 0.0, pad: bool = True) -> None:
    wav = os.path.join(work, f"_encode-{fmt}.wav")
    write_wav(wav, (padded(loop) if pad else loop) * 10 ** (gain_db / 20))
    if fmt == "webm":
        run([FFMPEG, "-v", "error", "-y", "-i", wav, "-c:a", "libopus", "-b:a", f"{kbps}k", "-vbr", "on", "-compression_level", "10", "-application", "audio", "-map_metadata", "-1", path])
    else:
        # Apple's AudioToolbox AAC: ffmpeg's own AAC encoder drifts over its first ~10 s (about 2 dB of band level),
        # which shows at the loop point; AudioToolbox is steady from the first frame (and is what Safari decodes).
        run([FFMPEG, "-v", "error", "-y", "-i", wav, "-c:a", "aac_at", "-aac_at_mode", "cvbr", "-b:a", f"{kbps}k", "-map_metadata", "-1", "-movflags", "+faststart", path])


def offset_of(reference: np.ndarray, y: np.ndarray) -> int:
    """Samples by which y lags the reference (0 = aligned), searched within ±50 ms."""
    seg = reference[SR: SR * 3]
    best = (-2.0, 0)
    for off in range(-2400, 2401, 1):
        s = SR + off
        if s < 0 or s + len(seg) > len(y):
            continue
        part = y[s:s + len(seg)]
        c = float(np.dot(seg, part) / (np.linalg.norm(seg) * np.linalg.norm(part) + 1e-12))
        if c > best[0]:
            best = (c, off)
    return best[1]


def make_bed(recipe: dict, downloads: str, work: str, out_dir: str) -> dict:
    bed = recipe["id"]
    lo, hi = recipe["loop"]
    fade = recipe["crossfade"]
    need = hi + fade + 0.5
    mix = None
    for layer in recipe["layers"]:
        src = os.path.join(downloads, layer["file"])
        x = decode(src, layer["start"], need, layer.get("filters", "")) * 10 ** (layer.get("gain_db", 0) / 20)
        if len(x) < int(need * SR) - SR // 10:
            raise SystemExit(f"{bed}: {layer['file']} from {layer['start']} s is shorter than {need:.1f} s")
        x = x[: int(need * SR)]
        mix = x if mix is None else mix[: len(x)] + x[: len(mix)]
    assert mix is not None
    L = choose_length(mix, lo, hi, fade)
    loop = make_loop(mix, L, fade)
    # Loudness: to the target, then down if the true peak would pass the ceiling.
    target = recipe.get("lufs", -20.0)
    ceiling = recipe.get("true_peak", -1.5)
    first = loudness(loop)
    loop = loop * 10 ** ((target - first["lufs"]) / 20)
    # Rain drips, wave slaps and the like: limit the peaks (round the loop) and bring the level back, a few times.
    for _ in range(3):
        loop = limit(loop, ceiling - 0.6)
        now = loudness(loop)
        if abs(now["lufs"] - target) < 0.2:
            break
        loop = loop * 10 ** ((target - now["lufs"]) / 20)
    second = loudness(loop)
    if second["true_peak"] > ceiling:
        loop = loop * 10 ** ((ceiling - second["true_peak"]) / 20)
    final = loudness(loop)
    loop_wav = os.path.join(work, f"{bed}-loop.wav")
    write_wav(loop_wav, loop)
    # Bitrates within ~145 KB a file: Opus 28k and AAC 32k unless the loop is long.
    seconds = len(loop) / SR + 2 * PAD
    budget = int(145 * 1024 * 8 / 1000 / seconds) - 1
    kbps = {"webm": min(recipe.get("opus_kbps", 28), budget), "m4a": min(recipe.get("aac_kbps", 32), budget)}
    n = len(loop)
    p = int(PAD * SR)
    decoded = {}
    report = {"id": bed, "loop_seconds": round(n / SR, 4), "loop_start": PAD, "source_loudness": first, "loop": final, "seam_loop": seam_numbers(loop), "files": {}}
    for fmt in ("webm", "m4a"):
        path = os.path.join(out_dir, f"{bed}.{fmt}")
        # Low bitrates shift the loudness a little (Opus quieter, AAC louder): encode, measure, and encode again matched.
        gain_db = 0.0
        for _ in range(3):
            encode_one(loop, work, path, fmt, kbps[fmt], gain_db)
            y = decode(path)
            heard = loudness(y[p:p + n])
            miss = final["lufs"] - heard["lufs"]
            if abs(miss) < 0.3:
                break
            gain_db += miss
            if heard["true_peak"] + miss > -1.0:
                gain_db -= heard["true_peak"] + miss + 1.0
        off = offset_of(np.concatenate([loop[-p:], loop]), y)
        decoded[fmt] = y[p:p + n]
        report["files"][fmt] = {
            "bytes": os.path.getsize(path),
            "kbps": kbps[fmt],
            "gain_db": round(gain_db, 2),
            "decoded_seconds": round(len(y) / SR, 4),
            "offset_samples": off,
            "loudness": loudness(y[p:p + n]),
            "seam": seam_numbers(y[p:p + n]),
        }
    report["sheet"] = check_sheet(work, bed, loop, decoded)
    return report


def make_oneshot(recipe: dict, downloads: str, work: str, out_dir: str) -> dict:
    """A one-shot (thunder): a cut with fades, at its loudness, no loop and no padding."""
    shot = recipe["id"]
    x = decode(os.path.join(downloads, recipe["file"]), recipe["start"], recipe["duration"], recipe.get("filters", ""))
    n = len(x)
    t = np.arange(n) / SR
    fade_in = np.clip(t / max(recipe.get("fade_in", 0.02), 1e-3), 0, 1)
    fade_out = np.clip((n / SR - t) / max(recipe.get("fade_out", 3.0), 1e-3), 0, 1)
    x = x * np.sin(fade_in * np.pi / 2) ** 2 * np.sin(fade_out * np.pi / 2) ** 2
    target = recipe.get("lufs", -20.0)
    ceiling = recipe.get("true_peak", -1.5)
    first = loudness(x)
    x = x * 10 ** ((target - first["lufs"]) / 20)
    for _ in range(3):
        x = limit(x, ceiling - 0.6)
        now = loudness(x)
        if abs(now["lufs"] - target) < 0.2:
            break
        x = x * 10 ** ((target - now["lufs"]) / 20)
    final = loudness(x)
    report = {"id": shot, "duration_seconds": round(n / SR, 4), "loop": final, "files": {}}
    decoded = {}
    for fmt, kbps in (("webm", recipe.get("opus_kbps", 28)), ("m4a", recipe.get("aac_kbps", 32))):
        path = os.path.join(out_dir, f"{shot}.{fmt}")
        gain_db = 0.0
        for _ in range(3):
            encode_one(x, work, path, fmt, kbps, gain_db, pad=False)
            y = decode(path)
            heard = loudness(y[:n])
            miss = final["lufs"] - heard["lufs"]
            if abs(miss) < 0.3:
                break
            gain_db += miss
        decoded[fmt] = y[:n]
        report["files"][fmt] = {"bytes": os.path.getsize(path), "kbps": kbps, "gain_db": round(gain_db, 2), "decoded_seconds": round(len(y) / SR, 4), "offset_samples": offset_of(x, y), "loudness": loudness(y[:n])}
    wav = os.path.join(work, f"{shot}-sheet.wav")
    write_wav(wav, np.concatenate([decoded["webm"], np.zeros(SR // 2), decoded["m4a"]]))
    sheet = os.path.join(work, f"{shot}-check.png")
    run([FFMPEG, "-v", "error", "-y", "-i", wav, "-filter_complex",
         "[0:a]asplit[a][b];[a]showspectrumpic=s=1100x260:legend=1:fscale=log:color=intensity:scale=log:gain=2,pad=1400:ih[s];"
         "[b]showwavespic=s=1400x90:colors=0x66ccff:scale=sqrt[w];[s][w]vstack=inputs=2", "-frames:v", "1", sheet])
    report["sheet"] = sheet
    return report


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--downloads", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--out", default=os.path.join("public", "ark", "sound", "ambient"))
    ap.add_argument("--recipe", default=os.path.join(HERE, "beds.recipe.json"))
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    with open(args.recipe, encoding="utf-8") as f:
        book = json.load(f)
    recipes = book["beds"]
    oneshots = book.get("oneshots", [])
    only = {s for s in args.only.split(",") if s}
    os.makedirs(args.work, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)
    report_path = os.path.join(args.work, "report.json")
    reports = {}
    if os.path.exists(report_path):
        with open(report_path, encoding="utf-8") as f:
            reports = json.load(f)
    for recipe in recipes:
        if only and recipe["id"] not in only:
            continue
        print(f"{recipe['id']}…", file=sys.stderr, flush=True)
        reports[recipe["id"]] = make_bed(recipe, args.downloads, args.work, args.out)
        r = reports[recipe["id"]]
        print(f"  {r['loop_seconds']} s, {r['loop']['lufs']} LUFS, TP {r['loop']['true_peak']}, webm {r['files']['webm']['bytes']} B, m4a {r['files']['m4a']['bytes']} B", file=sys.stderr)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(reports, f, indent=1)
    for recipe in oneshots:
        if only and recipe["id"] not in only:
            continue
        print(f"{recipe['id']} (one-shot)…", file=sys.stderr, flush=True)
        reports[recipe["id"]] = make_oneshot(recipe, args.downloads, args.work, args.out)
        r = reports[recipe["id"]]
        print(f"  {r['duration_seconds']} s, {r['loop']['lufs']} LUFS, TP {r['loop']['true_peak']}, webm {r['files']['webm']['bytes']} B, m4a {r['files']['m4a']['bytes']} B", file=sys.stderr)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(reports, f, indent=1)


if __name__ == "__main__":
    main()
