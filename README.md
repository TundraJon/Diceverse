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
- Chicago description in the notes is thin; confirm the exact ruleset.
- Need to decide which games are solo, pass-and-play, or vs. computer.

### Planner 3 — Tech stack / persistence
Source suggested: vanilla JS ES modules + Tailwind, CSS Grid/Flexbox, localStorage (high scores, favorite rules, resume an in-progress game).
Flags: ES modules fail over `file://` and some WebViews, and Tailwind via CDN needs network, which matters for offline/Play Store use. Open: serve over http only, bundle later, or use plain CSS. Cache-busting rules in BUILD.md apply once files are split.

## Build Log 1 (completed)

Project scaffolding: adopted the Build Workflow from the Startpage project.

- [x] Added `BUILD.md` containing the full build workflow, unmodified.
- [x] Added standing rule, AI-ownership instruction, and Build Queue / Build Planner / Build Log sections to `README.md`.
- [x] Cache-busting section retained in `BUILD.md` because the app is expected to split into separate JS/CSS files.

Verification: docs only, no code. Confirmed file contents by re-reading them.
