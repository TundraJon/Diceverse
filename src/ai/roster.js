// The AI roster: seven opponents, each with a normal face, a thinking line and six moods (an emoji and spoken lines).
// Pure data plus one pure helper; nothing here touches the rules, the bot's decisions or the game RNG.
// Only Pip, Chance, Nat and Snake change face with their mood; Dottie, Alea and Deuce keep one face (their moods omit
// `emoji`) and only their lines change.
export const MOODS = ['THINKING', 'DEFAULT', 'WINNING', 'NERVOUS', 'SHOCKED', 'RELIEVED'];

export const AI_ROSTER = {
  pip: {
    id: "pip",
    name: "Pip",
    defaultEmoji: "🙂",
    thinkingText: "Pip is thinking...",
    moods: {
      THINKING: { emoji: "🤔", text: [
        "Pip is thinking...",
      ] },
      DEFAULT: { emoji: "🙂", text: [
        "Let's roll!",
        "Your turn!",
      ] },
      WINNING: { emoji: "😎", text: [
        "Just as planned!",
        "Boom!",
      ] },
      NERVOUS: { emoji: "😰", text: [
        "Uh oh...",
        "Sweating a little here!",
      ] },
      SHOCKED: { emoji: "😲", text: [
        "No way!",
        "Are you kidding me?!",
      ] },
      RELIEVED: { emoji: "😮‍💨", fallback: '\u{1F60C}', text: [
        "Whew, close one!",
        "Dodged a bullet.",
      ] },
    },
  },
  dottie: {
    id: "dottie",
    name: "Dottie",
    defaultEmoji: "🤖",
    thinkingText: "Dottie is computing...",
    moods: {
      THINKING: { text: [
        "Dottie is computing...",
      ] },
      DEFAULT: { text: [
        "Beep boop. Ready.",
        "Rolling protocol engaged.",
      ] },
      WINNING: { text: [
        "Optimal outcome.",
        "Processing victory.",
      ] },
      NERVOUS: { text: [
        "Error margin rising...",
        "Recalculating odds.",
      ] },
      SHOCKED: { text: [
        "Does not compute!",
        "System error!",
      ] },
      RELIEVED: { text: [
        "Crisis averted.",
        "Thermocouple engaged.",
      ] },
    },
  },
  chance: {
    id: "chance",
    name: "Chance",
    defaultEmoji: "🖐️",
    thinkingText: "Chance is shaking the dice...",
    moods: {
      THINKING: { emoji: "✊", text: [
        "Chance is shaking the dice...",
      ] },
      DEFAULT: { emoji: "🖐️", text: [
        "High five the dice!",
        "Let 'em fly!",
      ] },
      WINNING: { emoji: "🙌", text: [
        "Lady Luck smiles!",
        "Pure magic!",
      ] },
      NERVOUS: { emoji: "🙏", text: [
        "Time for a miracle roll...",
        "All in!",
      ] },
      SHOCKED: { emoji: "✋", text: [
        "Luck just ran out...",
        "Cold dice!",
      ] },
      RELIEVED: { emoji: "👍", text: [
        "Fate had my back!",
        "Never doubted it.",
      ] },
    },
  },
  nat: {
    id: "nat",
    name: "Nat",
    defaultEmoji: "🎲",
    thinkingText: "Nat is rolling for initiative...",
    moods: {
      THINKING: { emoji: "🔮", text: [
        "Nat is rolling for initiative...",
        "Nat is consulting the strategy guide...",
        "Nat is calculating the skill check DC...",
        "Nat is weighing bonus actions...",
        "Nat is reading the probability charts...",
      ] },
      DEFAULT: { emoji: "🎲", text: [
        "Rolling for initiative!",
        "Let's see what the dice gods decree.",
        "Readying my action!",
        "Time to roll the bones!",
        "Let's check my luck modifier.",
        "May the odds be in my favor.",
        "Taking my action phase.",
        "I get to add my Strength modifier, right?",
      ] },
      WINNING: { emoji: "🎯", text: [
        "NAT 20! Critical Hit!",
        "Maximum damage rolled!",
        "That Strength modifier didn't let me down!",
        "Ho! Ha ha! Guard! Turn! Parry! Dodge! Spin! Ha! Thrust!",
        "That's a legendary action right there!",
        "BOOM! And that's how it's done!",
        "A roll fit for the bardic tales!",
        "Clean hit! Add that to the tally!",
        "The dice gods have blessed this roll!",
        "YES! Cleave them baddies!",
      ] },
      NERVOUS: { emoji: "🛡️", text: [
        "Big bucks, no whammy's...",
        "I get a bonus for Range, Hidden, Surprise and 'Bardic Inspiration', right?",
        "Down to my last death save!",
        "This roll determines everything!",
        "Tense moment at the tabletop...",
        "Need a high DC check to survive this!",
        "Sweating this saving throw!",
        "I'd like to buy a 7, please.",
      ] },
      SHOCKED: { emoji: "💀", text: [
        "Nat 1... Critical failure!",
        "Total fumble! The dice betray me!",
        "Natural 1... well, that's tragic.",
        "Do I get a 'Reaction' saving throw?",
        "'Roll a 1 phase' strikes again!",
        "Trap sprung! Back to the tavern for me.",
        "Where's that 'dice jail'?",
        "Cursed dice! This is why I don't borrow dice.",
        "That roll was a TPK!",
      ] },
      RELIEVED: { emoji: "🏆", text: [
        "Passed the saving throw by 1!",
        "Whew, barely beat the DC!",
        "Survived with 1 HP remaining!",
        "Ho! Ha ha! Guard! Turn! Parry! Dodge! Spin! Ha! Thrust!",
        "A clutch save right at the end!",
        "The party survives another round!",
        "Barely made it past that trap!",
        "Good thing I upgraded my armor!",
        "Phew! Kept the campaign alive.",
        "A narrow escape from the abyss!",
      ] },
    },
  },
  alea: {
    id: "alea",
    name: "Alea",
    defaultEmoji: "🏛️",
    thinkingText: "Alea is pondering fate...",
    moods: {
      THINKING: { text: [
        "Alea is pondering fate...",
        "Consulting the ancient scrolls...",
        "Weighing the decrees of fortune...",
        "Contemplating the geometry of chance...",
        "Reading the omens...",
        "Alea considers all outcomes...",
        "Calculating the path to victory...",
        "Seeking wisdom from the gods of luck...",
        "Deliberating with classic composure...",
        "Synthesizing probability and destiny...",
      ] },
      DEFAULT: { text: [
        "The die is cast!",
        "Fortune favors the bold.",
        "Let us consult the oracle of chance.",
        "Every roll is written in the stars.",
        "Stepping into the arena of fate.",
        "Wisdom guides the hand, but luck guides the die.",
        "The wheel of fortune turns.",
        "Let us play as the ancients did.",
        "Time to make my decree.",
        "A steady mind for an unpredictable roll.",
      ] },
      WINNING: { text: [
        "By Jupiter's thunderbolts!",
        "A triumph fit for an emperor!",
        "The gods themselves smile upon this roll!",
        "A divine intervention!",
        "Veni, vidi, vici—I came, I saw, I conquered!",
        "Fortune crowns the victorious!",
        "A majestic turn for the history books!",
        "Perfection dictated by destiny!",
        "Ascending to the pantheon of high scores!",
        "An absolute masterpiece of chance!",
      ] },
      NERVOUS: { text: [
        "Standing at the edge of the Rubicon...",
        "The scales of fortune tip precariously!",
        "A pivotal moment in the campaign...",
        "Tense times in the arena...",
        "Fate hangs by a single thread.",
        "Walking a dangerous tightrope.",
        "May the heavens protect this roll...",
        "High stakes demand immense courage.",
        "Testing the limits of my destiny.",
        "A trial by fire!",
      ] },
      SHOCKED: { text: [
        "Fortune is a fickle mistress...",
        "Even Rome fell in a day.",
        "A tragic twist of fate!",
        "The omens were misunderstood...",
        "Alas, hubris catches up with us all.",
        "Defeated by the chaos of the dice.",
        "A ruinous turn...",
        "The gods have turned their backs!",
        "A bitter pill prescribed by destiny.",
        "Et tu, dice?",
      ] },
      RELIEVED: { text: [
        "Saved by the grace of Fortuna!",
        "The storm passes without destruction.",
        "A narrow salvation!",
        "Fate spares me once more.",
        "Dodged the wrath of the gods!",
        "Restoring order from the brink of chaos.",
        "A merciful turn.",
        "Living to fight another era.",
        "The omens aligned just in time.",
        "Whew... disaster averted.",
      ] },
    },
  },
  snake: {
    id: "snake",
    name: "Snake",
    defaultEmoji: "👁️",
    thinkingText: "Snake is pondering...",
    moods: {
      THINKING: { emoji: "🧠", text: [
        "Snake is pondering...",
      ] },
      DEFAULT: { emoji: "👁️", text: [
        "Your move.",
        "I see everything.",
      ] },
      WINNING: { emoji: "👁️‍🗨️", text: [
        "Calculated.",
        "Predictable outcome.",
      ] },
      NERVOUS: { emoji: "👀", text: [
        "Proceeding carefully...",
        "Not over yet.",
      ] },
      SHOCKED: { emoji: "👄", text: [
        "A miscalculation...",
        "Hmph.",
      ] },
      RELIEVED: { emoji: "💓", text: [
        "Within expected margins.",
      ] },
    },
  },
  deuce: {
    id: "deuce",
    name: "Deuce",
    defaultEmoji: "👽",
    thinkingText: "Deuce is scanning...",
    moods: {
      THINKING: { text: [
        "Deuce is scanning...",
      ] },
      DEFAULT: { text: [
        "Greetings, human.",
        "Take your turn, earthling.",
      ] },
      WINNING: { text: [
        "Out of this world!",
        "Interstellar!",
      ] },
      NERVOUS: { text: [
        "Turbulence ahead...",
        "Gravity is pulling.",
      ] },
      SHOCKED: { text: [
        "Impossible!",
        "Beam me up...",
      ] },
      RELIEVED: { text: [
        "Escape velocity!",
        "Home safe.",
      ] },
    },
  },
};

export const ROSTER_ORDER = ['pip', 'dottie', 'chance', 'nat', 'alea', 'snake', 'deuce'];

// Draw `count` different opponents at random. `words` are random uint32 values from the caller (the browser's secure
// generator); a Fisher-Yates shuffle over the roster ids with a rejection-free modulo is plenty for a cosmetic draw.
export function drawOpponents(count, words) {
  const ids = ROSTER_ORDER.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = words[ids.length - 1 - i] % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

// One random line for a mood that is not the same as the last one this bot said (when it has more than one).
export function pickLine(botId, mood, rand, last) {
  const lines = (AI_ROSTER[botId] && AI_ROSTER[botId].moods[mood] && AI_ROSTER[botId].moods[mood].text) || [];
  if (!lines.length) return '';
  const pool = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return pool[rand % pool.length];
}
