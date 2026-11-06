# Build Workflow

This is the workflow we used on the Startpage project, written up so it can be dropped into a new app's `README.md` (or a separate `BUILD.md`) and reused as-is.

## Where it lives

Everything below lives in **one file** — `README.md` at the repo root — as a set of ongoing sections. Not separate files, not an issue tracker: one document that's always current, always committed, always the single source of truth for "what's done, what's next, and what's just an idea."

## Who owns these files

This is the part most likely to get lost when this pattern moves to a new project or a new AI tool, so it's worth stating plainly rather than assuming it carries over.

**The AI (Claude, or whatever agent is doing the work) owns writing and editing the Build Log, Build Queue, and Build Planner sections.** Not the human. Give the agent this instruction explicitly, in whatever system/project file it reads first (`README.md` itself, `CLAUDE.md`, a system prompt — wherever it'll actually see it before starting work):

> You own editing the Build Log, Build Queue, and Build Planner sections of this file as part of doing the work. Update them yourself, as you go — don't wait for me to write them, and don't ask me to.

Why it works this way:

- **These sections exist so the agent can recover its own context, not so the human can track the agent.** The real reason this pattern earns its keep is session continuity: when a long-running coding session's context gets compacted, or a brand-new session starts cold on the same project, the agent has no memory of any prior conversation — only whatever is written down in files. `README.md`'s three sections are built to be that memory: re-read the Build Log and the agent knows exactly what's already shipped and why; re-read the Build Queue and it knows exactly what's already been specified and is just waiting on a go-ahead; re-read the Build Planner and it knows what's been discussed but not yet designed. None of that works if the human is the one expected to keep it updated — a human doesn't experience the memory loss, so they have no natural trigger to go write a status update after every change, and the file silently goes stale.
- **Writing the entry is part of finishing the task, not a separate chore.** A build isn't "done" until it's verified *and* logged. The same turn that implements a feature, verifies it, and commits the code also writes the Build Log entry documenting what shipped and how it was verified, updates the Build Queue to remove the now-built item, and (if relevant) removes any Build Planner item it just resolved. All of this happens in the same commit as the actual code change — these docs are source-controlled right alongside the code they describe, not maintained out of band.
- **The human's job is authorization and direction, not transcription.** The human decides what to build, answers design questions, and says "go ahead" — they never have to translate a conversation into a written spec themselves. If the human *wants* to write directly into these sections (correct something, pre-approve a batch of work, leave a note for next time), that's completely fine — it's their repo and their file. But the default, ordinary flow doesn't require it, and the agent shouldn't wait for it.
- **If an agent is told "you own this file, edit it yourself" (addressed to the human) by some other scaffolding or tool,** that's almost certainly either generic file-ownership boilerplate unrelated to this workflow, or a different tool that hasn't been told to take on this responsibility. The fix is the explicit instruction block above, placed somewhere the agent reads automatically at the start of every session.

## The standing rule

> **Never build or edit code without explicit instruction.**

Put this at the very top of the file, above everything else. It governs everything that follows:

- Finding a bug, spotting an inconsistency, or coming up with an improvement is never itself permission to fix it. It gets written down (see Build Queue / Build Planner below) and left alone until explicitly authorized.
- "Explicit instruction" means something unambiguous in the moment — "go ahead and build it," "yes, add it," "build the build queue." A description of a problem, a design discussion, or even "that should probably be fixed" is not authorization by itself.
- If an instruction is genuinely ambiguous (could mean two different scopes, two different files, etc.), ask a clarifying question before building — don't guess and don't build partway while waiting on the answer.
- This rule applies even to small, "obviously fine" changes. A one-line fix still waits for the go-ahead.

## The three sections

### 1. Build Log

A running, numbered history of everything actually completed — `## Build Log N (completed)`, oldest at the top or newest at the top, whichever you prefer (we went oldest-first, numbered sequentially: Build 1, Build 2, ... Build 96).

Each entry gets:
- A short title describing what shipped.
- A one- or two-sentence intro giving context (what prompted it, what it replaces, any backstory worth keeping).
- A checklist (`- [x]`) of the specific things that changed, written precisely enough that someone could reconstruct the change from the text alone — file names, function names, exact behavior, not just "fixed the bug."
- A **verification** line at the end, stating exactly how it was tested (browser automation steps, specific scenarios checked, edge cases confirmed) and the result (e.g. "zero JS errors"). If a bug was found and fixed *during* verification, that gets its own bullet too — don't silently absorb it into the main description.

This is append-only history. Once something ships, it doesn't get edited to look like it was always right — later corrections become their own new Build Log entry.

### 2. Build Queue

`## Build Queue` — holds **fully-specified, authorized-but-not-yet-built** work. This is the handoff point between "we agreed what to build" and "it's built."

- An item only lands here once its design is actually settled — not a rough idea, a complete spec: exact UI behavior, exact edge cases, exact reuse of existing code where applicable. Write it precisely enough that building it is just execution, not more decision-making.
- Getting a design into the Queue is **not** authorization to build it. State that explicitly in the entry ("Not yet authorized to build") so it's unambiguous on a re-read.
- When the user says to build it, the item is built, verified, written up as a new Build Log entry, and **removed** from the Queue in the same commit. The Queue should be empty most of the time — it's a waiting room, not a backlog.
- If nothing is queued, say so explicitly: `_Empty — nothing queued right now._` Don't just leave the heading with nothing under it; an explicit empty-state line is easy to grep for and confirms the file wasn't just left stale.

### 3. Build Planner

`## Build Planner` — the actual backlog. Ideas, half-formed feature concepts, known gaps, "would be nice eventually" — things that are **not** being actively worked on and have no committed design yet.

- Each item gets a short header and enough description to pick it back up cold later, including any open questions that still need resolving before it could move to the Queue.
- When an item's design gets worked out (through conversation, usually with clarifying questions — see below), it gets **promoted**: removed from the Planner and written up fresh as a fully-specified entry in the Build Queue.
- **Resolved, built, dropped, or superseded items are not kept here** — once something ships (even via a different path than originally planned) or is explicitly decided against, it's deleted from the Planner. Its history lives in the Build Log, not as a stale checkbox nobody's looking at. State this rule explicitly under the Planner heading so it doesn't drift.
- Same empty-state convention: `_Empty — nothing backlogged right now._` when there's nothing in it.

## The lifecycle, end to end

```
idea
  → Build Planner (if it needs more thought / isn't ready to spec)
  → design discussion (clarifying questions, trade-offs, user decides)
  → Build Queue (fully specified, "not yet authorized to build")
  → explicit "go ahead" from the user
  → build it
  → verify it (don't just claim it works — actually test it)
  → Build Log entry (new, numbered, with verification notes)
  → remove it from the Build Queue
  → commit + push
```

A design conversation can also skip the Planner entirely and go straight from "let's work on X" to a Build Queue entry, if it's specified in one sitting. The Planner is for things that aren't ready yet, not a mandatory first stop.

## Cache-busting

This only applies if the app is static files served directly to a browser (no build tool, no bundler, no hashed filenames) — which is exactly the Startpage setup: a plain `index.html` loading `script.js` and `styles.css` straight off the server. If the new app has a build pipeline that already hashes filenames (Vite, webpack, etc.), skip this whole section — that pipeline already solves the same problem a better way.

**The problem:** browsers aggressively cache `.js`/`.css` files by filename. Push a fix to `script.js`, and a browser that already loaded the old `script.js` once will keep serving its cached copy indefinitely — the user never gets the fix, with no error, no warning, nothing visibly wrong except the bug still being there.

**The fix:** every `<script>`/`<link>` tag that loads a local JS or CSS file carries a version query string, e.g.:

```html
<link rel="stylesheet" href="styles.css?v=61">
<script src="script.js?v=71"></script>
```

`styles.css?v=61` and `styles.css?v=62` are different URLs as far as the browser's cache is concerned, even though they're the same file on disk — bumping the number forces a fresh fetch.

**The rule, stated plainly:** whenever `script.js` or `styles.css` (or any other locally-served JS/CSS asset) is edited as part of a build, its version number in `index.html` gets bumped by exactly 1 in that same change — no exceptions, not even for a one-line fix. If three files change in one build, bump all three that changed; don't bump ones that didn't.

**Where to look:** keep every one of these version numbers in one obvious, easy-to-grep spot (we kept them all on the `<link>`/`<script>` tags at the very top/bottom of `index.html`) so a quick glance confirms every changed file got bumped, not just some of them.

**Log it like any other change:** a Build Log entry's checklist should include a line like `Cache-bust bumped: styles.css?v=60→61, script.js?v=70→71` — stating the before and after numbers, not just "bumped." That makes it trivial to audit after the fact whether a given build actually invalidated the right caches.

**The failure mode to watch for, because it already happened once:** a fix can be written, committed, and pushed correctly, and still not reach a single real user, because the version number on the changed file was left untouched. The code is right; the bug is still live anyway, because every browser that already has the old file keeps serving it from cache. If a user reports "I did what you said and it's still broken" right after a push that should have fixed it, check the version numbers before assuming the code itself is wrong — that was the actual root cause the one time this happened. The fix in that case is its own tiny follow-up build: bump the forgotten version number, note explicitly in the Build Log that the previous build's fix never actually reached users due to the missed cache-bust, push again.

## Commit discipline

- **Authorization to build includes authorization to commit and push.** "Go ahead and build it" covers the whole arc — implement, verify, write the Build Log entry, commit, push. There's no separate pause to ask "can I push now?" once the build itself was explicitly authorized; stopping partway through for that would just be friction, not safety. (This is distinct from genuinely risky git operations — force-push, history rewrite, anything destructive — which still warrant checking first regardless of what else was authorized.)
- **New commits, not amends.** Every build is its own commit, even a tiny follow-up fix to the build before it (e.g. the forgotten cache-bust bump became its own small commit, not a rewrite of the commit it was fixing). History stays an honest, readable record of what actually happened and in what order.
- **Commit messages: a short summary line, then a line or two of *why*, not a restatement of the diff.** The diff already shows what changed; the message's job is the part the diff can't show — what prompted it, what it fixes, why this approach. Keep a consistent attribution footer if the project wants commits traceable to the agent that made them.
- **Direct-to-main, no PR ceremony, for a single-owner project worked this way.** This fits a solo project where the "reviewer" is the same conversation that specified the work — if the new project has actual collaborators or a review process, that structure takes precedence and this convention doesn't apply as-is.

## Verification (Playwright)

"Verify it" (from the lifecycle above) means actually driving the running app and checking real behavior — not reading the diff and asserting it looks right. For a web app, that means browser automation. We used Playwright; the specific setup below is environment-specific and will need to be redone fresh wherever this pattern lands next, but the *pattern itself* carries over to any project with a UI.

**One-time setup, per environment (figure this out fresh — don't assume the specifics below):**
- Get a Playwright package available (`npm install playwright` or `playwright-core` if a browser binary already exists some other way) and a browser binary it can launch. On a from-scratch machine this is normally just `npm install -D playwright` followed by `npx playwright install chromium` — simpler than what we had to do here, where a pre-existing Chromium binary at a fixed path had to be pointed to explicitly instead.
- Have a way to serve the app locally (a static file server for a no-build-tool app like Startpage; whatever dev server the new app already uses otherwise).

**Per-test workflow — the part that's worth keeping verbatim:**
1. Write a throwaway test script per scenario (or small cluster of closely related scenarios) to a scratch/temp location — **never commit these to the repo.** They're disposable verification tools, not a test suite the project is expected to maintain.
2. Register a page-error listener before doing anything else, and collect into a list — every script ends by printing that list, and "zero JS errors" is a hard bar for calling anything verified. A feature that "looks right" but throws a silent console error is not done.
3. Drive the UI the way a real user would: click actual buttons, fill actual inputs, read state back out of the actual rendered DOM. Never reach into the app's internal JS state directly to shortcut this — the entire point is confirming what a user would actually see and experience.
4. Log each check with both a label and the expected value right next to the actual one, e.g. `console.log('After 2nd tap (expect X):', actualValue)`. This makes the output self-auditing — a human (or a later version of the agent) can skim the printed log and immediately tell what passed without re-deriving what *should* have happened.
5. Screenshot whenever a visual claim is being made — layout, icon rendering, color, alignment, anything about what something *looks like*. Reading the code is never a substitute for actually looking at the rendered pixels.
6. Before calling a build done, re-run the *previous* builds' test scripts too, not just the new one — this is what catches a new change quietly breaking something that used to work. A growing pile of small, re-runnable scripts is doing the job of a regression suite, even though none of them were written as one.
7. Test realistic data/state, not just the happy path on a near-empty app — several real bugs in this project (the Reports sort tie-break, the Settings/Reports popup stacking conflict) only showed up against the app's full real dataset, never against a sparse test fixture.

**When a bug is reported, reproduce it before fixing it.** Every real bug in this project got handled the same way, in this order: write a script that reproduces the *exact* symptom the user described, against real data, and confirm it actually fails the same way they said it did — only then form a root-cause theory, fix it, and re-run that same reproduction script to prove the fix closes it (then the full regression suite on top). Never skip straight from "I can see a plausible bug reading the code" to patching it — a theory that's never actually been confirmed against a live reproduction can be wrong, and a fix for the wrong theory can look right without being right. The Reports sort tie-break bug is the clean example: the actual root cause (`-Infinity - (-Infinity)` evaluating to `NaN`, not `0`) was only found by reproducing the user's exact reported scenario first, not by guessing from the comparator code alone.

**Known limitation worth naming up front:** anything depending on a live external network call (a third-party API, a CDN-hosted favicon, etc.) may not be fully verifiable in a sandboxed/offline dev environment. When that happens, say so explicitly rather than silently skipping the check — verify what can be verified in isolation (mock the network layer, test the logic that decides what to request), and flag the rest as needing a real-device/live-network check before fully trusting it.

## Supporting conventions worth carrying over

These aren't strictly part of the Queue/Planner/Log structure, but they're what made it actually work in practice:

- **Design out loud, in rounds, before building.** Walk through the feature verbally/in writing first. Expect the user to correct your first (and second) understanding — restate what you think they mean and let them confirm or fix it, rather than assuming you got it right the first time.
- **Ask, don't assume, at real decision points.** When there's a genuine judgment call with more than one reasonable answer (not just "what should I name this variable"), ask — and give a recommendation, don't just list options with no opinion.
- **Reuse before inventing.** Before building a new UI pattern or mechanism, check whether something already in the codebase does almost the same thing (an existing confirm dialog, an existing selection-bar pattern, etc.) and reuse it rather than creating a parallel one. Note the reuse explicitly in the Build Log entry — it's part of the record of *why* something was built the way it was.
- **Verify for real before calling it done.** Don't just read the code and assert it works — actually run it (browser automation, a test script, whatever fits the stack) against realistic data/state, including edge cases the design conversation surfaced. Write down what was actually checked, not just "tested and working."
- **Catch your own mistakes in the same breath.** If verification turns up a bug introduced by the very change being built, fix it before considering the build done, and say so explicitly in the Log entry rather than hiding it.
- **One append-only file of truth.** Resist the urge to split this into multiple docs or an external tracker. A single, chronologically honest `README.md` is what makes "read the file, understand the whole project's history" possible.
- **Treat a found inconsistency as something to log, not fix on the spot** — even when you're already in the file, even when it's trivial, even when fixing it would take ten seconds. Surface it, let the user decide, then act.
- **Cleanup that a build itself resolves rides along in the same commit — no separate authorization needed.** If finishing a build makes a Build Queue entry or a Build Planner item fully obsolete (the thing it described just got built, or got built a different way that makes the old note stale), delete that entry as part of the same commit. This is different from the bullet above: fixing an *unrelated* thing you happened to notice still gets logged and left alone; removing a note that your *current, already-authorized* work just made stale is bookkeeping, not new scope.
- **Editing a numbered or cross-referenced document means auditing every reference, not just the obvious ones.** Inserting a new numbered section (in a help guide, a table of contents, anything with "see section N" scattered through it) means finding and updating every single number and every single reference to it — not just the table of contents at the top. Confirm it with an automated check afterward (a script asserting position/id/heading all agree, or equivalent) rather than a visual skim, since a missed cross-reference is easy to overlook by eye and embarrassing to ship.
