/*
 * Trial Loops reference renderer (storyboard v1).
 *
 * This file is the behavioural spec for every client. iOS (SwiftUI Canvas), Android
 * (Compose Canvas) and the website port it one-to-one: same compile step, same
 * keyframes, same easing, same draw order. If a port and this file disagree, this
 * file is right. See SPEC.md for the authoring side.
 *
 * Usage (browser):
 *   const motion = TrialMotion.create(svgElement, storyboard, vocabulary, glyphs);
 *   motion.draw(t)            // t in seconds, any value; wraps by storyboard.loop
 *   motion.beatIndexAt(t)     // which caption is active
 *   motion.poster             // the still frame for Reduce Motion
 */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const lerp = (a, b, p) => a + (b - a) * p;
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ------------------------------------------------------------------ figures */

  // Keyframes {t, pose, x, y, o, facing}. Between two keyframes x/y are linear and
  // pose/opacity are eased; facing switches at the later keyframe.
  function compileFigure(sb, id, V) {
    const a = sb.actors[id];
    const T = V.timing;
    const start = { t: 0, pose: a.pose || "stand", x: a.x, y: 0, o: a.hidden ? 0 : 1, facing: a.facing === "left" ? -1 : 1 };
    const kf = [start];
    const last = () => kf[kf.length - 1];
    const push = (t, patch) => kf.push(Object.assign({}, last(), patch, { t }));
    const evs = allEvents(sb).filter((e) => e.actor === id).sort((p, q) => p.at - q.at);
    for (const e of evs) {
      switch (e.type) {
        case "pose":
          push(e.at, {}); push(e.at + (e.dur ?? T.poseDur), { pose: e.pose }); break;
        case "move": {
          const x0 = last().x, dir = Math.sign(e.to - x0) || last().facing;
          const step = e.gait === "run" ? T.runStep : T.walkStep;
          const prefix = e.gait === "run" ? "run_" : "walk_";
          const n = Math.max(1, Math.round(e.dur / step));
          push(e.at, { facing: dir });
          for (let i = 1; i <= n; i++) push(e.at + (i / n) * e.dur, { pose: prefix + (i % 2 ? "a" : "b"), x: lerp(x0, e.to, i / n) });
          push(e.at + e.dur + 0.25, { pose: "stand" });
          break;
        }
        case "jump": {
          const x0 = last().x, dur = T.jumpDur, h = 30 + Math.abs(e.dx) * 0.12;
          push(e.at, { facing: Math.sign(e.dx) || last().facing });
          for (let i = 1; i <= 10; i++) {
            const p = i / 10;
            push(e.at + p * dur, { pose: p < 0.9 ? "air" : "squat", x: lerp(x0, x0 + e.dx, p), y: -h * 4 * p * (1 - p) });
          }
          push(e.at + dur + T.jumpSettle, { pose: "stand" });
          break;
        }
        case "reset":
          push(e.at, {}); push(e.at + 0.25, { o: 0 });
          push(e.at + 0.3, { x: a.x, pose: a.pose || "stand", facing: start.facing });
          push(e.at + 0.55, { o: 1 });
          break;
        case "show": push(e.at, {}); push(e.at + T.popDur, { o: 1 }); break;
        case "hide": push(e.at, {}); push(e.at + T.popDur, { o: 0 }); break;
      }
    }
    kf.sort((p, q) => p.t - q.t);
    return kf;
  }

  function sampleFigure(kf, t, V) {
    let i = 0;
    while (i < kf.length - 1 && kf[i + 1].t <= t) i++;
    const k0 = kf[i], k1 = kf[Math.min(i + 1, kf.length - 1)];
    const p = k1.t > k0.t ? clamp((t - k0.t) / (k1.t - k0.t)) : 1;
    const q = ease(p);
    const A = V.figure.poses[k0.pose], B = V.figure.poses[k1.pose];
    const facing = p >= 1 ? k1.facing : k0.facing;
    const joints = A.map((j, n) => [lerp(j[0], B[n][0], q) * facing, lerp(j[1], B[n][1], q)]);
    return { joints, x: lerp(k0.x, k1.x, p), y: lerp(k0.y, k1.y, p), o: lerp(k0.o, k1.o, q), facing };
  }

  /* -------------------------------------------------------------------- shared */

  // Ring labels: a total under 100 s counts in seconds; longer totals count in whole minutes
  // ("20m"), and 6000 s or more in whole hours ("2h"), so four-digit seconds never overflow the ring.
  // A countdown (`hold`) rounds up, so its last minute reads "1m", never "0m"; a count-up (`timer`)
  // rounds down.
  function ringLabel(total, v, countdown) {
    if (total < 100) return String(v);
    const r = countdown ? Math.ceil : Math.floor;
    if (total < 6000) return r(v / 60) + "m";
    return r(v / 3600) + "h";
  }

  function allEvents(sb) {
    return sb.beats.flatMap((b) => b.events || []);
  }

  // Opacity and pop scale from show/hide events, starting from `hidden`.
  function visibility(evs, t, hidden, popDur) {
    let v = hidden ? 0 : 1, s = 1;
    for (const e of evs) {
      if (e.type !== "show" && e.type !== "hide") continue;
      if (t < e.at) break;
      const p = ease((t - e.at) / popDur);
      if (e.type === "show") { v = lerp(v, 1, p); s = 0.6 + 0.4 * p; } else { v = lerp(v, 0, p); s = 1; }
    }
    return { v, s };
  }

  function glyphGroup(parent, G, name, size, color, sw) {
    const g = el("g", {}, parent);
    const k = size / 24;
    el("path", {
      d: G.glyphs[name] || "", fill: "none", stroke: color, "stroke-width": (sw ?? 2) / 1, "stroke-linecap": "round",
      "stroke-linejoin": "round", transform: `scale(${k}) translate(-12 -12)`, "vector-effect": "none",
    }, g);
    return g;
  }

  function checkBadge(parent, V) {
    const g = el("g", { opacity: 0 }, parent);
    el("circle", { r: 8, fill: V.colors.lime }, g);
    el("path", { d: "M-4 0 l3 3 l5 -6", fill: "none", stroke: V.colors.dark, "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    return g;
  }

  /* ------------------------------------------------------------------- create */

  function create(svg, sb, V, G) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", `0 0 ${V.stage.width} ${V.stage.height}`);
    const C = V.colors, T = V.timing, FLOOR = V.stage.floorY;
    const evs = allEvents(sb).slice().sort((p, q) => p.at - q.at);
    const root = el("g", {}, svg);
    const layers = {
      floor: el("g", {}, root), under: el("g", {}, root), things: el("g", {}, root), people: el("g", {}, root),
      over: el("g", {}, root), widgets: el("g", {}, root),
    };
    const updaters = [];
    const figures = {};   // id -> {kf, state(t)}
    const centers = {};   // id -> t => [x, y]

    // ---- figures first: other actors and events anchor to them
    const figIds = Object.keys(sb.actors).filter((id) => sb.actors[id].kind === "figure");
    if (figIds.length) el("line", { x1: 14, x2: V.stage.width - 14, y1: FLOOR, y2: FLOOR, stroke: C.floor, "stroke-width": 1.5 }, layers.floor);
    for (const id of figIds) {
      const a = sb.actors[id];
      const kf = compileFigure(sb, id, V);
      const color = a.tone === "other" ? C.other : C.ink;
      const g = el("g", {}, layers.people);
      const S = { stroke: color, "stroke-width": V.figure.strokeWidth, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" };
      const bones = V.figure.bones.map(() => el("polyline", S, g));
      const head = el("circle", { r: V.figure.headRadius, fill: color }, g);
      const badge = checkBadge(layers.over, V);
      const ring = el("circle", { r: 44, fill: "none", stroke: C.lime, "stroke-width": 2.5, opacity: 0 }, layers.under);
      const myEvs = evs.filter((e) => e.actor === id);
      const state = (t) => {
        const f = sampleFigure(kf, t, V);
        f.P = f.joints.map(([x, y]) => [f.x + x, FLOOR + f.y + y]);
        return f;
      };
      figures[id] = { kf, state, color };
      centers[id] = (t) => { const f = state(t); return [f.x, FLOOR + f.y - 50]; };
      updaters.push((t) => {
        const f = state(t);
        V.figure.bones.forEach((ix, n) => bones[n].setAttribute("points", ix.map((i) => f.P[i].join(",")).join(" ")));
        head.setAttribute("cx", f.P[0][0]); head.setAttribute("cy", f.P[0][1]);
        g.setAttribute("opacity", f.o);
        const ck = myEvs.filter((e) => e.type === "check" && e.at <= t).pop();
        badge.setAttribute("opacity", ck ? ease((t - ck.at) / 0.25) * f.o : 0);
        badge.setAttribute("transform", `translate(${f.P[0][0]} ${f.P[0][1] - 24})`);
        const pu = myEvs.find((e) => e.type === "pulse" && t >= e.at && t <= e.until + 0.3);
        ring.setAttribute("opacity", pu ? (0.35 + 0.35 * Math.sin(((t - pu.at) * 2 * Math.PI) / 0.8)) * (1 - ease((t - pu.until) / 0.3)) * f.o : 0);
        ring.setAttribute("cx", f.x); ring.setAttribute("cy", FLOOR + f.y - 45);
      });

      // hold: countdown ring above the head
      for (const h of myEvs.filter((e) => e.type === "hold")) {
        const rg = el("g", { opacity: 0 }, layers.over);
        const L = 2 * Math.PI * 15;
        el("circle", { r: 15, fill: "rgba(7,16,11,.85)", stroke: "rgba(167,244,50,.25)", "stroke-width": 3 }, rg);
        const arc = el("circle", { r: 15, fill: "none", stroke: C.lime, "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(-90)", "stroke-dasharray": L }, rg);
        const num = el("text", { y: 4.5, "text-anchor": "middle", fill: C.ink, "font-size": 13, "font-weight": 800, "font-family": "ui-monospace, Menlo, monospace" }, rg);
        updaters.push((t) => {
          const on = t >= h.at - 0.15 && t <= h.until + 0.2;
          rg.setAttribute("opacity", on ? 1 : 0);
          if (!on) return;
          const f = state(t), p = clamp((t - h.at) / (h.until - h.at));
          rg.setAttribute("transform", `translate(${f.P[0][0] - 2} ${f.P[0][1] - 30})`);
          arc.setAttribute("stroke-dashoffset", L * p);
          num.textContent = ringLabel(h.seconds, Math.max(1, Math.ceil(h.seconds * (1 - p))), true);
        });
      }

      // holding: a glyph in the front hand
      for (const h of myEvs.filter((e) => e.type === "holding")) {
        const hg = el("g", { opacity: 0 }, layers.over);
        const inner = glyphGroup(hg, G, h.glyph, 18, C.ink, 2.2);
        updaters.push((t) => {
          const f = state(t);
          const v = ease((t - h.at) / T.popDur) * (1 - ease((t - h.until) / T.popDur));
          hg.setAttribute("opacity", v * f.o);
          hg.setAttribute("transform", `translate(${f.P[10][0] + 4 * f.facing} ${f.P[10][1] - 10})`);
        });
      }

      // bubble: speech or thought, above the head on the facing side
      for (const b of myEvs.filter((e) => e.type === "bubble")) {
        const bg = el("g", { opacity: 0 }, layers.over);
        const thought = b.style === "thought";
        el("rect", { x: -18, y: -15, width: 36, height: 30, rx: thought ? 15 : 9, fill: C.dark, stroke: C.ink, "stroke-width": 2 }, bg);
        const tail = thought
          ? [el("circle", { r: 3.2, fill: C.dark, stroke: C.ink, "stroke-width": 1.6 }, bg), el("circle", { r: 2, fill: C.dark, stroke: C.ink, "stroke-width": 1.4 }, bg)]
          : [el("path", { d: "M-6 14 L-12 22 L2 14", fill: C.dark, stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round" }, bg)];
        glyphGroup(bg, G, b.glyph, 18, C.lime, 2.2);
        updaters.push((t) => {
          const f = state(t);
          const p = ease((t - b.at) / T.popDur), q = 1 - ease((t - b.until) / T.popDur);
          bg.setAttribute("opacity", p * q * f.o);
          const s = 0.7 + 0.3 * p;
          const bx = f.P[0][0] + 24 * f.facing, by = f.P[0][1] - 26;
          bg.setAttribute("transform", `translate(${bx} ${by}) scale(${f.facing * s} ${s})`);
          if (thought) { tail[0].setAttribute("cx", -14); tail[0].setAttribute("cy", 18); tail[1].setAttribute("cx", -20); tail[1].setAttribute("cy", 24); }
        });
      }
    }

    // ---- items
    for (const [id, a] of Object.entries(sb.actors)) {
      if (a.kind !== "item") continue;
      const myEvs = evs.filter((e) => e.actor === id);
      const size = V.itemSizes[a.size || "m"];
      const g = el("g", {}, layers.things);
      const pulse = el("circle", { r: size * 0.78, fill: "none", stroke: C.lime, "stroke-width": 2.5, opacity: 0 }, g);
      if (a.tile !== false) el("rect", { x: -size / 2, y: -size / 2, width: size, height: size, rx: size * 0.2, fill: C.tile, stroke: C.tileStroke }, g);
      // one glyph layer per distinct glyph the item ever shows (transform crossfades)
      const names = [a.glyph, ...myEvs.filter((e) => e.type === "transform").map((e) => e.glyph)];
      const gl = names.map((n) => glyphGroup(g, G, n, size * 0.62, C.ink, 2));
      const strike = el("line", { x1: -size * 0.55, y1: size * 0.55, x2: size * 0.55, y2: -size * 0.55, stroke: C.cross, "stroke-width": 3, "stroke-linecap": "round", opacity: 0 }, g);
      const badge = checkBadge(g, V);
      badge.setAttribute("transform", `translate(${size / 2 - 2} ${-size / 2 + 2})`);
      const pos = (t) => {
        let x = a.x, y = a.y;
        for (const e of myEvs) {
          if (e.type !== "slide" || t < e.at) continue;
          const p = ease((t - e.at) / (e.dur ?? T.slideDur));
          x = lerp(x, e.x, p); y = lerp(y, e.y, p);
        }
        return [x, y];
      };
      centers[id] = pos;
      updaters.push((t) => {
        const [x, y] = pos(t);
        const { v, s } = visibility(myEvs, t, a.hidden, T.popDur);
        const tr = myEvs.filter((e) => e.type === "transform");
        let bump = 1;
        gl.forEach((layer, n) => {
          // layer n is visible after transform n-1 and before transform n
          const pin = n === 0 ? 1 : ease((t - tr[n - 1].at) / T.transformDur);
          const pout = n < tr.length ? ease((t - tr[n].at) / T.transformDur) : 0;
          layer.setAttribute("opacity", pin * (1 - pout));
        });
        for (const e of tr) if (t >= e.at && t <= e.at + T.transformDur) bump = 1 + 0.15 * Math.sin(Math.PI * (t - e.at) / T.transformDur);
        const cr = myEvs.filter((e) => e.type === "cross" && e.at <= t).pop();
        const cp = cr ? ease((t - cr.at) / 0.25) : 0;
        strike.setAttribute("opacity", cp);
        const ck = myEvs.filter((e) => e.type === "check" && e.at <= t).pop();
        badge.setAttribute("opacity", ck ? ease((t - ck.at) / 0.25) : 0);
        const pu = myEvs.find((e) => e.type === "pulse" && t >= e.at && t <= e.until + 0.3);
        pulse.setAttribute("opacity", pu ? (0.35 + 0.35 * Math.sin(((t - pu.at) * 2 * Math.PI) / 0.8)) * (1 - ease((t - pu.until) / 0.3)) : 0);
        g.setAttribute("opacity", v * (1 - 0.6 * cp));
        g.setAttribute("transform", `translate(${x} ${y}) scale(${s * bump})`);
      });
    }

    // ---- piles
    for (const [id, a] of Object.entries(sb.actors)) {
      if (a.kind !== "pile") continue;
      const P = V.pile, myEvs = evs.filter((e) => e.actor === id);
      const n = a.count, cols = Math.min(P.maxCols, n), rows = Math.ceil(n / cols);
      const cy = a.y ?? P.defaultCenterY;
      const cell = (i) => [V.stage.width / 2 - ((cols - 1) * P.cellW) / 2 + (i % cols) * P.cellW, cy - ((rows - 1) * P.cellH) / 2 + Math.floor(i / cols) * P.cellH];
      const glyphOf = (i) => a.glyphs[i % a.glyphs.length];
      const stack = myEvs.find((e) => e.type === "stack");
      const discard = myEvs.find((e) => e.type === "discard");
      const keep = myEvs.find((e) => e.type === "keep");
      const sort = myEvs.find((e) => e.type === "sort");
      const kept = discard ? discard.keep : [];
      const gone = [...Array(n).keys()].filter((i) => discard && !kept.includes(i)).sort((p, q) => ((p * 7) % 12) - ((q * 7) % 12));
      // sort: the slot each tile moves to so equal glyphs sit together
      const sortedSlot = {};
      [...Array(n).keys()].sort((p, q) => a.glyphs.indexOf(glyphOf(p)) - a.glyphs.indexOf(glyphOf(q)) || p - q).forEach((i, slot) => (sortedSlot[i] = slot));
      const group = el("g", {}, layers.things);
      const tiles = [...Array(n).keys()].map((i) => {
        const tg = el("g", {}, group);
        el("rect", { x: -P.tile / 2, y: -P.tile / 2, width: P.tile, height: P.tile, rx: 7, fill: C.tile, stroke: C.tileStroke }, tg);
        glyphGroup(tg, G, glyphOf(i), 22, C.ink, 2);
        const badge = checkBadge(tg, V);
        badge.setAttribute("transform", `translate(${P.tile / 2 - 2} ${-P.tile / 2 + 2})`);
        return { tg, badge, out: discard && !kept.includes(i) ? discard.at + gone.indexOf(i) * ((discard.until - discard.at) / gone.length) : null };
      });
      centers[id] = () => [V.stage.width / 2, cy];
      updaters.push((t) => {
        const { v } = visibility(myEvs, t, a.hidden, T.popDur);
        group.setAttribute("opacity", v);
        tiles.forEach((tile, i) => {
          let [x, y] = cell(i);
          if (sort) { const p = ease((t - sort.at) / (sort.dur ?? T.sortDur)); const [sx, sy] = cell(sortedSlot[i]); x = lerp(x, sx, p); y = lerp(y, sy, p); }
          const inP = stack ? ease((t - stack.at - (i * (stack.until - stack.at)) / n) / T.popDur) : 1;
          let s = 0.6 + 0.4 * inP, o = inP;
          if (tile.out !== null) {
            const p = ease((t - tile.out) / 0.32);
            x += 30 * p; y -= 26 * p; s *= 1 - 0.4 * p; o *= 1 - p;
          } else {
            if (keep) {
              const k = ease((t - keep.at) / T.keepDur);
              const slot = kept.indexOf(i), m = kept.length;
              const tx = V.stage.width / 2 + (slot - (m - 1) / 2) * 68;
              x = lerp(x, tx, k); y = lerp(y, cy + 8, k); s *= 1 + 0.4 * k;
              tile.badge.setAttribute("opacity", ease((t - keep.at - 0.4) / 0.25));
            }
          }
          if (!(keep && tile.out === null)) tile.badge.setAttribute("opacity", 0);
          tile.tg.setAttribute("transform", `translate(${x} ${y}) scale(${s})`);
          tile.tg.setAttribute("opacity", o);
        });
      });
    }

    // ---- lists
    for (const [id, a] of Object.entries(sb.actors)) {
      if (a.kind !== "list") continue;
      const L = V.list, myEvs = evs.filter((e) => e.actor === id);
      const n = a.glyphs.length, gap = Math.min(L.maxSpacing, L.span / Math.max(1, n - 1));
      const y = a.y ?? L.defaultY;
      const xs = a.glyphs.map((_, i) => V.stage.width / 2 + (i - (n - 1) / 2) * gap);
      const group = el("g", {}, layers.things);
      for (let i = 0; i < n - 1; i++) el("line", { x1: xs[i] + L.tile / 2, x2: xs[i + 1] - L.tile / 2, y1: y, y2: y, stroke: C.dim, "stroke-width": 2, "stroke-dasharray": "3 4" }, group);
      const nodes = a.glyphs.map((gname, i) => {
        const ng = el("g", { transform: `translate(${xs[i]} ${y})` }, group);
        el("rect", { x: -L.tile / 2, y: -L.tile / 2, width: L.tile, height: L.tile, rx: 8, fill: C.tile, stroke: C.tileStroke }, ng);
        glyphGroup(ng, G, gname, 22, C.ink, 2);
        const badge = checkBadge(ng, V);
        badge.setAttribute("transform", `translate(${L.tile / 2 - 2} ${-L.tile / 2 + 2})`);
        return { badge };
      });
      const cursor = el("rect", { x: -L.tile / 2 - 5, y: -L.tile / 2 - 5, width: L.tile + 10, height: L.tile + 10, rx: 11, fill: "none", stroke: C.lime, "stroke-width": 2.5, opacity: 0 }, group);
      const steps = myEvs.filter((e) => e.type === "step");
      centers[id] = () => [V.stage.width / 2, y];
      updaters.push((t) => {
        const { v } = visibility(myEvs, t, a.hidden, T.popDur);
        group.setAttribute("opacity", v);
        const done = steps.filter((e) => e.at <= t);
        if (!done.length) { cursor.setAttribute("opacity", 0); nodes.forEach((nd) => nd.badge.setAttribute("opacity", 0)); return; }
        const cur = done[done.length - 1], prev = done[done.length - 2];
        const p = ease((t - cur.at) / 0.3);
        const cx = prev ? lerp(xs[prev.index], xs[cur.index], p) : xs[cur.index];
        cursor.setAttribute("opacity", prev ? 1 : p);
        cursor.setAttribute("transform", `translate(${cx} ${y})`);
        nodes.forEach((nd, i) => {
          const finished = done.slice(0, -1).find((e) => e.index === i);
          nd.badge.setAttribute("opacity", finished ? ease((t - done[done.indexOf(finished) + 1].at) / 0.25) : 0);
        });
      });
    }

    // ---- marks + compare (anchored to the figure that made them)
    const marks = {};
    for (const m of evs.filter((e) => e.type === "mark")) {
      const f = figures[m.actor].state(m.at);
      marks[m.id] = { x: f.x + 2, at: m.at, actor: m.actor };
    }
    const cmp = evs.find((e) => e.type === "compare");
    if (Object.keys(marks).length) {
      const owner = sb.actors[Object.values(marks)[0].actor];
      const sx = owner.x - 14 * (owner.facing === "left" ? -1 : 1);
      el("line", { x1: sx, x2: sx, y1: FLOOR - 4, y2: FLOOR + 10, stroke: C.dim, "stroke-width": 2, "stroke-dasharray": "2 3" }, layers.floor);
      const accent = cmp ? cmp.marks[1] : null;
      const mEls = {};
      for (const [mid, m] of Object.entries(marks)) {
        const mg = el("g", { opacity: 0 }, layers.floor);
        const col = mid === accent ? C.lime : C.ink;
        el("path", { d: `M${m.x} ${FLOOR - 1} l-6 -9 h12 z`, fill: col }, mg);
        el("text", { x: m.x, y: FLOOR + 17, fill: col, "font-size": 11, "text-anchor": "middle", "font-family": "ui-monospace, Menlo, monospace", "font-weight": 700 }, mg).textContent = mid;
        mEls[mid] = mg;
      }
      const bars = cmp ? cmp.marks.map((mid, i) => ({
        r: el("rect", { x: Math.min(sx, marks[mid].x), y: FLOOR + 28 + i * 11, height: 5, rx: 2.5, fill: i ? C.lime : "rgba(233,242,228,.55)", width: 0 }, layers.under),
        w: Math.abs(marks[mid].x - sx),
      })) : [];
      updaters.push((t) => {
        for (const [mid, m] of Object.entries(marks)) {
          const p = ease((t - m.at) / 0.25);
          mEls[mid].setAttribute("opacity", p);
          mEls[mid].setAttribute("transform", `translate(0 ${-10 * (1 - p)})`);
        }
        bars.forEach((b, i) => b.r.setAttribute("width", Math.max(0, b.w * ease((t - cmp.at - i * 0.45) / 0.7))));
      });
    }

    // ---- look: a dashed sight line from a figure's head to a target
    for (const lk of evs.filter((e) => e.type === "look")) {
      const line = el("line", { stroke: C.lime, "stroke-width": 2, "stroke-dasharray": "4 6", "stroke-linecap": "round", opacity: 0 }, layers.over);
      updaters.push((t) => {
        const v = ease((t - lk.at) / 0.25) * (1 - ease((t - lk.until) / 0.25));
        line.setAttribute("opacity", 0.75 * v);
        if (!v) return;
        const f = figures[lk.actor].state(t), [tx, ty] = centers[lk.target](t);
        line.setAttribute("x1", f.P[0][0] + 8 * f.facing); line.setAttribute("y1", f.P[0][1]);
        line.setAttribute("x2", tx); line.setAttribute("y2", ty);
        line.setAttribute("stroke-dashoffset", -t * 20);
      });
    }

    // ---- give: a token travels from one actor to another
    for (const gv of evs.filter((e) => e.type === "give")) {
      const dur = gv.dur ?? T.giveDur;
      const tok = el("g", { opacity: 0 }, layers.over);
      el("circle", { r: 13, fill: C.dark, stroke: C.lime, "stroke-width": 2 }, tok);
      glyphGroup(tok, G, gv.glyph, 15, C.lime, 2.2);
      const land = el("circle", { r: 14, fill: "none", stroke: C.lime, "stroke-width": 2, opacity: 0 }, layers.over);
      updaters.push((t) => {
        const p = clamp((t - gv.at) / dur);
        const on = t >= gv.at && t <= gv.at + dur;
        tok.setAttribute("opacity", on ? Math.min(1, ease(p / 0.15), 1 - ease((p - 0.9) / 0.1)) : 0);
        const [x0, y0] = centers[gv.from](t), [x1, y1] = centers[gv.to](t);
        const q = ease(p);
        tok.setAttribute("transform", `translate(${lerp(x0, x1, q)} ${lerp(y0, y1, q) - 40 * 4 * q * (1 - q)})`);
        const lp = clamp((t - gv.at - dur) / 0.35);
        land.setAttribute("opacity", t >= gv.at + dur && lp < 1 ? 1 - lp : 0);
        land.setAttribute("r", 14 + 14 * lp);
        land.setAttribute("cx", x1); land.setAttribute("cy", y1);
      });
    }

    // ---- top-right widgets (one kind per storyboard)
    // When a storyboard has several events of one widget kind, only the latest one that has
    // started is drawn; the first fades in, later ones replace it in place.
    const widgetAlpha = (list, c, t) => {
      const started = list.filter((e) => e.at <= t);
      const cur = started.length ? started[started.length - 1] : list[0];
      if (cur !== c) return 0;
      return c === list[0] ? ease((t - c.at + 0.25) / 0.25) : 1;
    };
    const W = V.stage.width;
    const counts = evs.filter((e) => e.type === "count");
    for (const c of counts) {
      const tx = el("text", { x: W - 22, y: 40, "text-anchor": "end", fill: C.ink, "font-size": 30, "font-weight": 800, "font-family": "-apple-system, system-ui, sans-serif", opacity: 0 }, layers.widgets);
      updaters.push((t) => {
        tx.setAttribute("opacity", widgetAlpha(counts, c, t));
        const val = Math.round(lerp(c.from, c.to, clamp((t - c.at) / (c.until - c.at))));
        tx.textContent = val;
        tx.setAttribute("fill", t >= c.until ? C.lime : C.ink);
      });
    }
    const timers = evs.filter((e) => e.type === "timer");
    for (const c of timers) {
      const L = 2 * Math.PI * 15;
      const g = el("g", { transform: `translate(${W - 38} 32)`, opacity: 0 }, layers.widgets);
      el("circle", { r: 15, fill: "rgba(7,16,11,.85)", stroke: "rgba(167,244,50,.25)", "stroke-width": 3 }, g);
      const arc = el("circle", { r: 15, fill: "none", stroke: C.lime, "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(-90)", "stroke-dasharray": L, "stroke-dashoffset": L }, g);
      const num = el("text", { y: 4.5, "text-anchor": "middle", fill: C.ink, "font-size": 12, "font-weight": 800, "font-family": "ui-monospace, Menlo, monospace" }, g);
      updaters.push((t) => {
        g.setAttribute("opacity", widgetAlpha(timers, c, t));
        const p = clamp((t - c.at) / (c.until - c.at));
        arc.setAttribute("stroke-dashoffset", L * (1 - p));
        num.textContent = ringLabel(c.seconds, Math.round(c.seconds * p));
      });
    }
    const tallies = evs.filter((e) => e.type === "tally");
    for (const c of tallies) {
      const g = el("g", {}, layers.widgets);
      const strokes = [...Array(c.n).keys()].map((i) => {
        const grp = Math.floor(i / 5), k = i % 5, x0 = W - 30 - (Math.ceil(c.n / 5) - 1 - grp) * 40;
        const d = k < 4 ? `M${x0 - 24 + k * 7} 20 v22` : `M${x0 - 28} 38 L${x0 + 1} 24`;
        return el("path", { d, stroke: k < 4 ? C.ink : C.lime, "stroke-width": 3, "stroke-linecap": "round", opacity: 0 }, g);
      });
      updaters.push((t) => {
        const own = widgetAlpha(tallies, c, t) > 0 || (tallies[0] === c && t < c.at);
        strokes.forEach((s, i) => s.setAttribute("opacity", own ? ease((t - c.at - (i * (c.until - c.at)) / c.n) / 0.2) : 0));
      });
    }

    const loop = sb.loop;
    function wrap(t) { return ((t % loop) + loop) % loop; }
    function draw(t) {
      t = wrap(t);
      updaters.forEach((u) => u(t));
      root.setAttribute("opacity", Math.min(ease(t / T.fadeIn), 1 - ease((t - (loop - T.fadeOut)) / T.fadeOut)));
    }
    function beatIndexAt(t) {
      t = wrap(t);
      let cur = 0;
      sb.beats.forEach((b, i) => { if (t >= b.at) cur = i; });
      return cur;
    }
    const poster = sb.poster ?? loop - 0.6;
    draw(poster);
    return { draw, beatIndexAt, poster, loop };
  }

  root.TrialMotion = { create, compileFigure, sampleFigure, ringLabel, ease, clamp, lerp };
  if (typeof module !== "undefined") module.exports = root.TrialMotion;
})(typeof window !== "undefined" ? window : globalThis);
