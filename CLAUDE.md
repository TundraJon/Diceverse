# Diceverse rules (temporary.md)

## Replies
- Max 200 words. ASD-STE100. Short sentences. Explain big words.
- Say: done, worked?, user's next step.
- Decisions: 2 options max, context, my pick.

## Standing rule
- No build or code edit without "go ahead and build it" / "yes, add it".
- Answers, design talk, "should be fixed", notifications: not permission.
- Unclear? Ask, wait, build nothing.
- Bugs and ideas go in Planner/Queue. No fixes, clean-ups, reformatting, or feature changes unasked.

## README build docs (mine)
- Build Log (append-only, numbered), Build Queue (full specs, "Not yet authorized"), Build Planner (ideas).
- Flow: idea > Planner > design > Queue > "go ahead" > build > verify > Log > clear Queue > commit + push.
- Log entry: title, `- [x]` checklist (files, functions), Verification line, "needs a real-device check" list.
- My own spec choices: *(Added by Claude. Change before authorizing if wanted.)*
- Old Log entries never change. Corrections are new entries.

## Working rules
- User dictates by voice. Odd word? Say what I think it meant, check.
- Options go side by side in one polished view.
- Log inconsistencies, don't fix.
- Dice: nothing result-dependent (dimming, totals, banners, screen-reader text) until 250 ms after stop (`ROLL_MS` + `REVEAL_MS`, `src/ui/dice.js`). Test it.
- Text 12 px minimum, in `rem`. Check 390x844, 360x740, 320x640 at all 3 text sizes.
- Old saves may break. Note it in the Log.

## Commits
- "Go ahead" covers commit + push. Straight to `main`, no PRs, no amend, one commit per build.
- Message: summary line, then why.
- Trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_011v4A5NmtWUJioYkDSRaSR2`
- Two commands: commit, then `git push origin HEAD:main`.

## Verification
- Drive the real app. Scratch tests never committed. Helpers: `tests-helpers.cjs`.
- 0 JS errors. Expected vs actual. Screenshot visual claims.
- Test only what changed. Budget 10-60 s fix, 3 min feature.
- `?speed=0`, 3-5 s timeouts, background run, no `sleep`.
- Bug report: reproduce first, then fix, re-run.
- Check calls the test wrong first.

## App facts
- `npm run build` makes `index.html` (root) and `sw.js`. Build before testing. Commit both.
- Cache not showing? Incognito or `?v=N`.
- Wrap `localStorage`/IndexedDB in try/catch.
- Bottom UI: `position: fixed`, `dvh`, not `100vh`.
- Use `isMe(seat)`, never the name "You". No hook named `valueOf`.
- Phone portrait first (390x844), then 768x1024.
- Code map: `src/games/index.js`, `src/ui/views/index.js`, `src/shell/`.

## Past mistakes
- Answer taken as go-ahead.
- Full regression runs for small changes.
- Waiting 30 s on hidden buttons.
- Blaming the app for a test bug.
- A tell before dice stop.
- Scope creep.
- Building to `dist/`. App is root `index.html`.
