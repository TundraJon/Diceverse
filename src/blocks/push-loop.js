// Push-your-luck turn loop block. The loop is shared; each game supplies the hooks:
//   rollDice(state, rng)        -> dice values for one roll
//   resolve(dice, state)        -> { gain, bust, resetTotal }
// The loop tracks turn points, applies bust/bank, and reports events.
export function createPushLoop(hooks) {
  return {
    freshTurn: () => ({ points: 0, rolls: 0, dice: [] }),

    roll(state, rng, events) {
      const dice = hooks.rollDice(state, rng);
      const res = hooks.resolve(dice, state);
      state.turn.dice = dice;
      state.turn.rolls += 1;
      events.push({ type: 'ROLLED', seat: state.current, dice });
      if (res.bust) {
        this.bust(state, events, { resetTotal: res.resetTotal });
        return { ended: true };
      }
      state.turn.points += res.gain;
      events.push({ type: 'SCORED', seat: state.current, gain: res.gain, turnPoints: state.turn.points });
      return { ended: false };
    },

    // Shared bust: lose the turn points (and optionally the whole total), emit an event.
    bust(state, events, { type = 'BUSTED', resetTotal = false } = {}) {
      const lost = state.turn.points;
      state.turn.points = 0;
      if (resetTotal) state.seats[state.current].total = 0;
      events.push({ type, seat: state.current, lost, reset: !!resetTotal });
    },

    bank(state, events) {
      const seat = state.seats[state.current];
      const amount = state.turn.points;
      seat.total += amount;
      state.turn.points = 0;
      events.push({ type: 'BANKED', seat: state.current, amount, total: seat.total });
    },
  };
}
