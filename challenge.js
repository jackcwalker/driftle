import { ages } from "./geo.js";
// Keep real picks separate from unplayed rounds: credit must never invent pins.
export function challengeOutcome(records) {
  const hit = records.findIndex((r) => r.inside);
  const guesses = records.slice(0, hit < 0 ? 5 : hit + 1);
  const rounds = guesses.map((r) => ({ ...r, automatic: false }));
  if (hit >= 0)
    for (let i = guesses.length; i < ages.length; i++)
      rounds.push({ age: ages[i], score: (5 - i) * 1000, automatic: true });
  return {
    guesses,
    rounds,
    finished: hit >= 0 || guesses.length === 5,
    total: rounds.reduce((sum, r) => sum + r.score, 0),
    solvedRound: hit >= 0 ? hit + 1 : null,
  };
}
