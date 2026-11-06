// One scheduler owns every delay in the app so cancelAll() can kill stale callbacks
// on restart, quit-to-menu, and game over.
export function createScheduler() {
  const pending = new Set();
  let generation = 0;
  return {
    after(ms, fn) {
      const gen = generation;
      const id = setTimeout(() => {
        pending.delete(id);
        if (gen !== generation) return;
        fn();
      }, ms);
      pending.add(id);
      return id;
    },
    cancelAll() {
      generation++;
      pending.forEach(clearTimeout);
      pending.clear();
    },
    get size() {
      return pending.size;
    },
  };
}
