# Bot lines: what fires when

Every spoken line, by bot, as of Build 89. Nothing here is waiting on a decision.

## When each group fires

| Group | Fires when | Said how |
|---|---|---|
| THINKING | the whole turn of a bot | status text under the table ("Nat is reading the probability charts..."), not a speech bubble |
| GREETING | once per game, as the bot's first turn starts (only Deuce has one) | speech bubble, 3.5 s |
| DEFAULT (openers) | the start of a bot's "talk turn" (every 2nd or 3rd turn of its own) | speech bubble |
| HANDOFF | as the dice pass to a **human**, after a bot's talk turn (only Pip, Snake and Deuce have them); dropped if the speech slot is not free within 1.5 s; never said to another bot or after a quiet turn | speech bubble |
| NERVOUS | the first roll with a lot at stake (Pig 20+ turn points, Farkle 1000+, Cliffhanger all 3 markers, Space Salvage one hit from ending, Shut the Box 6 or less open) | speech bubble |
| SHOCKED | a bust, farkle, blown turn, no move, lost dice or penalty | speech bubble |
| WINNING | a big bank (Pig 20+, Farkle 1000+, ...), a column won, box shut, challenge won, row locked, round won, a big Yacht score, and game win | speech bubble |
| RELIEVED | a bank after being nervous | speech bubble |
| Game over | the winner says WINNING, or a bot says SHOCKED if a human wins | always said |

Only one bubble at a time. A bot says its lines in random order without repeating until all have been used. A reaction (nervous, shocked, winning, relieved) that is still waiting for the speech slot when its bot's turn ends is dropped. A bot's reaction replaces its own opener if that is still showing.

## Pip 🙂

**DEFAULT (openers)** 🙂

1. Let's roll!
2. Here goes nothing!
3. Fingers crossed!

**HANDOFF**

1. Your turn!
2. All yours!
3. Your go, friend!

**NERVOUS** 😰

1. Uh oh...
2. Sweating a little here!

**SHOCKED** 😲

1. No way!
2. Are you kidding me?!

**WINNING** 😎

1. Just as planned!
2. Boom!

**RELIEVED** 😮‍💨

1. Whew, close one!
2. Dodged a bullet.

**THINKING (status text):** Pip is thinking...

## Dottie 🤖

**DEFAULT (openers)**

1. Beep boop. Ready.
2. Rolling protocol engaged.

**NERVOUS**

1. Error margin rising...
2. Recalculating odds.

**SHOCKED**

1. Does not compute!
2. System error!

**WINNING**

1. Optimal outcome.
2. Processing victory.

**RELIEVED**

1. Crisis averted.
2. Cooling fans engaged.

**THINKING (status text):** Dottie is computing...

## Chance 🖐️

**DEFAULT (openers)** 🖐️

1. High five the dice!
2. Let 'em fly!

**NERVOUS** 🙏

1. Time for a miracle roll...
2. All in!

**SHOCKED** ✋

1. Luck just ran out...
2. Cold dice!

**WINNING** 🙌

1. Lady Luck smiles!
2. Pure magic!

**RELIEVED** 👍

1. Fate had my back!
2. Never doubted it.

**THINKING (status text):** Chance is shaking the dice...

## Nat 🎲

**DEFAULT (openers)** 🎲

1. Rolling for initiative!
2. Let's see what the dice gods decree.
3. Readying my action!
4. Time to roll the bones!
5. Let's check my luck modifier.
6. May the odds be in my favor.
7. Taking my action phase.
8. I get to add my Strength modifier, right?

**NERVOUS** 🛡️

1. Big bucks, no whammy's...
2. I get a bonus for Range, Hidden, Surprise and 'Bardic Inspiration', right?
3. Down to my last death save!
4. This roll determines everything!
5. Tense moment at the tabletop...
6. Need a high DC check to survive this!
7. Sweating this saving throw!
8. I'd like to buy a 7, please.

**SHOCKED** 💀

1. Nat 1... Critical failure!
2. Total fumble! The dice betray me!
3. Natural 1... well, that's tragic.
4. Do I get a 'Reaction' saving throw?
5. 'Roll a 1 phase' strikes again!
6. Trap sprung! Back to the tavern for me.
7. Where's that 'dice jail'?
8. Cursed dice! This is why I don't borrow dice.
9. That roll was a TPK!

**WINNING** 🎯

1. NAT 20! Critical Hit!
2. Maximum damage rolled!
3. That Strength modifier didn't let me down!
4. Ho! Ha ha! Guard! Turn! Parry! Dodge! Spin! Ha! Thrust!
5. That's a legendary action right there!
6. BOOM! And that's how it's done!
7. A roll fit for the bardic tales!
8. Clean hit! Add that to the tally!
9. The dice gods have blessed this roll!
10. YES! Cleave them baddies!

**RELIEVED** 🏆

