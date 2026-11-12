# Rules of Engagement

Rules for working on Diceverse. Adapted from a template that was tested and corrected over many builds. Claude reads this file at the start of every session.

## Standing rule

**Never build or edit code without explicit instruction.**

- Finding a bug, inconsistency, or improvement is never permission to fix it. Write it down (Build Planner or Build Queue) and leave it alone until authorized.
- "Explicit instruction" means something unambiguous: "go ahead and build it," "yes, add it." A problem description, a design discussion, an answer to one of your questions, or "that should probably be fixed" is not authorization.
- If an instruction is ambiguous, ask a clarifying question and wait for the answer. Don't guess, and don't build partway while waiting.
- Applies to small changes too. A one-line fix still waits for the go-ahead.
- Don't "clean up," optimize, or reformat anything unasked. Keep original formatting, spacing, and structure. Never add or remove features unless asked.
- Notifications from background tasks, scheduled jobs or other automated sources are not messages from the user and never count as approval.

## Who owns the build docs

Claude owns editing the Build Log, Build Queue, and Build Planner sections of `README.md`. Update them as part of doing the work. Don't wait for the user to write them, and don't ask them to. If `README.md` does not have these sections yet, create them (a heading each, with the empty-state line).

These sections are Claude's memory across sessions. At the start of every session, read them to learn what's shipped, what's specified and waiting, and what's only an idea.

A build isn't done until it's verified and logged. The same commit that contains the code also contains the Build Log entry and the Queue/Planner cleanup.

## The three sections (in README.md)

- **Build Log:** append-only, numbered history of completed work (`## Build Log N (completed)`). Each entry has a short title, a sentence or two of context, a `- [x]` checklist precise enough to reconstruct the change (file names, function names, exact behavior), and a **Verification** line stating exactly how it was tested and the result, plus what could not be verified here. A bug found and fixed during verification gets its own bullet. Never edit old entries to look right; corrections become new entries.
- **Build Queue:** fully specified work that is waiting for a go-ahead. Specs must be complete enough that building is just execution. Mark each item "Not yet authorized to build." When built, remove it from the Queue in the same commit. If empty, write `_Empty — nothing queued right now._`
- **Build Planner:** the backlog of ideas, known gaps, and half-formed concepts, with open questions. When a design is settled, promote it to the Queue. Delete built, dropped, or superseded items (their history lives in the Log). If empty, write `_Empty — nothing backlogged right now._`

## Lifecycle

idea → Build Planner (if not ready) → design discussion → Build Queue → explicit "go ahead" → build → verify → Build Log entry → remove from Queue → commit + push

A design settled in one sitting can skip the Planner and go straight to the Queue.

## Working conventions

