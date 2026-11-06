# Diceverse
Ultimate dice game companion game

> **Never build or edit code without explicit instruction.**
> Finding a bug or having an idea is not permission to act on it. Write it down (Build Queue / Build Planner) and wait for a go-ahead. Ambiguous instruction = ask first.

> You own editing the Build Log, Build Queue, and Build Planner sections of this file as part of doing the work. Update them yourself, as you go — don't wait for me to write them, and don't ask me to.

Rules of engagement (standing rule, lifecycle, commit discipline, verification and fast-testing rules): see [CLAUDE.md](CLAUDE.md). Read it before starting work.

## How to build and run

- Needs Node 18+ and npm. `npm install` once, then `npm run build`.
- Output: `index.html` at the repo root, a single self-contained file (JS and CSS inlined, no network requests). Open it directly in a browser, no server needed; it works offline.
- Source is modular under `src/` (`core`, `blocks`, `games`, `ai`, `ui`, `shell`). Rules modules are pure and run in Node without a browser, so bots and tests can use them directly.
- Test scripts are throwaway and are not committed (see CLAUDE.md); the shared plumbing for them is `tests-helpers.cjs`.

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
Flags: ES modules fail over `file://` and some WebViews, and Tailwind via CDN needs network, which matters for offline/Play Store use. Decided (user): app is a flight companion, so offline-first, no CDNs (self-host fonts/icons/styles), lighter CSS dice (no physics 3D). Decided (user): develop as modules and ship a single bundled offline HTML file (see Queue 1). Open: whether sound/fonts/assets ever get hosted separately. Cache-busting rules in BUILD.md apply once files are split.

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

### Planner 7 — Mechanic blocks / game-as-recipe analysis (awaiting matrix from user)
Decision (user): game count is flexible (more or fewer than 20). Games that are rule-bends of others should be added as variants when cheap.
Idea: games are recipes over shared mechanic blocks, not separate modules. Candidate blocks: roll modes (roll all / reroll held up to N / set aside scorers and roll rest), gate (required combo before scoring), bust (face or result that wipes the turn), bank-or-stop, scoring (category sheet / ranked hand / sum / target-face count), end condition (race to total / fixed rounds / elimination), compare (high/low/payout table), special engines (hidden-info bidding, toggle tiles, board movement).
Rough mappings (unverified): Pig = 1 die + bust on 1 + bank + race; Farkle = 6 dice + set-aside + bust on no-score + bank; Yacht/Generala/Balut = 5 dice + 3 rolls + hold + category sheet (likely one module, different category lists); Poker Dice = same shape with ranked hand; Hog/Zilch/Macao likely near-free variants.
Requested from user's source: matrix, one row per candidate game: dice count/sides, roll and reroll rules, gate, bust, scoring type, end condition, player count/solo viability, hidden info, bot decision depth, known house-rule variants, parent game it varies, BGG rank/rating/weight. Then: find overlaps, define blocks, write the block spec.
Update: BGG data gathered (Planners 8-9); first draft of the block spec is in `docs/block-spec.md` (engine contract, blocks, 10 v1 recipes, overlap matrix, UI panels, bots, testing, open questions). Yacht (three rule sets) is built, see Build Log 13; Generala and Balut remain possible later rule sets. Slice 1 (core + dice pool + push loop + Pig) is built, see Build Log 4; Farkle and the multi-game shell are built, see Build Log 7. Decided (user): bundled single-file delivery, curated house rules (3-5 per game), first slice = core + dice pool + Pig (now Queue 1). The rules-verification pass is still required before each later game is queued.

