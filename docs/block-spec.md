# Diceverse Block Spec (draft 1)

Status: design draft. Nothing here is authorized to build. Rules marked **[verify]** were written from memory and must be checked against a reliable rulebook before any implementation.

## 1. Principles

1. **A game is a recipe, not a program.** It is a config that picks blocks and fills in their parameters.
2. **Rules are pure.** `apply(state, action, rng) -> { state, events }`. No DOM, no timers, no `Math.random()`. This is what makes bots, tests, autosave, and replays cheap.
3. **Honest sharing.** About 60% of the push-your-luck family is shared (turn loop, bust/bank, bot risk logic, turn panel). Each game still needs its own resolve rule and scoreboard. Don't pretend otherwise.
4. **Original names and art.** Mechanics are fair game. Names, art, and wording of commercial games are not.
5. **Offline, JSON-serializable state.** Required for flight use and autosave.

## 2. Engine contract

Every game definition exports:

| Member | Purpose |
|---|---|
| `meta` | id, name, players {min,max}, soloOK, estMinutes, tier, houseRules schema |
| `setup(options, rng)` | returns initial state |
| `observe(state, seat)` | what that seat may see (hides other seats' hidden info) |
| `legalActions(state, seat)` | list of valid actions for the acting seat |
| `apply(state, action, rng)` | returns `{ state, events[] }` |
| `isOver(state)` / `result(state)` | game end and final standings |
| `sampleHidden(observation, rng)` | optional; only for hidden-info games, used by bots |
| `heuristics` | optional; per-game bot hints (see section 8) |

Bots receive only `observe()` output and `legalActions()`. They never get the full state. The engine rolls all dice; a bot cannot influence a roll.

## 3. Shared vocabulary

**Actions:** `ROLL {ids?}`, `HOLD {ids}`, `SET_ASIDE {ids}`, `CHOOSE {option}`, `BANK`, `BID {qty,face}`, `CHALLENGE`, `TOGGLE {tiles}`, `MARK {cell}`, `PASS`.

**Events (for UI, sound, log, bot banter):** `ROLLED`, `HELD`, `SCORED`, `BUSTED`, `BANKED`, `TURN_STARTED`, `TURN_ENDED`, `REVEALED`, `ELIMINATED`, `GAME_OVER`.

UI animation, haptics, the game log, and bot personality lines all subscribe to events. Rules code never touches them.

## 4. Blocks

### 4.1 Core (every game)
- **Players/Turns:** seat list (human, pass-and-play human, bot), turn order, simultaneous phases (needed for shared-roll sheet games).
- **Dice pool:** `{count, sides, kinds[]}`. Each die: `{id, value, kind, state: free|held|setAside|locked}`. `kinds` allows colored/risk dice.
- **RNG:** seeded, injected. Same seed + action log reproduces a game.
- **End conditions:** race-to-N, fixed rounds, last standing, sheet full, columns won.

### 4.2 Roll flow (pick one per game)
- **RollAll:** roll the whole pool.
- **RerollBudget:** N rolls per turn, hold any dice between rolls (Yacht).
- **SetAside:** after each roll set aside at least one scoring die, roll the rest; "hot dice" refresh when all are used (Farkle).
- **DrawRoll:** draw k dice from a bag, roll them, replace some (Zombie-style).

### 4.3 Resolve and score (pick one or more)
- **CategorySheet:** categories with `score(dice)`, each usable once, optional bonus.
- **ComboTable:** list of `{pattern, points}` (Farkle).
- **SumTarget:** hit or beat a number (Pickomino-style).
- **FaceCount:** count of a target face (Liar's Dice).
- **Sheet engine:** grid of cells with marking constraints (roll-and-write).

### 4.4 Push-your-luck loop
`TURN: ROLL -> (SELECT) -> RESOLVE -> DECIDE{BANK | CONTINUE} -> BUST?`
Hooks the game supplies: `selectRule`, `resolveRule`, `bustRule`, `bankRule`. The loop, turn panel, bust/bank events, and the risk-bot are shared.

### 4.5 Game-specific boards (not shared)
- **Tracks (columns):** per-column progress with temporary markers (Can't Stop-style).
- **Tracks (path):** shared linear path with tokens and a shared oxygen counter (Deep Sea-style).
- **Tile row/grill:** numbered tiles on a grill plus per-player stacks (Pickomino-style).
- **Toggle row:** tiles 1-9 that flip down (Shut the Box).
- **Bid table:** hidden hands, ordered bids, challenge, lose-a-die (Liar's Dice).

### 4.6 Cross-cutting
- **House rules:** every block parameter that a real-world variant changes is exposed as a named option with a default. The shell shows them as toggles per game. This is a differentiator, not an afterthought.
- **Hidden info:** `observe()` strips what a seat cannot see.

## 5. v1 recipes (10 games) - all rules **[verify]**

| Game | Dice | Roll flow | Resolve/score | Bust / bank | End | Specifics |
|---|---|---|---|---|---|---|
| **Yacht** | 5d6 | RerollBudget (3) | CategorySheet, 12 categories | none | 12 rounds | Ones-Sixes, Full House, Four of a Kind, Little Straight, Big Straight, Choice, Yacht. Variants (Generala, Balut) are the same module with different category lists. |
| **Farkle** | 6d6 | SetAside + hot dice | ComboTable | bust = no scoring dice; bank | race to 10,000 | Many house variants (entry threshold, combo values). Expose as options. |
| **Pig** | 1d6 | RollAll | sum | bust on 1; bank | race to 100 | Variants: two-dice Pig, Hog. Cheapest game; also the tutorial. |
| **Zombie-style** (original theme) | bag of 13 dice, 3 kinds | DrawRoll | FaceCount of "good" faces | 3 bad faces = bust; bank | first to 13 | Kinds differ in risk. Sibling variant: Martian-style. |
| **Column climb** (Can't Stop-style) | 4d6 | RollAll then split into 2 pairs | Tracks (columns) | no valid pair = bust; bank locks markers | first to 3 columns | 11 columns (sums 2-12), uneven lengths, 3 temp markers per turn. |
| **Dive** (Deep Sea-style) | 2 dice (d3-like) | RollAll | Tracks (path) | shared oxygen; bank = return | 3 rounds | Shared state across all seats; strong bot-personality fit. |
| **Worm tiles** (Pickomino-style) | 8 dice, 5 faces + special | SetAside by face value | SumTarget + Tile row | bust returns your top tile; bank = take tile | tiles run out | Set aside all dice of a chosen face, cannot reuse a face, need at least one special face. Sibling variant: Sushizock-style. |
| **Liar's Dice** | 5d6 per seat | hidden RollAll | FaceCount + Bid table | n/a | last player with dice | Wild ones as option; bids on ones; who starts next round. All as options (see Planner 5). |
| **Shut the Box** | 2d6 (1 die option) | RollAll | Toggle row | no valid subset ends turn | lowest remaining sum / shut = win | Option: switch to one die when 7-9 are down. |
| **Roll-and-write** (original) | shared pool | shared roll, simultaneous | Sheet engine | penalties | rows locked / sheet full | Design our own rule set; do not clone any commercial sheet. Spec separately. |

## 6. Overlap matrix

| Block | Yacht | Farkle | Pig | Zombie | Climb | Dive | Worm | Liar | Box | R&W |
|---|---|---|---|---|---|---|---|---|---|---|
| Dice pool | x | x | x | x | x | x | x | x | x | x |
| RerollBudget | x | | | | | | | | | |
| SetAside | | x | | | | | x | | | |
| DrawRoll | | | | x | | | | | | |
| CategorySheet | x | | | | | | | | | |
| ComboTable | | x | | | | | | | | |
| Push loop | | x | x | x | x | x | x | | | |
| Sheet engine | | | | | | | | | | x |
| Hidden info | | | | | | | | x | | |
| Own board | | | | | x | x | x | x | x | x |

Six of ten games share the push loop. That is where the biggest saving is.

## 7. UI panel library

Panels are reusable; a game's config lists which ones it uses.

- **DiceTray:** renders dice, hold/set-aside toggles, roll animation, haptics.
- **TurnBar:** roll / bank / continue buttons and turn banner.
- **ScoreStrip:** running totals per seat.
- **CategorySheet panel** (Yacht)
- **TrackBoard** (Climb columns / Dive path)
- **TileRow** (Worm grill / Shut the Box)
- **BidPanel + Cup** (Liar's Dice, includes the pass-and-play blackout)
- **SheetGrid** (roll-and-write)
- **HouseRules sheet** (generic, generated from each game's schema)

## 8. Bots

- Bots call the shared contract only. No per-game brain unless hints are needed.
- Default brain: determinized Monte Carlo (sample hidden info with `sampleHidden`, play out with `apply`, choose the best action). Difficulty = simulation budget.
- Push loop games get a shared risk model: bank when expected loss from busting exceeds expected gain, with the bust probability computed by simulation from `apply`, not hard-coded tables.
- Liar's Dice adds the bluff layer from Planner 6 (opponent-honesty tracking, deliberate bluffs).
- Personality dials (risk, bluff rate, patience, tilt) apply as parameters on top of the same brain.
- Fairness test: a harness feeds bots an observation object whose hidden fields throw if read.

## 9. Persistence and testing

- State and action log are JSON. Autosave after every action; resume from last state. Seed + log = replay (also enables a final-roll slow-motion replay).
- **Rules tests (no UI):** simulate thousands of bot-vs-bot games per recipe; check invariants (scores never negative, game always terminates) and known probabilities (for example Pig average turn behavior, Farkle bust rates by dice count).
- **UI tests:** Playwright per CLAUDE.md, driving the real UI against realistic state, zero JS errors as the bar.

## 10. Proposed layout (not built)

```
src/core/      rng, engine loop, events, players/turns
src/blocks/    dice-pool, roll-flows, scoring, push-loop, sheet-engine
src/games/     one recipe file per game (yacht.js, farkle.js, ...)
src/ai/        brain, risk model, bluff layer, personalities
src/ui/        panels, theme, animation
src/shell/     menu, house rules, stats, saves
docs/          reference material
```

## 11. Open questions

1. **Delivery format.** Develop as modules and ship one bundled offline file (needs a small build step), or hand-write a single file? Your usual style is single-file HTML; a bundle step keeps that deliverable while allowing real structure.
2. **Rule verification pass.** Every [verify] rule above needs a source check before its recipe is queued.
3. **House-rule scope.** All variants as toggles, or a curated handful per game?
4. **Roll-and-write design.** Original rules to be drafted and approved separately.
5. **Order of work.** Suggested: core + dice pool + Pig (smallest end-to-end slice) -> push-loop games -> Yacht -> Shut the Box -> Liar's Dice -> roll-and-write.

### Decisions recorded (user)
1. Delivery: develop as modules, ship one bundled offline HTML file.
2. House rules: curated, about 3 to 5 per game.
3. First slice: core + dice pool + Pig (specified as Queue 1 in README.md).

### Implementation notes (after Farkle, Build Log 7)
- ComboTable is implemented as `src/blocks/combo-table.js`; Farkle shares only `bust`, `bank`, `freshTurn` with the push-loop block (its SET_ASIDE phase needs its own roll flow).
- The bot brain is now generic: games supply `candidatePlans`, `rollout`, `shortcut` and `botHints`.
- Actions may carry payloads (`ids`); the engine log stores full actions.
- CategorySheet is implemented as `src/blocks/category-sheet.js` (Yacht, Build Log 13); the hold-and-reroll flow is part of `src/games/yacht.js` (ROLL carries the dice to re-roll).
- Bot hooks added for many-plan games: `turnValue`, `isDeterministic`, `botHints.noiseScale`, `botHints.simsPerPlan`.
- TileBoard is implemented as `src/blocks/tile-board.js` (Shut the Box, Build Log 16). House-rule options can be disabled by another choice (`disabled(options)`, `normalizeOptions`).
- Cliffhanger (the Can't Stop-style climb, Build Log 19) is `src/games/cliffhanger.js`. It uses the dice-pool block but not the shared push-loop block: its turn is marker placement (ROLL, then CHOOSE {cols}, then BANK or ROLL), not a running points total. Bot hooks: `candidatePlans`, `rollout`, `shortcut`, `turnValue`, `isDeterministic`, `botHints`; a step in a column is valued by the exact expected number of rolls to get that sum.
- The AI roster (Build Log 23) is pure data in `src/ai/roster.js`: seven opponents, each with a normal face, a thinking line and six moods (an emoji and spoken lines). Moods and talk are cosmetic and live in the shell (`src/shell/moods.js`); they are driven by game events and never touch the rules, the RNG or the bot's decisions.
- Space Salvage (the mixed-risk dice bin, Build Log 32) is `src/games/salvage.js`. It does not use the shared push-loop block: its turn draws three dice from a bin, keeps the drifting ones in hand and sets the rest aside. Internal names keep the shared vocabulary (`BANK`, `BANKED`, `BUSTED`, `cup`, `brainPile`, `shotPile`, `turn.points`). `evaluate()` resolves one roll and is used by both the real roll and `dangerChance(state)` (the exact chance of a bust on the next roll). Bot hooks: `candidatePlans`, `rollout`, `shortcut`, `turnValue`, `isDeterministic`, `botHints`.
- Pirate Plunder (the tile-grabbing dice game, Build Log 38) is `src/games/plunder.js`. It uses no shared turn block: a turn is ROLL, then SET_ASIDE {ids} (all free dice of one face not yet kept), then ROLL again or CLAIM {tile}. `claimOptions(state)` lists every tile a claim could take (any face-up tile at or below the total, or an exact-match steal) and is used by the real claim, the bot and the screen. `sameAction` in `src/core/engine.js` compares `tile`. Failing to take a tile turns over the highest face-up tile, then returns the top tile of your stack. Bot hooks: `candidatePlans`, `rollout`, `turnValue`, `isDeterministic`, `botHints` (no `shortcut`: a claim plan is deterministic and valued exactly).
- Deep Dive (the shared-air treasure dive, Build Log 44) is `src/games/dive.js`. No shared turn block: a turn is an automatic breathe, then ROLL (optionally TURN_BACK first), then PICK_UP, DROP {ids: [unit id]} or PASS. It is the first game with hidden information the bot must not see: `observe(state)` hides every chip value that has not been revealed (the levels stay), and the bot values chips by their level's mean (`LEVEL_MEAN`). `returnChance` and `turnValue` are the bot's heuristics; hooks: `candidatePlans`, `rollout`, `turnValue`, `isDeterministic`, `botHints`. Added rule: a diver that cannot swim any deeper may turn back even without treasure, so a dive cannot reach a dead end.
