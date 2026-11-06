# Web perf pass, 2026-11-06/07: the signed-in app (`/app`)

The owner asked for this on 2026-11-06: "get performance immaculate … instant response times and always smooth without any lagging, especially if i have multiple animals, when i swipe left and right multiple times to the side menu sometimes there's lag".

This is the web lane. iOS, Android and the animal reply latency (`/api/ask/stream`) were separate lanes. Everything here was measured on a production build (`next build && next start`, Next 13.5.11) before it was changed. Every number below compares the same scenario on two builds served side by side. The runs alternated between the builds, config by config, and each figure is the median of two rounds.

## What was wrong, and what changed

| # | Finding | Fix (commit subject) |
|---|---|---|
| 1 | **An endless refetch loop while the Companions chat is open (live on animaldex.app).** Details below the table. | "Companions chat: the conversation's subject is a value…" |
| 2 | Every side menu open and close re-rendered every reader of the shell's context. The value object and `toggleMenu` were new on each render, so the chat rebuilt its `page` and the whole 4,700-line conversation drew again. A pick on `/app` also `router.push`ed `/app`, a server round trip for the page already shown. | "Side menu: opening and closing it no longer draws the chat again…" |
| 3 | A `useLayoutEffect` with no dependency list read `scrollHeight` after every render, so each keystroke laid out the whole thread. The thread's MutationObserver re-observed every row on each streamed update. | "Chat thread: a keystroke or a streamed word no longer lays out the whole thread" |
| 4 | The phone slide-over mounts on each open, and its roster re-read companions, cards and conversations every time: three requests and a redraw per open. | "Side menu: no longer re-reads the animals, cards and conversations on every open" (30 s freshness; window focus still refreshes) |
| 5 | A 48 px black band under the phone composer. `useFillToFoot` measured before the shell's hamburger row went away, and never again. | "Companions chat: runs to the foot of a phone's screen again" |
| 6 | Switching animals rendered the new thread in the tap's own task. | "…switching animals is a transition…" |
| 7 | **web main 2e387511 (not deployed) put the phone slide-over inside the page wrapper it makes `inert`.** The open menu could not be tapped, the backdrop did not close it, and focus could not enter. | "Side menu on a phone: the open menu can be touched again" |
| 8 | A long thread mounted all its messages in one task: 60–190 ms on a phone at 4× CPU with 120 messages. | "Chat thread: a long thread draws its newest 24 messages first and the older ones in batches after" |
| 9 | `/app` shipped the whole conversation script in its first load, although the server draws the splash on that tab. | "Companions tab: the chat's script loads beside the roster's read…" (`/app` first-load JS **254 kB → 155 kB**; 158 kB rebased on main 50b1f3cc) |
| 10 | Dead code: the tab bar's and drawer's links, `NavBadge`, the active-route helpers and three imports. Nothing has drawn them since 877294e5. | "App shell: drop the tab bar's and drawer's links…" |
| 11 | The dialog effect from #7 set `inert` on the page and called `focus()` in the same task. That forced a style pass over ~4,300 elements (the whole thread), 30–38 ms of each 50–80 ms menu open or close. | "Side menu on a phone: opening and closing it is never one long task, even over a long thread" |

How the loop in #1 worked:
1. `companions-chat.tsx` rebuilt `page.subject.subject` from a roster row object on every roster recompute.
2. `AskConversation` keyed its context read on that object's identity, so it reset `context` to null.
3. Every owner-chat fetch re-ran: history, companion, speech, training, debates, bond, animal messages.
4. The animal-messages read calls `reloadCompanions()`, which recomputes the roster, and step 1 happens again.

Each cycle sent about 9 requests, one of them a mark-read DB write, and after 60 s also a context POST. That is 350–440 requests per idle 10 s at 120 ms API latency, for as long as the chat is open. It also flickered the owner chat, which is what made phone CLS 5–9.

Not changed, on purpose:
- **Composer text kept in the parent.** Typing already measured INP 24 ms at 4× CPU with 120 messages. Moving the composer's text out of the conversation would touch code two other sessions were editing that night, for no measurable gain. The patch is kept in this lane's scratchpad (`composer-isolation.patch`).
- **The reply pacer re-rendering the conversation per word.** No long tasks while streaming. That code belongs to the reply-speed lane.
- **Avatar images.** The artwork is 250 px and 15 KB each, so decoding is not a cost.