### Planner 8 — Real BGG data, page 1 of 5 (Dice Rolling mechanic, sorted by Geek Rating)
Source: user paste of BGG browse page 1 (about 100 rows, includes expansions with N/A rank). Format: BGG rank, Geek rating, avg rating, voters. Only rows relevant to Diceverse are kept here; the rest are heavy/miniatures/worker-placement board games (Castles of Burgundy, Too Many Bones, Oathsworn, Troyes, Kingsburg, etc.) and are out of scope.
- Liar's Dice #873, 6.729 / 6.93 / 17,220 | Can't Stop #767, 6.796 / 6.95 / 22,365 | Deep Sea Adventure #957, 6.681 / 6.86 / 21,522
- King of Tokyo #512, 7.003 / 7.11 / 76,822 (most voters on the page) | BANG! The Dice Game #899, 6.712 / 6.87 / 26,772 | Dice Throne (various)
- Las Vegas #632, 6.895 / 7.18 / 12,646 | Las Vegas Royale #940 | Camel Up 2nd ed. #269, 7.246 / 7.53 / 18,768 | Long Shot: The Dice Game #379, 7.117 / 7.50 / 10,886
- Roll-and-write / sheet: That's Pretty Clever #205, 7.358 / 7.55 / 28,629 | Twice as Clever #481, 7.029 / 7.41 | Clever Cubed #883 | Railroad Ink (Deep Blue #643, Blazing Red #975, Lush Green #800) | Dinosaur Island: Rawr 'n Write #634 | Fleet: The Dice Game #669
- Drafting/placement puzzles: Sagrada #229, 7.325 / 7.47 / 49,168 | Spots #886 | Draftosaurus #687 | Pulsar 2849 #319 | Roll Player #310
- Other: Macao #571 (the board game, not the pub game), Yspahan #956, Pandemic: The Cure #628, Sky Team #32 (co-op, 35,665 voters), Space Base #231, Tiny Epic Galaxies #406.
Observations: classics (Yacht/Yahtzee, Farkle, Pig, Shut the Box) are absent from this page; remaining pages 2-5 may hold them. Geek Rating is Bayesian-weighted and favors heavy games, so for an app, sorting by voters and filtering by low weight and solo is more useful. Repeating mechanic families on page 1: roll-and-write (Clever, Railroad Ink), push-your-luck (Can't Stop, Deep Sea Adventure), betting/racing (Camel Up, Long Shot), casino dice placement (Las Vegas), dueling/elimination with a Yacht-like reroll engine (King of Tokyo, BANG!, Dice Throne), co-op (Sky Team, Pandemic Cure), bluffing (Liar's Dice).
Candidate "bend" games (original names/art; mechanics only): monster-arena brawl on the hold/reroll block, casino dice placement vs bots, camel/horse-style betting race, shared-oxygen push-your-luck dive, Can't Stop-style column climb, Clever-style roll-and-write sheet, route-drawing puzzle (Railroad Ink style).
Page 2 (BGG ranks ~977-1755; the list is ~50 pages long, so the classics rank far deeper): relevant rows, format rank, geek / avg / voters:
- Roll-and-write: Qwixx #997, 6.661 / 6.88 / 15,941 | Qwinto #1595, 4,568 | Encore! #1370, 6,184 | Clever 4Ever #1280 | On Tour #1567, 6,064 | My City: Roll & Build #1754 | Railroad Ink Shining Yellow #1592 | Rajas of the Ganges: Dice Charmers #1132
- Push your luck: Pickomino / Heckmeck #1634, 6.392 / 6.59 / 13,230 (target-pickup Farkle cousin) | FUSE #1008 (real-time co-op, 9,337)
- Solo-capable: Roll Through the Ages: Bronze Age #1102, 6.610 / 6.84 / 12,413 (roll-and-civilize, strong solo high-score candidate) | 20 Strong #1333 (solo, 20 dice) | One Deck Dungeon #1021, 13,136 | Deep Space D-6 #1468 | Hostage Negotiator #1646
- Poker-dice with economy: Dice Town #1240, 8,277
- Brawl/arena: King of New York #1025, 17,463 | Strike #1290 | Dice Throne variants | King of Tokyo: Duel #1742
- Dice trigger cards: Machi Koro #1412, 36,377 voters (avg only 6.59)
- Classic board: Backgammon #1666, 6.380 / 6.59 / 15,546
- Dice-building: Quarriors! #1353, 14,164 (custom dice, probably skip)
New families seen: target-pickup push-your-luck (Pickomino), roll-and-civilize solo (Roll Through the Ages), dice-triggers-cards economy (Machi Koro, Dice City style).
Still missing: classics (Yacht/Yahtzee, Farkle, Pig, Shut the Box, Ship Captain & Crew, Balut, Cee-Lo, etc.) and weight/complexity. Plan: user looks up the specific titles directly on BGG instead of paging through ranks, with rank, avg rating, voters and weight.
Open: decide which families get in; IP: all named products are commercial, so build only mechanic-inspired originals.

### Planner 9 — BGG sorted by voters (page 1) and proposed tiered game set
Source: user paste, BGG dice list sorted by number of voters. Format: BGG rank, avg rating, voters.
Most relevant (simple, solo/bot-friendly) by voters: King of Tokyo 512, 7.11, 76,822 | Machi Koro 1412, 6.59, 36,377 | That's Pretty Clever 205, 7.55, 28,629 | BANG! Dice 899, 6.87, 26,772 | Elder Sign 806, 6.97, 26,463 | Can't Stop 767, 6.95, 22,365 | Deep Sea Adventure 957, 6.86, 21,522 | Zombie Dice 2821, 6.23, 19,401 | Camel Up 269, 7.53, 18,768 | Yahtzee 25236, 5.57, 18,076 | King of New York 1025, 17,463 | Liar's Dice 873, 6.93, 17,220 | Qwixx 997, 6.88, 15,941 | Backgammon 1666, 6.59, 15,546 | Railroad Ink 643, 7.14, 15,143 | Pickomino 1634, 6.59, 13,230 | One Deck Dungeon 1021, 6.94, 13,136 | Las Vegas 632, 7.18, 12,646 | Roll Through the Ages 1102, 6.84, 12,413 | Long Shot 379, 7.50, 10,886 | Twice as Clever 481, 7.41, 10,461 | Age of War 2251, 6.44, 9,600 | Boggle 3030, 6.25, 9,067 (letter dice, word game, probably out of scope) | Dungeon Roll 3961, 6.07, 8,570 | Pass the Pigs 31012, 5.51, 7,268 | Catan Dice Game 8007, 5.73, 7,237 | Dice City 1833, 6.70, 5,510 | Dragonwood 2413, 6.57, 5,474.
Takeaways: BGG skews toward hobby gamers. Classics such as Farkle, Pig and Shut the Box do not appear in the top ~100 by voters (under ~5,400 voters), and Yahtzee is high-voter but low-rated (5.57). So BGG tells us which mechanics hobbyists love, not what casual flyers play. Weight is not shown in this view; estimate unless the user fetches it.
Proposed tiered set (names must be original or public domain; all must work solo/vs bots):
- **A. Classics (casual audience):** Yacht, Farkle, Pig, Shut the Box, Liar's Dice, Backgammon, Cee-Lo/Mexico, Ship Captain & Crew, plus a Pass-the-Pigs-style asymmetric-outcome game.
- **B. BGG-proven mechanics, original versions:** Can't Stop-style climb, Deep Sea-style shared-oxygen dive, Pickomino-style target pickup, Zombie Dice-style (bag of dice with different risk), Camel Up / Long Shot-style betting race, Las Vegas-style dice placement, King of Tokyo-style brawl (hold/reroll engine + health), BANG!-style secret-role elimination vs bots, Age of War-style symbol matching.
- **C. Roll-and-write (differentiator, biggest family on BGG):** Clever-style drafting sheet, Qwixx-style shared-roll sheet, Railroad Ink-style route puzzle.
- **D. Solo adventures:** Roll Through the Ages-style civilization builder, Dungeon Roll / Elder Sign-style dungeon delve.
About 25 games. New mechanic blocks seen: dice bag with mixed-risk dice (Zombie Dice), asymmetric outcome tables (Pass the Pigs), symbol-matching to fill targets (Age of War), roll-and-write sheet engine, route-drawing puzzle, solo campaign state.
Decisions (user): tiers A-D approved. v1 is "medium" (not small, not the full 25). Proposed reading of medium, awaiting confirmation: about 10 games on 5 engines.
- Hold/reroll + category sheet: Yacht
- Push-your-luck/bank family (shares one engine): Farkle, Pig, Zombie Dice-style, Can't Stop-style, Deep Sea-style, Pickomino-style
- Bluff: Liar's Dice (needs the bluff AI layer, Planner 4/6)
- Toggle board: Shut the Box
- Roll-and-write: one Qwixx-style sheet game
Deferred to v2+: Backgammon, King of Tokyo-style brawl, betting race, Las Vegas-style, BANG!-style, Clever-style, Railroad Ink-style, solo adventures, the remaining classics.
BGG voters-sorted page 2 received (rank/avg/voters, about 2,600-5,300 voters each). No new mechanic families; tiers unchanged. Notes:
- Farkle #12205, 5.69, 3,791 | LCR #31651, 3.74 (very low), 2,680 | Cthulhu Dice #31563, 5.21, 2,871 | Pay Day #31622, 4.90 | Roll For It! #4360, 6.15, 3,419 | Martian Dice #3944, 6.15, 4,598 | Sushizock im Gockelwok #3051, 6.52, 2,798 | Ra: The Dice Game #2278, 6.79, 2,787 | To Court the King #2758, 6.46, 4,115 | Rory's Story Cubes #3873, 6.20, 4,100 | Trek 12 #2266 and Corinth #2220 (roll-and-write) | Alea Iacta Est #2635 (dice placement) | Dicey Waters #3257 | D-Day Dice #1988 (solo/co-op).
- Cheap variants on existing engines: Martian Dice = Zombie Dice-style engine; Sushizock = Pickomino-style engine.
- Candidate extras: Roll For It!-style (match dice to target cards), Ra-style (roll + auction), Cthulhu Dice-style (luck elimination), Story Cubes-style picture dice as a non-scoring creative toy.
- Low-rated pure-luck classics (Yahtzee 5.57, Farkle 5.69, LCR 3.74): keep the good ones as gateway games but do not make them the headline; LCR-style is filler at most.
BGG data gathering is now sufficient; next step is the mechanic-block spec and v1 game recipes.
Waiting on: user decision on what to design next; nothing is queued or authorized to build.

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

