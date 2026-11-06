# Diceverse
Ultimate dice game companion game

> **Never build or edit code without explicit instruction.**
> Finding a bug or having an idea is not permission to act on it. Write it down (Build Queue / Build Planner) and wait for a go-ahead. Ambiguous instruction = ask first.

> You own editing the Build Log, Build Queue, and Build Planner sections of this file as part of doing the work. Update them yourself, as you go — don't wait for me to write them, and don't ask me to.

Full workflow (lifecycle, cache-busting, commit discipline, Playwright verification): see [BUILD.md](BUILD.md). Read it before starting work.

## Build Queue

_Empty — nothing queued right now._

## Build Planner

Resolved, built, dropped, or superseded items are deleted from here. History lives in the Build Log.

### Planner 1 — Universal engine + game-definition architecture
Source: batch 1 of notes. One shared dice/scoring engine; each game is a small config/script plugged in. Proposed layers:
- **DiceEngine** — dice count, sides (d6, d20...), held/locked dice, values, roll animation.
- **Scorecard engine** — generic templates: category-based (Yahtzee, Balut, Generala), accumulation/bust (Farkle, Pig), toggle/board (Shut the Box).
- **Game configs** — plain objects (name, diceCount, maxRounds, categories, scoreCalculator).
Open questions: single-file HTML vs. multiple files (see Planner 3); which scorecard buckets cover games outside the three above (Liar's Dice, Beetle, Cee-Lo, Craps).

### Planner 2 — Candidate game list (20)
Yahtzee, Farkle, Pig, Shut the Box, Perudo/Liar's Dice, Left Center Right, Ship Captain & Crew, Bunco, Generala, KnuckleDice, Chicago, Threes, Twenty-One, Hazard, Beetle, Cee-Lo, Buck Dice, Mexico, Going to Boston, Craps (simplified).
Flags to resolve before any of these are specced:
- Rules for KnuckleDice, Buck Dice, and Twenty-One are vague/unclear as listed; need exact rule sets (or replace them).
- Hazard and Craps overlap heavily; may merge or keep one.
- Liar's Dice needs simulated opponents (AI) or pass-and-play multiplayer; different effort from the solo/score games.
- Liar's Dice (batch 1 follow-up): same game as Perudo/Dudo. Rules noted: 5 dice per player in a cup, hidden rolls; bid = quantity of a face across all cups; each bid must raise quantity or face; ones are wild; calling "Liar" reveals all cups, loser of the challenge loses a die. Pass-and-play on one phone (private peek, then hand off) fits. Basic AI = probability from own hand + total dice in play. Open: exact rules for bids on ones and wild handling (varies by variant), expose as house-rule toggles; bluffing behavior for AI; pirate theming must be generic (no Pirates of the Caribbean / Disney branding).
- Chicago description in the notes is thin; confirm the exact ruleset.
- Need to decide which games are solo, pass-and-play, or vs. computer.

### Planner 3 — Tech stack / persistence
Source suggested: vanilla JS ES modules + Tailwind, CSS Grid/Flexbox, localStorage (high scores, favorite rules, resume an in-progress game).
Flags: ES modules fail over `file://` and some WebViews, and Tailwind via CDN needs network, which matters for offline/Play Store use. Open: serve over http only, bundle later, or use plain CSS. Cache-busting rules in BUILD.md apply once files are split.

### Planner 4 — AI player system (batch 2)
Source: batch 2 notes. Idea: one AI controller, three reusable strategies instead of 20 separate bots; works with pass-and-play so a phone can mix humans and bots.
- **Probability/bluff strategy** (Liar's Dice): binomial odds that a bid is true given own hand + total dice in play (p = 1/3 per unknown die for non-ace faces with wild ones, 1/6 for aces or no wilds). Call "Liar" if odds < threshold by personality (cautious 0.35, balanced 0.25, aggressive 0.15).
- **Expected-value strategy** (Yahtzee, Generala, Going to Boston-style hold games): simulate every hold mask (32 for 5 dice), Monte Carlo ~100 rolls each, pick best average score over open categories.
- **Risk/push-your-luck strategy** (Farkle, Pig): bank vs keep rolling using bust probability by dice remaining (Farkle 1-6 dice ≈ 66/44/28/15/8/2%) and a turn-points threshold.
- **Controller:** dispatcher by game type with a 700-1500 ms fake "thinking" delay so bots feel natural.
- Notes proposed each game config exposes `getPossibleActions(gameState, playerIndex)` and `evaluateAction(action, gameState, strategy)`.
Known problems in the supplied draft code (fix when specced, do not copy as-is):
- Pig is broken: it has no `diceRemaining`, so bust risk defaults to 0.5 and the bot never banks. Pig is 1 die, 1/6 bust; classic strategy is hold around 20.
- Liar's Dice raise logic always raises face+1 without checking whether the raise is plausible (never calls when it should), never bids aces, never bluffs on purpose, and the opening bid uses the first die in hand rather than the best face.
- EV hold logic ignores rolls left (doc mentions `rollsLeft`, code never uses it), is greedy (max score now, no category opportunity cost or bonus awareness), is noisy at 100 sims (ties flip), hard-codes 5 dice, and crashes to -Infinity if no categories are open. Yahtzee AI also never chooses the category to score.
- Farkle: no hot-dice handling, no minimum-bank rule, ignores opponent scores; threshold is a rough heuristic.
- Controller returns three different result shapes (object, boolean mask, boolean), switch is hard-coded per game (conflicts with the plug-in config idea; needs a registry), the `getPossibleActions`/`evaluateAction` interface is described but not used, and the `setTimeout` has no cancel, so a quit or reset mid-turn fires on stale state. File/class names are also mismatched (AIPicker.js vs AIController).
- "Three strategies cover all 20 games" does not hold: Shut the Box needs subset-selection search; Beetle, Cee-Lo, LCR, Craps, Bunco have little or no decision-making (bot just rolls), so those need no AI.
Open: which games get bots in v1; difficulty levels beyond personality; ES module/file:// issue from Planner 3 applies here too.

## Build Log 1 (completed)

Project scaffolding: adopted the Build Workflow from the Startpage project.

- [x] Added `BUILD.md` containing the full build workflow, unmodified.
- [x] Added standing rule, AI-ownership instruction, and Build Queue / Build Planner / Build Log sections to `README.md`.
- [x] Cache-busting section retained in `BUILD.md` because the app is expected to split into separate JS/CSS files.

Verification: docs only, no code. Confirmed file contents by re-reading them.
