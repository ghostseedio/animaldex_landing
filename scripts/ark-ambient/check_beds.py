"""Check the shipped ambient beds from the files alone (no source recordings needed).

For every ready bed in src/ark-scene/ambient-beds.json, both formats:
- the file decodes to at least loopStart + loopSeconds (+ the after-pad);
- the loop point (loopStart + loopSeconds -> loopStart) is no rougher than the
  rest of the loop: the 10 ms envelope step and the spectral change over 0.5 s
  either side, against every other moment of the loop;
- no click at the loop point once the engine's `blendLoopSeam` has run (as in
  src/ark-scene/ambient-beds.ts): the largest sample-to-sample step within
  0.5 ms of it, against the 99.9th percentile of the loop's steps (shown before
  and after the blend);
- loudness (EBU R128 over the loop played three times) and true peak, and the
  two formats within 1 LU of each other;
- the file size (<= 150 KB).
And the thunder one-shots: they decode and their sizes. Prints a table; exits 1
if any check fails. Run from the landing repo root:

  python3 scripts/ark-ambient/check_beds.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
spec = importlib.util.spec_from_file_location("make_beds", os.path.join(HERE, "make_beds.py"))
mb = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
spec.loader.exec_module(mb)  # type: ignore[union-attr]

SR = mb.SR
MAX_BYTES = 150 * 1024


def blend_loop_seam(y: np.ndarray, a: int, b: int, blend_ms: float = 12) -> np.ndarray:
    """The same as blendLoopSeam in src/ark-scene/ambient-beds.ts."""
    out = y.copy()
    n = min(int(round(blend_ms / 1000 * SR)), len(y) - b, b - a)
    w = (np.arange(n) + 0.5) / n
    out[a:a + n] = y[b:b + n] * (1 - w) + y[a:a + n] * w
    return out


def click_ratio(loop: np.ndarray) -> float:
    steps = np.abs(np.diff(np.concatenate([loop, loop[: SR // 100]])))
    n = len(loop)
    near = steps[n - 1 - SR // 2000: n - 1 + SR // 2000 + 1]
    return float(near.max() / np.percentile(steps[: n - 1], 99.9))


def main() -> int:
    with open(os.path.join("src", "ark-scene", "ambient-beds.json"), encoding="utf-8") as f:
        table = json.load(f)
    folder = os.path.join("public", table["path"].lstrip("/"))
    start = table["loopStart"]
    failures = []
    for bed in table["beds"]:
        if not bed["ready"]:
            print(f"{bed['id']:14} not ready")
            continue
        L = bed["loopSeconds"]
        lufs = {}
        for fmt in table["formats"]:
            path = os.path.join(folder, f"{bed['id']}.{fmt}")
            y = mb.decode(path)
            a = int(round(start * SR))
            n = int(round(L * SR))
            ok_len = len(y) >= a + n
            raw_click = click_ratio(y[a:a + n])
            y = blend_loop_seam(y, a, a + n)
            loop = y[a:a + n]
            click = click_ratio(loop)
            seam = mb.seam_numbers(loop)
            loud = mb.loudness(loop)
            lufs[fmt] = loud["lufs"]
            size = os.path.getsize(path)
            smooth_env = seam["env_step_db"] <= seam["env_step_p99_db"] * 1.1 + 0.3
            smooth_spec = seam["spectral_change_db"] <= seam["spectral_change_max_db"] * 1.1 + 0.2
            ok = ok_len and smooth_env and smooth_spec and click <= 1.0 and size <= MAX_BYTES and loud["true_peak"] <= -0.5
            if not ok:
                failures.append(f"{bed['id']}.{fmt}")
            print(f"{bed['id']:14} {fmt:4} {size / 1024:6.1f} KB  {len(y) / SR:6.2f} s  {loud['lufs']:6.1f} LUFS  TP {loud['true_peak']:5.1f}  "
                  f"seam env {seam['env_step_db']:.2f} (p99 {seam['env_step_p99_db']:.2f})  spec {seam['spectral_change_db']:.2f} (median {seam['spectral_change_median_db']:.2f}, max {seam['spectral_change_max_db']:.2f})  "
                  f"click {raw_click:.2f} -> {click:.2f}  {'ok' if ok else 'FAIL'}")
        if len(lufs) == 2 and abs(lufs["webm"] - lufs["m4a"]) > 1.0:
            failures.append(f"{bed['id']} loudness differs between formats")
    thunder = table.get("thunder")
    if thunder and thunder.get("ready"):
        for shot in (thunder["near"], thunder["far"]):
            for fmt in table["formats"]:
                path = os.path.join(folder, f"{shot['id']}.{fmt}")
                y = mb.decode(path)
                size = os.path.getsize(path)
                loud = mb.loudness(y)
                ok = size <= MAX_BYTES and abs(len(y) / SR - shot["seconds"]) < 0.5
                if not ok:
                    failures.append(f"{shot['id']}.{fmt}")
                print(f"{shot['id']:14} {fmt:4} {size / 1024:6.1f} KB  {len(y) / SR:6.2f} s  {loud['lufs']:6.1f} LUFS  TP {loud['true_peak']:5.1f}  {'ok' if ok else 'FAIL'}")
    if failures:
        print("FAILED: " + ", ".join(failures))
        return 1
    print("all ambient files pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