## Build Log 3 (completed)

Drafted the mechanic-block spec.

- [x] Added `docs/block-spec.md`: design principles, engine contract, shared action/event vocabulary, block list, recipes for the 10 medium-v1 games, overlap matrix, UI panel library, bot approach, persistence/testing plan, proposed folder layout, open questions.
- [x] Updated Planner 7 to point to the spec.

Verification: docs only, no code. Game rules in the spec are written from memory and are explicitly marked [verify]; they have not been checked against rulebooks.

## Build Log 4 (completed)

Slice 1: core engine, dice pool, push-loop block and Pig, bundled to one offline file (was Queue 1).

- [x] Tooling: `package.json` (esbuild only), `build.mjs`, `.gitignore`; `npm run build` writes `dist/diceverse.html` (24.2 KB, JS and CSS inlined, system fonts, no external requests). `dist/diceverse.html` and `package-lock.json` are committed so the file can be opened without building.
- [x] Core: `src/core/rng.js` (seeded mulberry32 + gaussian helper), `src/core/engine.js` (session wrapper with seed, action log, save and replay), `src/core/scheduler.js` (single owner of all delays, `cancelAll()` on menu/restart/game over).
- [x] Blocks: `src/blocks/dice-pool.js`, `src/blocks/push-loop.js` (shared roll/bust/bank loop with game hooks).
- [x] Game: `src/games/pig.js` with the specified house rules (target 50/100/150, one or two dice, equal turns with tie-break rounds among tied leaders); modes vs Bots, Pass and Play, Solo (fewest turns, personal best saved per target and dice mode).
- [x] Bot: `src/ai/brain.js`; sees only `observe()` output, simulates the rest of the turn with the game's own `apply`; presets Cautious, Balanced, Bold (skill = sim count + noise, risk shift); think time 700-1500 ms, longer on close calls.
- [x] UI: ScoreStrip, DiceTray (CSS pips, red pip on a 1), TurnBar, rules sheet, house rules sheet, menu with Resume, game-over sheet, event log, aria-live announcements, zoom allowed, 48 px+ controls, reduced-motion respected, optional vibration on bust.
- [x] Autosave of `{version, seed, options, actionLog}` after every action; Resume rebuilds by replay; corrupt save discarded; storage failure tolerated with an on-screen note.
- [x] Reuse: visual language from `docs/liars-dice-prototype.html` (felt green, gold, CSS pips) with no code copied. Cache-busting not applicable (single inlined file).
- [x] Deviations from Queue 1, stated plainly: the "far behind takes more risk" behavior is a small heuristic nudge on the bot's decision (opponent at 70% of target and ahead), not part of the simulation. Bot preset values were retuned after testing (first Cautious/Bold values were too extreme, see below).