## Before and after

Setup:
- **Builds.** Before = web main 2e387511 plus fix #7, so its menu can be used; with it, only this lane's changes differ. After = this branch.
- **Browser.** Chrome 156 headless.
- **Phone.** 390×844, 3× DPR, touch, 4× CPU throttling. **Desktop.** 1440×900, no throttling.
- **Fixtures.** Every `/api` is answered in the browser with 120 ms latency. Replies are 220 tokens at ~33 tokens/s.
- **Two sizes.** 5 animals with a 6-message thread, and 60 animals with a 120-message thread.

Checks on the branch rebased onto web main 50b1f3cc: `tsc --noEmit` clean, `npm test` 1,639/1,639 passing, `next build` green.

Units: ms unless noted. "Long" = tasks over 50 ms. INP = worst interaction (event-timing duration) in the scenario.

### Phone, 60 animals, 120-message thread

| Scenario | Before | After |
|---|---|---|
| Splash → chat ready | 778 | **644** |
| LCP | 648 | **564** |
| TBT (load) | 139 | **0** |
| Longest task (load) | 189 | **none > 50** |
| CLS | 8.90 | **0.32** |
| Requests in 10 s idle | 354 | **0** |
| Menu open/close ×10: long tasks | 10 | **0** |
| Menu: INP / frames > 50 ms | 136 / 8 | **88 / 1** |
| Menu: tap → menu shown (median) | 320 | **144** |
| Switch animal ×5: long tasks | 1 | **0** |
| Switch: INP / tap → chat (median) | 96 / 221 | **64 / 125** |
| Composer focus/blur: INP | 40 | 40 |
| Typing 60 chars: INP / long tasks | 24 / 0 | 24 / 0 |
| Thread scroll: frames > 50 ms | 0 | 0 |
| Streaming a reply (+ typing during it): long tasks / INP | 0 / 40 | 0 / 48 |

### Phone, 5 animals, 6-message thread

| Scenario | Before | After |
|---|---|---|
| Splash → chat ready / LCP | 626 / 544 | 659 / 576 |
| TBT / longest task (load) | 31 / 81 | **0 / none > 50** |
| CLS | 5.47 | **0.32** |
| Requests in 10 s idle | 417 | **0** |
| Menu ×10: long tasks / INP | 0 / 64 | 0 / 56 |
| Switch ×5: long tasks / INP / tap → chat | 1 / 88 / 133 | **0 / 40 / 76** |
| Typing / streaming: long tasks | 0 / 0 | 0 / 0 |

### Desktop (the sidebar is always there)

The desktop "after" build is from one run earlier. It is this branch without #10 and #11, and its chat chunk started loading after hydration instead of at module load. Neither difference touches the desktop sidebar.

| Scenario (60 animals, 120 messages) | Before | After |
|---|---|---|
| Chat ready / LCP | 852 / 796 | 865 / 716 |
| CLS | 0.46 | **0.07** |
| Requests in 10 s idle | 432 | **0** |
| Sidebar scroll, switch, typing, streaming: long tasks | 0 | 0 |
| Switch: INP / tap → chat | 32 / 43 | 32 / 36 |

### The menu, traced

Phone at 4× CPU, 60 animals, 120 messages, four open/close cycles:

| | Before | After |
|---|---|---|
| Tasks over 50 ms | 4–5, of 54–80 ms each | **none** |
| Inside each of those tasks | ~35 ms `UpdateLayoutTree` over 4,062–4,280 elements | — |

### Explore and Collection

Fixtures:
- **Explore.** 64 real public feed posts, saved from the live, signed-out `/api/app/discover`.
- **Collection.** The full catalog of about 2,600 animals, 600 of them caught.

No change in either was needed; both were measured on both builds:

| Phone, 4× CPU | Before | After |
|---|---|---|
| Explore load: TBT / longest | 5 / 55 | 0 / 0 |
| Explore: 12 posts down and 6 back: long tasks / frames > 50 | 0 / 0 | 0 / 0 |
| Collection load: TBT / longest | 30 / 80 | 0 / 0 |
| Collection: 30 scroll steps: long tasks | 0 | 0 |
| Collection search (type "owl" + Enter, filtering ~2,600): INP | 56 | 56 |

