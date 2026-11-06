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
- Batch 5 ("top 100 dice games") assessed as NOT BGG data: scores invented, citations unverifiable, many entries use special dice, are card games/RPGs, are heavy board games, or are unverified. Not used. User may still paste real BGG ranks/weights.
- Proposed shortlist (pending user approval): Yacht, Generala, Balut, Poker Dice, Ship Captain & Crew, Going to Boston, Cee-Lo, Mexico, Farkle, Pig, Liar's Dice, Shut the Box, Chicago, Beetle, Craps, Sic Bo, Chuck-a-Luck, Backgammon, Ludo, one original Qwixx-style roll-and-write. Backups: Macao, Zanzibar, Threes, Hazard. Skipped: Bunco (needs ~12 players), Tenzi (real-time/physical). Use public-domain names; avoid Yahtzee, Qwixx, Can't Stop, Kismet branding. All must work solo (high-score chase) for flight use.

### Planner 3 — Tech stack / persistence
Source suggested: vanilla JS ES modules + Tailwind, CSS Grid/Flexbox, localStorage (high scores, favorite rules, resume an in-progress game).
Flags: ES modules fail over `file://` and some WebViews, and Tailwind via CDN needs network, which matters for offline/Play Store use. Decided (user): app is a flight companion, so offline-first, no CDNs (self-host fonts/icons/styles), lighter CSS dice (no physics 3D). Still open: single file vs. split files and how split files are served. Cache-busting rules in BUILD.md apply once files are split.

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

### Planner 5 — Liar's Dice working prototype (batch 3)
Source: batch 3, a complete single-file HTML Liar's Dice (Tailwind/FontAwesome/Google Fonts via CDN, vanilla JS, no modules). Saved unmodified at `docs/liars-dice-prototype.html` as a reference only (contains the bugs listed below; do not ship).
What it has: setup modal (vs AI bots or pass-and-play, 2-4 players, AI personality select), 5 dice per player, CSS pips with a red star for aces, bid steppers (quantity/face), Raise and Call Liar, reveal of all cups, loser drops a die, elimination until one player is left, game log, rules modal, "Odds" modal (binomial probability of the current/staged bid), pass-and-play shield screen, and a simple AI (opening bid on its most common face, call if odds under 0.35/0.22/0.12 else raise face+1).
Bugs and gaps found by reading the code (not yet reproduced in a browser):
- **Pass-and-play privacy leak:** after a bid the shield screen shows but the player cards are not re-rendered, so the previous player's dice stay visible behind it. The Odds modal also always uses player 1's hand, so it shows player 1's odds to everyone.
- **AI personality never applied:** the `ai-difficulty` select is never read, so every bot is "balanced" and the aggressive bluff branch never runs.
- **Eliminated players still get turns:** after a round ends the turn index is not moved off a player who just hit 0 dice, so an eliminated bot or the human can act with an empty hand.
- **Call Liar can be clicked twice:** human controls stay live during the 3.5 s reveal delay, so a second click or a bid during the reveal can double-penalize or corrupt state. After game over the controls also stay live (Call Liar with no bid throws).
- **Stale timers on restart:** AI turn and round-reset timeouts are never cancelled, so restarting mid-game can fire old actions in the new game.
- **Turn highlight stale on AI turns:** cards are only re-rendered on human turns.
- **Rule differences:** bidding aces makes 1s non-wild for the rest of the round (sticky), aces are the lowest face rather than a special higher rank, and the caller (not the loser) starts the next round. Decide the variant and expose as house-rule toggles.
- **AI weaknesses:** same as Planner 4 (raises face+1 blindly, never bids aces, ignores own wild 1s on the opening bid).
- **IP:** bot names "Barbossa", "Davy Jones", "Will Turner" come from Pirates of the Caribbean; replace with original names before any release.
- **Rules text typo:** "or the 2 face value". **Network:** CDN dependencies mean it needs internet (see Planner 3); Tailwind's CDN build is not meant for production. `user-scalable=no` hurts accessibility.
Decision (user): start Liar's Dice from scratch on the shared engine; the prototype's look (felt-green table, gold accents, CSS pips with red-star aces, card-per-player layout) is a starting point for the UI, and the user wants the new UI to be better than this one. Still open: what "better" means (see next UI discussion).

### Planner 6 — Product direction and AI "human-ish" design (discussion, not yet specced)
Product: Diceverse is a **companion for flights**: offline, digital CSS dice, vs-bots as the primary mode, pass-and-play secondary, portrait one-handed, short sessions with autosave/resume. User will fetch BGG data (ranks, ratings, weight) themselves; game list (Planner 2) to be rebuilt from it. Use public-domain game names (Yacht, not Yahtzee; avoid Qwixx, Can't Stop, LCR names/art).
Proposed architecture: dice table component (roll/hold/cup/animation), rules module per game (setup, legalActions, apply, score, isOver; pure functions), reusable UI panels (category sheet, running total, toggle tiles, bid panel), players/turn manager (human, pass-and-play, bot), shell (menu, house rules, stats, saves).
Proposed AI design:
- **No cheating:** bots only receive an observation (own hidden info plus public info); engine rolls all dice; tests make hidden fields throw; optional post-game "what the bot knew" log.
- **Generic brain:** determinized Monte Carlo (sample plausible hidden info, play out, pick best); difficulty = simulation count; per-game code limited to the rules module plus game-specific heuristics.
- **Bluff layer for hidden-info games:** simulation alone cannot bluff. Honest, semi-bluff and deliberate-bluff bids; treats opponent bids as evidence; per-opponent honesty record with decay.
- **Two dials:** skill (sim count + move noise via weighted-random choice) and personality (risk, bluff rate, patience, call threshold, tilt).
- **Human feel:** thinking time scales with decision closeness, visible tells, event-based banter, original named characters. No rubber-band difficulty.
Open: exact game list; UI approach/WOW features to commit to; phone CPU budget for simulations.

## Build Log 1 (completed)

Project scaffolding: adopted the Build Workflow from the Startpage project.

- [x] Added `BUILD.md` containing the full build workflow, unmodified.
- [x] Added standing rule, AI-ownership instruction, and Build Queue / Build Planner / Build Log sections to `README.md`.
- [x] Cache-busting section retained in `BUILD.md` because the app is expected to split into separate JS/CSS files.

Verification: docs only, no code. Confirmed file contents by re-reading them.

## Build Log 2 (completed)

Saved the batch 3 prototype as a reference file.

- [x] Added `docs/liars-dice-prototype.html`, a verbatim copy of the supplied Liar's Dice prototype (not linked from any page, not part of the app).
- [x] Updated Planner 5: noted the file location and recorded the decision to rebuild from scratch on the shared engine.

Verification: docs only, no code changes. Confirmed the file was written and committed.
