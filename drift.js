// Use a single animation-frame clock: frame timestamps can precede the event
// handler's performance.now() on a busy frame. Start on the first drawn frame.
export function driftClock(from, to, duration) {
  let start;
  let progress = 0;
  return (now) => {
    start ??= now;
    progress = Math.max(
      progress,
      duration > 0 ? Math.min(1, Math.max(0, (now - start) / duration)) : 1,
    );
    return {
      age: progress === 1 ? to : from + (to - from) * progress,
      done: progress === 1,
    };
  };
}