1. Passed the saving throw by 1!
2. Whew, barely beat the DC!
3. Survived with 1 HP remaining!
4. Ho! Ha ha! Guard! Turn! Parry! Dodge! Spin! Ha! Thrust!
5. A clutch save right at the end!
6. The party survives another round!
7. Barely made it past that trap!
8. Good thing I upgraded my armor!
9. Phew! Kept the campaign alive.
10. A narrow escape from the abyss!

**THINKING (status text):** Nat is rolling for initiative... / Nat is consulting the strategy guide... / Nat is calculating the skill check DC... / Nat is weighing bonus actions... / Nat is reading the probability charts...

## Alea 🏛️

**DEFAULT (openers)**

1. The die is cast!
2. Fortune favors the bold.
3. Let us consult the oracle of chance.
4. Every roll is written in the stars.
5. Stepping into the arena of fate.
6. Wisdom guides the hand, but luck guides the die.
7. The wheel of fortune turns.
8. Let us play as the ancients did.
9. Time to make my decree.
10. A steady mind for an unpredictable roll.

**NERVOUS**

1. Standing at the edge of the Rubicon...
2. The scales of fortune tip precariously!
3. A pivotal moment in the campaign...
4. Tense times in the arena...
5. Fate hangs by a single thread.
6. Walking a dangerous tightrope.
7. May the heavens protect this roll...
8. High stakes demand immense courage.
9. Testing the limits of my destiny.
10. A trial by fire!

**SHOCKED**

1. Fortune is a fickle mistress...
2. Even Rome fell in a day.
3. A tragic twist of fate!
4. The omens were misunderstood...
5. Alas, hubris catches up with us all.
6. Defeated by the chaos of the dice.
7. A ruinous turn...
8. The gods have turned their backs!
9. A bitter pill prescribed by destiny.
10. Et tu, dice?

**WINNING**

1. By Jupiter's thunderbolts!
2. A triumph fit for an emperor!
3. The gods themselves smile upon this roll!
4. A divine intervention!
5. Veni, vidi, vici—I came, I saw, I conquered!
6. Fortune crowns the victorious!
7. A majestic turn for the history books!
8. Perfection dictated by destiny!
9. Ascending to the pantheon of high scores!
10. An absolute masterpiece of chance!

**RELIEVED**

1. Saved by the grace of Fortuna!
2. The storm passes without destruction.
3. A narrow salvation!
4. Fate spares me once more.
5. Dodged the wrath of the gods!
6. Restoring order from the brink of chaos.
7. A merciful turn.
8. Living to fight another era.
9. The omens aligned just in time.
10. Whew... disaster averted.

**THINKING (status text):** Alea is pondering fate... / Consulting the ancient scrolls... / Weighing the decrees of fortune... / Contemplating the geometry of chance... / Reading the omens... / Alea considers all outcomes... / Calculating the path to victory... / Seeking wisdom from the gods of luck... / Deliberating with classic composure... / Synthesizing probability and destiny...

## Snake 👁️

**DEFAULT (openers)** 👁️

1. I see everything.
2. Observing.
3. Noted. Proceeding.

**HANDOFF**

1. Your move.
2. Make it count.
3. The board is yours.

**NERVOUS** 👀

1. Proceeding carefully...
2. Not over yet.

**SHOCKED** 👄

1. A miscalculation...
2. Hmph.

**WINNING** 👁️‍🗨️

1. Calculated.
2. Predictable outcome.

**RELIEVED** 💓

1. Within expected margins.
2. Contingency held.
3. Risk absorbed.

**THINKING (status text):** Snake is pondering...

## Deuce 👽

**GREETING**

1. Greetings, human.

**DEFAULT (openers)**

1. Initiating roll sequence.
2. Engaging roll thrusters!
3. Preparing to roll, earthling.

**HANDOFF**

1. Take your turn, earthling.
2. The dice are yours, human.
3. Your orbit now.

**NERVOUS**

1. Turbulence ahead...
2. Gravity is pulling.

**SHOCKED**

1. Impossible!
2. Beam me up...

**WINNING**

1. Out of this world!
2. Interstellar!

**RELIEVED**

1. Escape velocity!
2. Home safe.

**THINKING (status text):** Deuce is scanning...

## Changes made after the review (Builds 88 and 89)

- Normal lines are said at the start of the turn, not the end; late reactions are dropped.
- Pip, Snake and Deuce's hand-off lines split from their openers, each group with two new lines in the bot's voice; Deuce's "Greetings, human." became a once-per-game greeting.
- Dottie: "Thermocouple engaged." became "Cooling fans engaged.".
- Snake RELIEVED: two new lines ("Contingency held.", "Risk absorbed.").
- Nat's repeated "Ho! Ha ha! Guard! Turn! Parry! Dodge! Spin! Ha! Thrust!" (WINNING and RELIEVED) is intentional and stays.
