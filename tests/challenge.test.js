import test from "node:test";
import assert from "node:assert/strict";
import { challengeOutcome } from "../challenge.js";
const pick = (age, score, inside = false) => ({
  age,
  score,
  inside,
  guess: [0, 0],
});
test("first correct pick secures 15,000 and no invented pins", () => {
  const r = challengeOutcome([pick(300, 5000, true)]);
  assert.equal(r.finished, true);
  assert.equal(r.total, 15000);
  assert.equal(r.solvedRound, 1);
  assert.equal(r.guesses.length, 1);
  assert.equal(r.rounds.filter((x) => x.automatic).length, 4);
  assert.ok(r.rounds.slice(1).every((x) => !("guess" in x)));
});
test("later success keeps earlier deductions and awards the remaining maxima", () => {
  const r = challengeOutcome([pick(300, 400), pick(225, 4000, true)]);
  assert.equal(r.total, 10400);
  assert.equal(r.guesses.length, 2);
  assert.deepEqual(
    r.rounds.map((x) => x.score),
    [400, 4000, 3000, 2000, 1000],
  );
});
test("misses keep playing until five actual attempts", () => {
  assert.equal(challengeOutcome([pick(300, 200)]).finished, false);
  const r = challengeOutcome([300, 225, 150, 75, 0].map((a) => pick(a, 100)));
  assert.equal(r.finished, true);
  assert.equal(r.total, 500);
  assert.equal(
    r.rounds.some((x) => x.automatic),
    false,
  );
});
test("old saved games stop at the first success instead of retaining duplicate picks", () => {
  const saved = [pick(300, 5000, true), pick(225, 4000, true), pick(150, 100)];
  const copy = JSON.stringify(saved);
  const r = challengeOutcome(saved);
  assert.equal(r.guesses.length, 1);
  assert.equal(r.total, 15000);
  assert.equal(JSON.stringify(saved), copy);
});