Verification (scratch scripts, not committed; all re-run after the final change):
- Rules, headless: hold-at-20 over 200,000 turns averaged 8.151 points/turn (accepted 8.0-8.3). Two-dice double-1 frequency over 1,000,000 rolls was 2.762% (expected 2.778%, tolerance 0.3); single-1 27.796% (expected 27.78%). 100 random games (1-4 seats, all option combinations) all terminated, replayed to identical final state from seed + log, and satisfied the equal-turn invariants (47 equal-turn games). A hand-built tie scenario correctly produced a tie-break round among only the tied leaders.
- Bot: observation contains no seed, log, or RNG; brain imports only the RNG module; works on a deep-frozen observation. Note: Pig has no hidden information, so this fairness check is structural only; the real hidden-info test belongs to Liar's Dice. Roll probability by turn points (Balanced): 99% at 8, 79% at 14, 57% at 18, 46% at 20, 37% at 22, 20% at 26, 5% at 32; far behind with 25 turn points rolls 81%.
- Playwright against `dist/diceverse.html` via `file://`: zero external requests; zero JS errors in every scenario; full vs-Bots game to 50 finished by real clicks; Solo game finished and the best showed on the menu; Pass and Play with two dice and equal turns finished; no horizontal scroll at 390x844 and 768x1024; reload mid-game then Resume restored identical scores and active seat; Menu during a bot's thinking delay caused no stale action over 5 s (save log unchanged); a double-click on ROLL produced exactly one roll; reduced-motion removed the tumble; blocked `localStorage` still played to the end. Screenshots inspected for the menu, game screen, and two-dice bust (red pip on the 1, BUST banner).
- Bugs found during verification and fixed in this build: (1) every sheet (rules, house rules, game over) never appeared because the sheet was not attached to its backdrop, caught by the first Playwright run; (2) "You's turn" and "You wins" grammar; (3) "BUST! −0" label when no points were lost; (4) Cautious preset banked after almost any roll and Bold rolled to 50+, so presets were retuned (Cautious risk −1, Bold risk +1.2, catch-up nudge capped lower).
- Test-script bugs (not app bugs) fixed along the way: two buttons named "Menu" in one view, and a loop that kept clicking a disabled ROLL after the game had ended.
- Not verified: real-device touch and haptics (headless Chromium only); behavior in browsers other than Chromium; the resume check's second run compared an all-zero starting position (the first run compared a mid-game state with non-zero totals and also matched).

## Build Log 5 (completed)

Correction to Build Log 4: the build output is now `index.html` at the repo root, not `dist/diceverse.html`.

- [x] `build.mjs` writes `index.html` at the repo root; the `dist/` folder and `dist/diceverse.html` were removed (no duplicate copy kept).
- [x] "How to build and run" section updated to point at `index.html`. Build Log 4 is left as written (append-only history); where it says `dist/diceverse.html`, read `index.html`.
- [x] Cause: I chose the output path from the Queue 1 text instead of the repo convention that the playable app is `index.html`; the Queue entry itself named `dist/diceverse.html`, so the error was in the spec I wrote.

Verification: rebuilt (`index.html` 24.2 KB, identical content to the previous bundle) and re-ran the full Playwright suite against `file:///.../index.html` with the network blocked: all scenarios passed again, zero external requests, zero JS errors. The headless rules tests were not re-run because no source under `src/` changed.

## Build Log 6 (completed)

Stronger RNG: 128-bit seed and exactly fair dice (was Queue 2).

- [x] `src/core/rng.js`: new games use **sfc32** (four uint32 words, 12 warm-up outputs discarded); `die(sides)` uses rejection sampling; new `uint32()` on both generators. A single-number seed still selects the legacy mulberry32, kept only for old saves and the bot's throwaway simulations. `newSeed()` returns four words from `crypto.getRandomValues`; the fallback (clock + `Math.random` through splitmix32) is the only place `Math.random` appears, commented as such.
- [x] `src/core/engine.js`: `save()` writes version 2 with the four-word seed (a resumed version 1 session keeps saving as version 1); `replaySession` accepts versions 1 and 2 and rejects wrong seed shapes.
- [x] `src/shell/save.js`: `loadSave` validates version and seed shape up front, so an invalid save never shows a Resume button (this was added after the first Playwright run showed a stale Resume button for a version 2 save with a numeric seed).
- [x] `src/shell/main.js`: bot seed derivation changed to a numeric mix of the first seed word (or the legacy number), log length and seat. Without this, an array seed would have been silently string-concatenated.
- [x] Cache-busting not applicable (single inlined file). `index.html` rebuilt (25.3 KB).

Verification (scratch scripts, none committed):
- Known-answer: first 10 sfc32 outputs equal an independently written typed-array implementation of the published algorithm.
- Distribution, 6,000,000 rolls each: chi-square d6 2.08 (limit 20.52), d7 14.82 (limit 22.46), d20 23.12 (limit 43.82). d6 counts: 999137 999471 1000534 1000189 999829 1000840.
- Serial independence, 6,000,000 d6 rolls: lag-1 correlation -0.00055 (limit 0.005); 36-cell pair chi-square 50.10 (limit 66.62).
- Seed independence: 100,000 fresh `newSeed()` values gave first-roll chi-square 5.39 (limit 20.52) and zero duplicate seeds; `die()` stayed in range for sides 2, 3, 5, 6, 7, 100, 1000.
- Replay: a version 1 fixture generated with the OLD code (seed 424242, 70 actions, totals 82/30/18) replayed to a byte-identical final state with the new code; five malformed saves were all rejected; 100 new array-seed games all terminated, saved as version 2, and replayed identically.
- Pig statistics re-run on the new generator: hold-at-20 mean 8.156 points/turn (accepted 8.0-8.3); double-1 frequency 2.812% (expected 2.778%, tolerance 0.3); single-1 27.759%; Balanced bot roll probabilities unchanged (99% at 8 down to 5% at 32).
- Playwright on `index.html` (`file://`, network blocked): full existing suite passes again with zero JS errors; an injected version 1 save resumes with scores identical to the old code's state (82/30/18), plays on, and keeps saving as version 1; a new game saves as version 2 with a four-word seed and resumes after reload; unknown version 99, version 2 with a numeric seed, and corrupt JSON are all ignored with no errors and a usable menu.
- Not re-run after the last `save.js` validation tweak: the headless rules suite (that file is not used by it; it was run immediately before the tweak). Not verified: real-device behavior, browsers other than Chromium.

## Build Log 7 (completed)

Farkle and the multi-game shell (was Queue 3). Farkle rules follow the user-supplied sheet in `docs/farkle-rules-sheet.png`.