### Reliability

The same results on both builds:

| Case | Result |
|---|---|
| Stream ends half way, with no `done` | One whole-answer retry (`mode: "complete"`) replaces it; no partial reply left. |
| `/api/ask/stream` 503 | "Something went wrong on our side." with Try again; the composer stays usable. |
| Offline send | "You're offline. We'll try again when you're back." with Try again. Back online, the next send streams. |
| Slow network (1.2 s per call, 150 ms per token) | The thinking state shows, then the reply. |
| Switching animal mid-reply and back | What arrived is kept, and no Stop is left stuck. |

## How it was measured (to repeat it)

The harness is never committed. It lives in this lane's scratchpad (`perf/`, `harness-*.patch`, `harness-keep/`):
- **Fixture auth.** A scratch-only patch to `app/layout.tsx` gives `/app` fixture auth when `ANIMALDEX_CHAT_PREVIEW=1`.
- **Fetch fixtures.** A module-level fixture replaces `window.fetch` for every `/api` before hydration and refuses anything that could reach a model.
- **Explore and Collection.** A scratch Explore patch and a `collection-preview` route feed those two pages.
- **No secrets.** The build worktree has no `.env`.
- **Scripts.**
  - `measure.cjs`: Playwright with `PerformanceObserver` long tasks, event timing, LCP and CLS, plus a rAF frame recorder. CPU is throttled through CDP.
  - `reliability.cjs` and `pages.cjs`: the reliability cases and the Explore/Collection runs.
  - `trace-menu.cjs`: a Chrome trace of the menu.

The machine's load average was about 380 that night (other sessions' Android, iOS and web builds). That is why runs alternate between the builds, and why each number is a median.

## Left for later

- **Background prefetching.** `AppShell` prefetches 11 routes on every pathname change, and each prefetch of a dynamic `/app` route runs the `(authenticated)` layout's reads on the server. That is load on the 2 GB VM, not jank in the browser. Worth trimming to the four places in the menu.
- **Very long threads.** With threads well past 120 messages, `content-visibility: auto` on rows would make page-wide style passes (focus and menu changes) scale with the visible rows only. It wasn't needed at 120 messages.
- **The dialog without `inert`.** If the owner prefers it, a focus trap inside the slide-over would drop the remaining whole-page style pass on menu open and close. Since #11 it no longer forms a long task.

## Addendum, 2026-11-07

### The loop, as a hotfix for live
- **Branch.** `hotfix/companions-refetch-loop` is 19e1929d on top of live 8042cea8: the loop fix plus `src/lib/companions-chat-subject.test.ts`. The test fails on the old shape.
- **Checks.** `tsc` clean, 1,565/1,565 tests passing, `next build` green.
- **Measured.** With the chat open and 10 s idle:
  - instant fixtures: 8042cea8 made 21,438 requests (2,144/s); the hotfix made 0 (15 at open);
  - 120 ms per request: 8042cea8 made 432; the hotfix made 0.
- **On main.** The same test is ee84aeb3.

### The remembered animal
Commit bcef1436, found by the bug hunt.
- **The bug.** The chat read the browser's remembered switch in an effect after its first draw. In the same pass it pinned the first pick, which is always the newest animal, and wrote that over the memory. So the web never reopened the animal you had switched to last.
- **The fix.** The memory is now read for the first draw, which is safe because the chat is client-only.
- **Measured.** With an older animal remembered, it opens with one thread mount.

### The chat's first mount on the newest main
After rebasing onto 50b1f3cc, which brought other lanes' Debates v2 and inline reply controls, the chat's first draw is one task of about 75–90 ms on a phone at 4× CPU. Before that rebase it was under 50 ms. Two changes were tried and measured:

| Tried | Load long task | Chat ready |
|---|---|---|
| Mounting the chat at transition priority (`useDeferredValue`) | none | ~600 ms → ~1,150 ms |
| A first batch of 12 messages instead of 24 | 65–78 ms (no change) | no change |

The transition was the wrong trade for "instant": the roster's other reads kept restarting the render. Neither change was kept.

The next thing to look at is what the conversation now draws at first mount that it didn't before.
