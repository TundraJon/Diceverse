// One scheduler owns every delay in the app so cancelAll() can kill stale callbacks
// on restart, quit-to-menu, and game over.
// scale multiplies every delay: 1 = normal, 0 = as fast as the event loop allows (testing only).
export function createScheduler({ scale = 1 } = {}) {
  const pending = new Set();
  let generation = 0;
  return {
    after(ms, fn) {
      const gen = generation;
      const id = setTimeout(() => {
        pending.delete(id);
        if (gen !== generation) return;
        fn();
      }, ms * scale);
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
