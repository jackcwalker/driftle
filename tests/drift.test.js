import test from "node:test";
import assert from "node:assert/strict";
import { driftClock } from "../drift.js";
test("winning drift starts at the first frame and traverses all 300 Ma", () => {
  const frame = driftClock(300, 0, 18000);
  assert.deepEqual(frame(900000), { age: 300, done: false });
  assert.deepEqual(frame(904500), { age: 225, done: false });
  assert.deepEqual(frame(909000), { age: 150, done: false });
  assert.deepEqual(frame(913500), { age: 75, done: false });
  assert.deepEqual(frame(918000), { age: 0, done: true });
  assert.deepEqual(frame(999999), { age: 0, done: true });
});
test("a miss advances one era, and a clock regression never reverses drift", () => {
  const frame = driftClock(225, 150, 4500);
  frame(100);
  assert.equal(frame(2350).age, 187.5);
  assert.equal(frame(2000).age, 187.5);
  assert.deepEqual(frame(4600), { age: 150, done: true });
});