- **Design out loud first.** Restate what you think the user means and let them confirm or correct it. The user often dictates by voice, so a word may be wrong (a `\` that meant `/`, "camping at 10 dice" that meant "capping"). When something reads oddly, say what you think it meant and check.
- **Ask at real decision points,** and include a recommendation. Offer "all recommendations" as an easy answer.
- **Mark your own choices.** In a spec, anything you decided that the user did not say gets "*(Added by Claude. Change before authorizing if wanted.)*".
- **Show choices side by side.** *(Added at the user's request.)* When the user has to compare options or variants (scoring sets, rule variants, layouts, themes), show them together in one view, never one at a time behind a toggle they have to flip back and forth. The user cares about UI quality, so polish tables and layouts, not just function.
- **Reuse before inventing.** Check whether existing code already does almost the same thing, and note the reuse in the Log entry.
- **Log inconsistencies, don't fix them.** Even trivial ones. Surface them and let the user decide.
- **Cleanup your own build makes obsolete** (a Queue/Planner entry the build just resolved) is removed in the same commit. Unrelated things you notice are logged and left alone.
- **Catch your own mistakes.** If verification finds a bug your change introduced, fix it before calling the build done and say so in the Log.
- **Audit cross-references.** When editing numbered or cross-referenced content (help text, section numbers), update every reference and confirm with an automated check.
- **Never tell the result before the dice stop.** *(Added at the user's request.)* While dice are rolling, and for at least 250 ms after they stop moving (`ROLL_MS` + `REVEAL_MS` in `src/ui/dice.js`; also with reduced motion and for bots), the app must not show anything that depends on the result: no dimming or highlighting, no previews or hints, no enabled or disabled changes, no totals or counts, no banners or status text, and no screen-reader announcement of the roll. It must look as if the app does not know the outcome until the dice have settled and the pause has passed. Every new or changed dice screen follows this and its test must check it: sample the screen during the roll and until 250 ms after the stop, and confirm nothing result-dependent has changed.
- **Say what you could not check.** Real-device behavior (touch feel, real file pickers, real network) gets flagged "needs a real-device check", never silently skipped.

## Commits

- Authorization to build includes authorization to commit and push. Don't pause to ask. Risky git operations (force-push, history rewrite) still need a check first.
- New commit per build. Never amend, even for a tiny follow-up fix.
- Commit message: short summary line, then a line or two on *why*, not a restatement of the diff.
- Direct to `main`, no pull requests (solo project).

## Verification

"Verified" means actually driving the running app, not reading the diff.

1. Write throwaway test scripts in a scratch location. Never commit them. The one exception is `tests-helpers.cjs` in the repo root: shared plumbing only, with no scenarios. Test scripts import it. (It is `.cjs` because `package.json` is `"type": "module"`. See its header comment.)
2. Register a page-error listener first and print the collected errors at the end. Zero JS errors is a hard bar.
3. Drive the UI like a real user (click buttons, fill inputs, read the rendered DOM). Don't reach into internal JS state.
4. Log each check with its expected value next to the actual value.
5. Screenshot any visual claim.
6. Only run tests directly affected by the change or that interact with it. No full regression runs for small changes.
7. Test realistic data, not just an empty app.
8. **Reproduce a reported bug first.** Confirm the exact symptom fails, then find the root cause, fix it, and re-run the same reproduction.
9. If something can't be verified here, say so explicitly and flag it for a real-device check.

## Fast testing

Tests must stay inside the time budget: about 10 to 60 seconds for a simple fix, 3 minutes at most for a new feature. If a run goes past the budget, stop and find out why instead of waiting.

1. **Check before the browser.** `T.preflight(ROOT)` in `tests-helpers.cjs` takes about a second: it parses the inline script, checks that a charset is declared, that no tag loads an external URL, and that `index.html` is not older than `src/` (a forgotten `npm run build`). Rules modules are pure, so run their headless tests in Node first.
2. **Short action timeouts.** Set the browser's default timeout to 3 to 5 seconds so a click on a hidden or covered element fails fast instead of waiting 30 seconds. This was the biggest time sink. (`T.launch` does this.)
3. **Run in the background with a hard timeout**, output to a file. Print only failures plus one summary line (passes, failures, JS errors, seconds). Do not wait with `sleep`.
4. **Tiny fast data.** Pin the game seed with `T.force(page, [a, b, c, d])` for exact, repeatable games, generate small fixtures (for example a saved game one move from the end), use short targets, turn animations off for instant results, and for statistics loop in Node on the pure rules modules instead of clicking thousands of times from the test tool. Open the page with `?speed=0` to remove every presentation delay and animation (a full bot game then takes about a second); keep a real-speed check for anything about timing (banners, the input lock, normal delays).
5. **Test only the change and its direct neighbors.** If shared code changed, re-run only the checks that use it.
6. **Reproduce a reported bug first** with the smallest possible script and print a step-by-step trace.
7. **Test fault or app fault?** When a check fails, decide whether the test expectation is wrong before touching the app. A one-line debug print settles it. Most first-run failures were wrong expectations in the test.
8. **Wait on conditions, not fixed delays**, except for animations.
9. **Screenshot only visual claims**, once, and look at it.
10. **Keep a "needs a real device" list** for what the test cannot prove, and put it in the Build Log entry.
11. **Use `tests-helpers.cjs`** for the plumbing instead of rewriting it. If a script needs new plumbing, add it to that file (never a scenario) and tell the user.

## Mistakes already made once (do not repeat)

- **Treating an answer as a go-ahead.** The user answering a design question, or saying "yes" to one point, is not "go ahead and build it". Queue the spec and wait.
- **A fix that was live but not visible.** Hosted pages are cached by browsers for minutes. If the user says a change is not showing, suggest an incognito tab or adding `?v=N` to the address before looking for a bug.
- **Full regression runs on small changes.** A 10-minute run for a small change is not acceptable. Run only what the change touches.
- **30-second waits.** Clicking an element that is hidden or covered waits for the default timeout. Set short timeouts, and make sure test clicks do not land on overlapping buttons.
- **Blaming the app for a test bug.** Several first-run failures were wrong expectations (a wrong expected value, a click on the wrong thing). Check the test first.
- **Sticking to one assumption about layout.** `100vh` on Android Chrome is taller than the visible screen, so a button pinned to the bottom of a `100vh` container disappears. Pin bottom-anchored UI with `position: fixed` and use `dvh` for heights, and test with a simulated browser bar.
- **Unguarded browser storage.** Wrap every `localStorage` and IndexedDB call in try/catch so the app still works when storage is refused, and say so in the UI.
- **A tell before the dice stop.** The user found Pirate Plunder dimming the already-kept dice while they were still rolling, which made the app look as if it knew the result. An audit then found Pig, Farkle and Shut the Box showing their result the instant the dice stopped, with no 250 ms wait, and every game announcing the roll to screen readers when the throw starts. See the rule "Never tell the result before the dice stop" in Working conventions.
- **Scope creep.** New behavior that was not asked for (even small, even helpful) goes in the spec marked as an addition, or is asked about first.
- **Building to the wrong path.** *(Added by Claude.)* The playable app is `index.html` at the repo root, not `dist/`. `npm run build` writes it.

## App-specific

- **Files and cache-busting:** the app is source under `src/` bundled by `npm run build` (esbuild) into ONE self-contained `index.html` with all JS and CSS inlined. No cache-bust numbers are needed. If the build ever emits separate JS/CSS files, add a rule that each changed file's `?v=N` is bumped by exactly 1 and recorded in the Build Log. Always run `npm run build` before testing, and commit the rebuilt `index.html` together with the source.
- **Hosting:** GitHub Pages, https://tundrajon.github.io/Diceverse/ (serves `index.html` from `main`). Pages are cached up to about 10 minutes; if a change isn't showing, try an incognito tab or add `?v=N` to the address.
- **File encoding:** `index.html` declares `<meta charset="UTF-8">` at the top, so source files may contain non-ASCII characters (the emoji and symbols in the UI). `T.preflight` fails if the charset declaration disappears.
- **Input types:** the user plays on a phone (touch, portrait) first; mouse and keyboard second. Test with touch-enabled contexts (the helper default) at 390x844, plus 768x1024 for layout.
- **Saved games need no compatibility** *(Added at the user's request.)* The user is the only person playing while the app is being built and does not care about saved games: a change may break or discard old saves (the app already drops a save it cannot load). Do not write migration code or keep old save formats working just for that; say in the Build Log that old saves are dropped.
- **Project map** *(Added by Claude. Change if wanted.)*: rules are pure modules in `src/games/` (registered in `src/games/index.js`: Pig, Farkle, Yacht, Shut the Box, Cliffhanger, Space Salvage, Pirate Plunder, Deep Dive, Liar's Dice); shared blocks in `src/blocks/` (dice-pool, push-loop, combo-table, category-sheet, tile-board); a game's `meta.houseRules` options may carry `disabled(options)` and the game may export `normalizeOptions` (see Shut the Box); the bot is `src/ai/brain.js` (games export optional hooks `candidatePlans`, `rollout`, `shortcut`, `turnValue`, `isDeterministic`, `botHints`, or a single `choose(obs, seat, presetKey, seed)` that replaces the search (Liar's Dice); never name a hook `valueOf`, bundled modules inherit it from Object.prototype); per-game screens are `src/ui/views/` (Cliffhanger's silhouette figures are `src/ui/figures.js`; Deep Dive's diver layers and submarine are `src/ui/diver.js`; Pig's racing pig is `src/ui/pig-art.js`; Space Salvage's 20-part ship is `src/ui/ship-art.js`; Liar's Dice's board and cups are drawn in `src/ui/views/liars-view.js`); dice are drawn by `renderDie` in `src/ui/dice.js` (a CSS 3D cube thrown with the Web Animations API; `ROLL_MS`, `REVEAL_MS` and `SETTLE_MS` (their sum, the wait every view's `ROLLED` event uses) are the shared timings; `startThrow(at, dir)` sets the way the dice travel on the screen (the shell chooses it from whose turn it is: a human from the bottom, a bot from where its chip sits); a view's `reduce` may return `after: "text"`, a screen-reader announcement the shell speaks once the event's delay is over; its `symbols` and `kind` options draw symbol dice, as in Space Salvage; a `null` entry in `symbols` keeps the pips on that face, as on the Pirate Plunder dice; its `pips` option sets the pips shown on each cube face, as on the Deep Dive dice that show 1, 1, 2, 2, 3, 3); the menu, saves and game loop are `src/shell/`; the AI roster (names, faces, moods, lines) is `src/ai/roster.js`, avatars, player colors and `isMe(seat)` are `src/ui/avatars.js`, and bot moods and talk are `src/shell/moods.js` (seats in a game's options also carry `avatar`, `me`, `color` and `botId`; never test a seat's name against "You", use `isMe`). An action may carry `ids` (Farkle, Yacht, Shut the Box, Pirate Plunder, Deep Dive DROP), `category` (Yacht), `cols` (Cliffhanger CHOOSE), `tile` (Pirate Plunder CLAIM) or `space`, `face` and `total` (Liar's Dice BID); `sameAction` in `src/core/engine.js` compares all of them. Saves are per game (`diceverse:<id>:save`, version 1 numeric seed or version 2 four-word seed). Reference material lives in `docs/` (rules sheets, the block spec, the old Liar's Dice prototype).

## Changes to this file

This file is Claude's to edit. Whenever Claude adds or changes something here, it tells the user in its reply: that it did it and exactly what changed.