- [x] `src/blocks/combo-table.js` (ComboTable block): `scoreSelection` (a selection scores only if every selected die is used; highest-scoring decomposition), `validSubsets`, `hasScoring`, `bestSelection`, `scoreTable` (the on-screen table is generated from the same constants as the engine). Standard scoring per the sheet (singles 100/50; three of a kind 1s 300, 2s 200, 3s 300, 4s 400, 5s 500, 6s 600; four/five/six of a kind 1,000/2,000/3,000; straight, three pairs, four-of-a-kind plus pair 1,500; two triplets 2,500) and a Classic set without the six-dice specials.
- [x] `src/games/farkle.js`: phases start/select/decide; actions `ROLL`, `SET_ASIDE {ids}`, `BANK`; events add `FARKLED`, `HOT_DICE`, `PENALTY`. Five curated house rules: target (2,500 / 5,000 / **10,000**), entry (None / **500** / 1,000), scoring (**Standard** / Classic), three-Farkle penalty (**On** / Off, floored at 0), final round (**On** / Off). Final round: every OTHER seat gets one more turn in seat order, highest total wins, exact ties replay one turn each among only the tied seats. Solo ends at once on reaching the target.
- [x] Engine: legality now compares type plus sorted ids, and the saved action log stores full actions (old type-only Pig saves still replay). Block change: `push-loop` gained a shared `bust()` used by both Pig and Farkle. Honest note: Farkle shares only `bust`, `bank`, and `freshTurn` with the push loop; its roll flow differs because of the SET_ASIDE phase, so it has its own roll code rather than the block's `roll`.
- [x] Bot: `src/ai/brain.js` generalized to `decide()` (plans of one or more actions, valued by simulating the rest of the turn with the game's own `apply` and a game-supplied `rollout`); games export `botHints` (`riskScale`: Pig 1, Farkle 50), `candidatePlans`, `rollout`, `shortcut`. Farkle plans are pruned to the best-scoring subset plus the best of each size, each followed by ROLL or BANK. `chooseAction` kept as a thin wrapper.
- [x] Shell: game registry (`src/games/index.js`, `src/ui/views/index.js`), game picker on the menu, per-game saves (`diceverse:<id>:save`), per-game settings (old flat Pig settings migrate into `house.pig`), per-game solo bests via `meta.soloKey` (Pig's key format unchanged), a Resume button per saved game, and an action chain so the UI can send SET_ASIDE then ROLL/BANK with a short pause. Pig's screen moved to `src/ui/views/pig-view.js` unchanged in behavior.
- [x] Farkle UI: six tappable dice, dimmed kept row, live selection score ("+350" or "Not scoring"), "Take all scoring" helper, buttons ROLL 6 DICE / SET ASIDE & ROLL (n) / SET ASIDE & BANK, entry hint, FARKLE / HOT DICE / PENALTY banners, scoring table inside the rules sheet. Same input locking, reduced-motion, zoom and aria-live rules as Pig. `index.html` rebuilt (42.9 KB). Cache-busting not applicable (single inlined file).

Verification (scratch scripts, none committed; final headless suites and the browser suites re-run on the final code):
- Scoring, exhaustive: every row of the sheet plus 14 extra interpretation cases asserted; for all 55,986 ordered rolls of 1-6 dice and every subset, `scoreSelection`, `hasScoring` and `validSubsets` equal an independently written brute-force reference for both scoring sets (0 mismatches). Exhaustive Farkle counts (standard) were 4, 16, 60, 204, 600, 1,080 of 6, 36, 216, 1,296, 7,776, 46,656, i.e. 66.67%, 44.44%, 27.78%, 15.74%, 7.72%, 2.31% for 1-6 dice, exactly the expected values.
- Rules: threshold, hot dice (including the fresh six-die reroll), penalty (and its floor and Off setting, and reset on bank), final round (trigger seat does not play again, others play once, an overtake wins), three-way tie replay, no-final-round and solo immediate wins, and illegal actions rejected through the engine, all pass in hand-built scenarios; 100 random games across all option combinations (1-4 seats) terminated and replayed identically from seed plus full action log.
- Pig regression: hold-at-20 8.156 points/turn, double-1 2.812%, 100-game replay, tie scenario, observation/import checks all unchanged; Balanced roll probabilities by turn points match the earlier table within sampling noise (99% at 8, 84% at 14, 62% at 18, 49% at 20, 40% at 22, 21% at 26, 5% at 32).
- RNG suite and the version 1 / version 2 save checks re-run: all pass.
- Farkle bot: decision time over 300 sampled decision points in Node: p50 2.2 ms, p95 4.3 ms, max 7.8 ms (Balanced), far under the 150 ms budget. Mean points per turn (solo, no entry minimum, no penalty): baseline "take all scoring, bank at 300" 449.4 (50,000 turns); Cautious 517.9, Balanced 512.8, Bold 510.5 (20,000 turns each), so the bots beat the baseline by about 14%. The presets differ in behavior, not mean: Farkle rate / average bank were 11.5% / 577 (Cautious), 17.3% / 626 (Balanced), 25.7% / 696 (Bold) versus 19.1% / 555 for the baseline.
- Playwright on `index.html` (`file://`, network blocked): all 37 Farkle checks passed with zero JS errors and zero external requests, covering full solo, vs Bots (final round), and Pass and Play (Classic, no penalty, no entry) games by real clicks; the generated scoring table; the entry threshold enabling BANK exactly when the selection reaches 500; selecting a non-scoring die showing "Not scoring" with both buttons disabled; a double-click doing exactly one set-aside plus one roll and the saved log holding full actions; reload mid-turn restoring identical dice and kept dice; a Resume button per game with the two saves kept separate; a replayable hot-dice save (generated with the real engine) showing ROLL (6) and then six free dice; the FARKLE banner appearing; migration of the old flat Pig settings and best key; 768 px layout; reduced motion; blocked storage. The Pig browser suites (including the version 1 save checks) were re-run after the shell refactor and pass. Screenshots inspected (mid-turn layout: kept row above the dice, no overlap, all five dice inside the 390 px width).
- Not verified or differing from the Queue plan, stated plainly: bot quality was measured over 20,000 turns per preset (50,000 only for the baseline) because of run time; decision time was measured in Node (p95 4.3 ms), not separately in Chromium, though full bot games ran in Chromium without any stall; the hot-dice path was exercised through a real, replayable saved game rather than a live roll; the first overlap check measured a hidden kept row, so a separate mid-turn geometry check was added; two assertions in my own test script were wrong (classic two-triplet value, table row count) and were corrected after confirming the engine against the independent reference; no real-device touch or haptics testing; Chromium only.

## Build Log 8 (completed)

Adopted the user-supplied `CLAUDE.md` and `tests-helpers.js`, adapted for this repo (docs and test plumbing only; no app code changed).

- [x] Added `CLAUDE.md` at the repo root (read automatically at session start). Changes I made to the supplied file: replaced the intro line; filled the branch rule ("direct to `main`, no pull requests"); filled the App-specific section (single bundled `index.html`, no cache-busting, GitHub Pages address and caching note, charset declared so non-ASCII is fine, touch-first input at 390x844 and 768x1024); renamed the helper to `tests-helpers.cjs` everywhere and explained why; rewrote Fast testing item 1 to the new `preflight`, and item 4 to mention seed pinning and pure-module statistics in Node; deleted items that do not apply to this app (long-press menus, "raw non-ASCII characters in JavaScript", "promising what browsers cannot do" about file pickers, "saving while a finger is down"); reworded the full-regression-run example to my own 10-minute run; added the mistake "building to the wrong path" (marked Added by Claude); added a "Project map" line (marked Added by Claude). Everything else is the supplied text.
- [x] Added `tests-helpers.cjs` (renamed from `.js` because `package.json` is `"type": "module"`, which makes a `.js` CommonJS file fail to load). Changes to the supplied helper: `preflight()` rewritten for a single bundled `index.html` (parses inline scripts, requires a charset in the first 1,024 bytes, flags external URLs in tags, flags a bundle older than `src/` or `build.mjs`); removed `versions()` (no cache-bust numbers here); the random stub now pins every slot of a `Uint32Array` (so `force(page, [a, b, c, d])` pins a whole game seed, where before only the first slot was pinned); header and usage comment updated. No scenarios were added.
- [x] Removed `BUILD.md` (its lifecycle, commit, and verification content is in `CLAUDE.md`; its cache-busting section does not apply to a single inlined file). It remains in git history. Updated the README pointer and the "How to build and run" note; older Build Log entries still name BUILD.md as history.
- [x] Queued the instant-speed switch as Queue 4.

Verification: ran a scratch script using the helper: preflight clean on the repo; a future-dated source file made `preflight` report the stale bundle, and a rebuild cleared it; a synthetic bad bundle was flagged for missing charset, broken inline script and external URL; in a real browser, `force(page, [1, 2, 3, 4])` before Start produced the saved seed `[1,2,3,4]` and a first Pig roll equal to the Node engine's first roll for the same seed. 8 checks passed, 0 failed, 0 JS errors, 3 seconds. Not verified: the `?speed` switch (not built), and the helper's `touchTools`, `png`, `px` and `blockStorage` options (unchanged from the supplied file and not exercised here).

## Build Log 9 (completed)

Instant-speed switch for testing, `?speed=N` (was Queue 4).

- [x] `src/core/scheduler.js`: `createScheduler({ scale })`; every `after(ms, fn)` waits `ms * scale` (default 1). At scale 0 callbacks still run asynchronously, so ordering, the busy lock and `cancelAll()` behave as before.
- [x] `src/shell/main.js`: `readSpeed()` reads `?speed=` (a number from 0 to 1; missing, empty, non-numeric, negative or above 1 means 1), creates the scheduler with that scale, and adds a `fast` class to `<body>` when the speed is exactly 0.
- [x] `src/ui/theme.css`: `body.fast` turns off all CSS animations and transitions. The reduced-motion path is unchanged. The switch is not in the UI, not saved to settings or saves, and not mentioned in the menu or rules. Rules, bots and saves are untouched.
- [x] `CLAUDE.md` fast-testing item 4 updated to say the switch exists and to keep a real-speed check for timing behavior (I am telling you because that file is mine to edit and you should know).
- [x] `index.html` rebuilt (43.4 KB). Cache-busting not applicable (single inlined file).

Verification (scratch scripts using `tests-helpers.cjs`, none committed): `preflight` clean, then a 17-check script (38 s, 0 failures, 0 JS errors):
- Default speed unchanged: after a ROLL the controls re-enable only after at least 600 ms; a double-click on ROLL performs exactly one roll.
- Invalid values `?speed=abc`, `-1`, `5` and an empty value behave like normal speed (no `fast` class, same delay).
- At `?speed=0` with a pinned seed: a full vs-Bots Pig game (target 50) finished in 1,269 ms and a full vs-Bots Farkle game (target 2,500) in 1,208 ms; `document.getAnimations()` is empty after a roll; pressing BANK and Menu in the same task leaves no stale bot action (saved log length unchanged after 800 ms) and the menu stays; reload plus Resume restores identical scores; the same seed and choices give identical Farkle standings on two speed-0 runs.
- The same seed and the same human choices give identical Pig final standings at speed 0 and at default speed (reduced-motion), so timing does not change outcomes.
- Suite time against the 3-minute budget: the old Pig browser suite went from 236 s (default speed, all checks pass on this build) to 31 s at `?speed=0`; the old Farkle suite went from 627 s (the earlier full run) to 33 s at `?speed=0`.
- Things that did not carry over at speed 0, stated plainly (test expectations, not app bugs): in the old Pig script, "no stale bot action after leaving to Menu" read the saved log before clicking Menu, and at speed 0 the bots had already moved in that gap (3 to 6), so the deterministic same-task version above replaces it; the old Farkle script's FARKLE-banner check cannot work at speed 0 because the banner is shown for 0 ms, so it was skipped for the speed-0 timing and the banner stays a real-speed check (it passed at default speed in Build Log 7; it was not re-run on this build).
- Not verified: fractional speeds between 0 and 1 (allowed, not tested); the Farkle suite at default speed on this build (the change only affects the delay scale, default 1); real-device behavior; browsers other than Chromium.

## Build Log 10 (completed)

Farkle scoring comparison table: Name, Classic, Standard side by side (user request).

- [x] `src/ui/views/farkle-view.js` `rulesSheet`: the scoring section is now ONE table with three columns (Name, Classic, Standard) instead of the single active set. Rows come from `scoreTable('standard')`, and each Classic value is looked up by label from `scoreTable('classic')`, so both columns still come from the engine's own constants and cannot drift. A combination that does not score in Classic shows a dash. It appears in the menu's "How to play" and in the in-game "?" sheet (same function).
- [x] `src/ui/theme.css`: `.cmp` table styles (right-aligned tabular numbers, muted dashes, zebra rows, sticky header with gold uppercase labels).
- [x] `.sheet` top spacing moved from padding to a margin on its first child so a sticky table header sits flush with the top of a scrolling sheet; all other sheets look the same (checked on the house rules sheet).
- [x] Added by Claude (small additions, change if wanted): the caption under the table explaining the dash, the sticky header, the zebra rows, the header word "Name".
- [x] `CLAUDE.md`: new working convention "Show choices side by side" (the standing preference you stated), so future variants and options get compared in one view.
- [x] `index.html` rebuilt (44.5 KB). Cache-busting not applicable (single inlined file).

Verification (scratch scripts using `tests-helpers.cjs`, none committed): `preflight` clean; 11 checks passed, 0 failed, 0 JS errors, in 2 seconds, at `?speed=0`: the header cells are Name / Classic / Standard; all 15 rows (name, classic, standard) equal the values generated from the engine tables; exactly four dashes in Classic (Straight 1-6, Three pairs, Four of a kind + pair, Two triplets); spot values (Three 1s 300/300, Four of a kind 1,000/1,000, Two triplets dash/2,500); the old "Scoring (standard)" heading is gone; no horizontal overflow at 390 px and at 320 px; at 320 px the sheet scrolls, the header stays pinned flush at the top and no row shows above it; the in-game "?" shows the same table; the Pig rules sheet is unchanged. Screenshots of the table at 390 px and 320 px inspected. Because the sheet padding rule is shared, the existing browser suites that open sheets were re-run at `?speed=0`: Farkle all pass; Pig passes except the one old "no stale bot action after Menu" check that races at speed 0 (already explained in Build Log 9; its same-task replacement passed there).
- Bugs found and fixed during verification: at 320 px a sliver of the previous row showed above the pinned header (caused by the sheet's top padding), fixed by the margin change above. Three of my own test checks were wrong and corrected: the first sticky test ran at 390 px where the sheet does not scroll, and two geometry checks mis-measured rows hidden under the opaque header.
- Not verified: real-device rendering and scroll feel on a phone; browsers other than Chromium.

## Build Log 11 (completed)

Correction note for Build Log 10.

- [x] Build Log 10 (the three-column Farkle scoring table) was built and pushed from a request without a go-ahead; under CLAUDE.md it should have been queued first. The user reviewed this, chose to keep the change as shipped, and confirmed the CLAUDE.md "Show choices side by side" line is wanted (it records a preference they stated, and CLAUDE.md is how it is remembered). No code changed in this entry.

Verification: documentation only.

## Build Log 12 (completed)

One-line scoring hint in the Farkle house rules (was Queue 5).

- [x] `src/games/farkle.js`: the `scoring` house rule now carries an optional `hint` function that returns "Classic leaves out: " followed by every label in `scoreTable('standard')` that is missing from `scoreTable('classic')`, so it is generated from the engine tables and cannot drift. Result: "Classic leaves out: Straight 1-6, Three pairs, Four of a kind + pair, Two triplets."
- [x] `src/shell/main.js` `openHouseRules`: if a rule has a `hint`, it is rendered as a muted `note` paragraph under that rule's buttons (any game's house rule may now use this). Only Farkle's Scoring rule defines one; Pig is unchanged.
- [x] `index.html` rebuilt (44.7 KB). Cache-busting not applicable (single inlined file).
- [x] Inconsistency logged, not fixed: with the extra lines, the Farkle house rules sheet at 390x844 is now slightly taller than the screen, so the Done button is reachable by scrolling instead of fully visible. Left as is pending your decision.

Verification (scratch script using `tests-helpers.cjs`; none committed): `preflight` clean; 8 checks passed, 0 failed, 0 JS errors, 3 seconds. The generated hint equals the specified wording; it appears under Scoring and under no other rule; it stays visible with either Standard or Classic selected; Pig's house rules have no hint; no horizontal overflow at 390 or 320 px; screenshot inspected. The existing browser checks that open the house rules sheet were re-run at `?speed=0`: Farkle all pass; Pig passes except the one old "no stale bot action after Menu" check that races at speed 0 (explained in Build Log 9). Not verified: real-device rendering; browsers other than Chromium.

## Build Log 13 (completed)

Yacht: one game, three rule sets (Classic Yacht, Nordic (Yatzy), Popular (Bonus)) on a new hold-and-reroll engine with a category sheet (was Queue 6).

- [x] `src/blocks/category-sheet.js` (new CategorySheet block): the three rule sets as data (12 / 15 / 13 categories, labels, short rule text, scoring functions), `potential()` (with the simplified Joker), `jokerActive()`, `totals()` (upper bonus 50 / 35 at 63), `comparisonRows()` for the side-by-side table, and bot `PAR` values. Scoring follows the supplied tables; the details I chose are listed in Queue 6's "Added by Claude" notes (Full House excludes five of a kind, Two Pairs need two different values, required-dice counts in Classic and Nordic).
- [x] `src/games/yacht.js` (new, registered in `src/games/index.js`): phases start/choose; actions `ROLL {ids}` (the dice to re-roll; the first roll must be all five) and `SCORE {category}`; 3 rolls per turn; one round per category; ties give `winners` with `winner: null`; default rule set Popular (Bonus). Simplified Joker: Popular only, extra five of a kind with the Five of a Kind box holding 50 gives +100 and Full House 25 / Small Straight 30 / Large Straight 40 anywhere.
- [x] `src/core/engine.js`: `sameAction` now also compares `category`. `src/shell/save.js`: `updateBest` takes a direction (`'high'` for Yacht, default `'low'` for Pig and Farkle). `src/shell/main.js`: game-over handles ties and a solo score through optional meta hooks (`soloBest`, `soloValue`, `soloTitle`, `soloLabel`; Pig and Farkle use defaults and are unchanged), the menu's best label, and a shell slot for a view's extra panel (`ui.after`). `src/ui/panels.js`: score chips can be tapped to show another player's sheet.
- [x] Bot (`src/ai/brain.js`, `src/games/yacht.js`): plans are SCORE each open box or ROLL a de-duplicated set of dice to re-roll, valued by simulating the rest of the turn and scoring (points minus the box's par). New optional game hooks: `turnValue`, `isDeterministic`, and per-game `botHints.noiseScale` and `simsPerPlan`; Pig and Farkle define none of them and behave as before.
- [x] `src/ui/views/yacht-view.js` (new) and `theme.css`: five tappable dice (tap = hold, raised with a HELD tag), roll counter label ("ROLL (2 left)", "HOLD FEWER", "NO ROLLS LEFT"), the category sheet with live score previews, tap-to-select then SCORE to confirm, upper-section progress row, totals, a sticky bottom button bar, three-column-plus-name rules table (Name, Classic, Nordic, Popular) generated from the engine data, and the Rule set house rule with its hint (using the Queue 5 mechanism). Dice scale down so five always fit at 320 px.
- [x] `index.html` rebuilt (62.6 KB). Cache-busting not applicable (single inlined file). `CLAUDE.md` project map line updated and `docs/block-spec.md` implementation notes added (I am telling you because those files are mine to edit).

Verification (scratch scripts using `tests-helpers.cjs`, none committed):
- Headless, 26 checks in about 1 second: every category of every rule set equals an independently written reference scorer over all 7,776 ordered rolls (0 mismatches); 17 hand cases per set; category counts 12 / 15 / 13; exact counts (five of a kind 6 of 7,776, any five in a row 240 of 7,776); upper bonus at 62 vs 63; Joker with the five-of-a-kind box at 50 vs 0, and no Joker in the other sets; eight invalid actions rejected (including a SCORE with a missing or wrong category); a tie and a clear winner; 100 random games over all sets and 1-4 seats terminated, played exactly rounds x seats scores, filled every card, and replayed identically from seed plus full action log.
- Bot: decision time with the Balanced preset p50 about 10 ms, p95 about 52-59 ms, max about 129 ms in Node. Mean solo score over simulated games, baseline (4,000 games per set) vs Balanced (400 games per set): Classic 124.1 vs 138.7 (+11.8%), Nordic 184.6 vs 206.3 (+11.8%), Popular 184.4 vs 207.2 (+12.4%), all at or above the +10% target; Popular Cautious 203.4 and Bold 208.7 (250 games each), so the presets differ in style more than in average score.
- Playwright on `index.html` (`?speed=0`, pinned seeds, `preflight` clean), 43 checks in 58 seconds, 0 failures, 0 JS errors: menu summary, default rule set Popular (Bonus), three option buttons and the hint; the rules table header and every row equal the engine rows, no horizontal overflow at 390 or 320 px; full solo games in all three rule sets by real taps (each took 6.7-8.2 s) with every preview and the SCORE label equal to the engine at every turn, the right number of rounds, game-over score equal to the chip total, scored rows disabled; solo best shown on the menu and, after a second game, equal to the higher of the two; roll counter labels, hold toggles keeping dice values, HOLD FEWER with all five held, NO ROLLS LEFT after three rolls; sticky controls inside the viewport; reload mid-turn restores the dice and rolls left and clears the holds; a full vs Bots game and a Pass and Play game finish; tapping another player's chip shows their sheet read-only; a crafted save one move from the end shows "It's a tie: Player 1 and Player 2". Screenshots inspected: house rules with the hint, rules table at 390 and 320 px, mid-turn game screen, tie sheet.
- Re-run because shared files changed: headless Pig rules/RNG/Farkle rules suites and the Pig and Farkle bot checks all pass; the Pig browser suite passes except the one old "no stale bot action after Menu" check that races at `?speed=0` (explained in Build Log 9); the v1/v2 save checks pass; the Farkle scoring table and house rule hint checks pass; the Farkle browser suite passed on three consecutive runs.
- Bugs found and fixed during verification: (1) the first bot version was WORSE than its baseline (Nordic 167.7 vs 184.6): with only 150 simulations per plan and noise sized for Pig, choosing the best of about 40 noisy estimates mostly picked luck; fixed with 600 simulations per plan and a much smaller noise scale (new per-game hints), which also meant measuring again; (2) the new bot hook was first named `valueOf`, which bundled game modules inherit from `Object.prototype`, so Pig's bots crashed in the browser while every Node test passed (caught by re-running the old Pig browser suite); renamed `turnValue`; (3) at 320 px the five dice overflowed by 12 px, fixed with a width-based die size; (4) the Yacht view's extra panel was first attached to a detached element and never appeared, fixed with a shell slot.
- Test-script mistakes fixed along the way: a "ready" wait that expected ROLL enabled after the third roll; a pass-and-play step that rolled before handing control to the policy; two tie scenarios that set totals instead of card values.
- Unexplained, stated plainly: the old Farkle browser script failed twice (a missing "Take all scoring" button after the first roll, which also happens if that roll is a Farkle, 2.3% of runs) while other heavy processes were running, then passed three times in a row, and a 40-run probe of that exact step never failed; I could not prove the cause.
- Not verified or differing from the Queue plan: bot averages used 400 games per set for Balanced (the plan said 2,000) because of run time; bot decision time was measured in Node only, so a short pause on a slow phone is possible (needs a real-device check, along with the feel of the hold taps, the category list and the sticky button bar and a phone's browser bar); browsers other than Chromium; fractional `?speed` values. One observation, not changed: the Rule set hint is a long single paragraph.
