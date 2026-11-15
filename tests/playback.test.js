import test from "node:test";
import assert from "node:assert/strict";
import { DriftMap } from "../drift-map.js";
import { driftClock } from "../drift.js";

function rendererStub() {
  // Exercise real staging methods without requiring a GPU in Node.
  const renderer = Object.create(DriftMap.prototype),
    requests = [];
  Object.assign(renderer, {
    ticket: 0,
    requests: 0,
    manifest: { europe: { bounds: [] } },
    async loadStage(age) {
      requests.push(age);
      return { from: age, to: age, map: { age }, owner: { age }, eu: { age } };
    },
    trim() {},
    native() {},
  });
  return { renderer, requests };
}

test("The next terrain cannot load before drift arrives; every winning era is carried forward", async () => {
  const { renderer, requests } = rendererStub();
  await renderer.prepare(300);
  assert.deepEqual(requests, [300]);
  for (const [from, to] of [
    [300, 225],
    [225, 150],
    [150, 75],
    [75, 0],
  ]) {
    renderer.beginDrift(to);
    assert.equal(renderer.stage.map.age, from);
    assert.equal(renderer.arrival, null);
    const clock = driftClock(from, to, 4500);
    clock(0);
    const midway = clock(2250);
    await assert.rejects(
      renderer.loadArrival(midway.age),
      /cannot load before/,
    );
    assert.equal(requests.at(-1), from);
    const arrival = clock(4500);
    assert.equal(arrival.done, true);
    assert.equal(renderer.stage.map.age, from);
    await renderer.loadArrival(arrival.age);
    // Loading arrival does not replace or move the departure layer.
    assert.equal(renderer.stage.map.age, from);
    assert.equal(renderer.arrival.map.age, to);
    renderer.commitArrival();
    assert.equal(renderer.stage.map.age, to);
    assert.equal(renderer.arrival, null);
  }
  assert.deepEqual(requests, [300, 225, 150, 75, 0]);
});

test("Reset invalidates an older arrival download", async () => {
  const { renderer } = rendererStub();
  await renderer.prepare(300);
  renderer.beginDrift(225);
  const load = renderer.loadStage.bind(renderer);
  let finish;
  renderer.loadStage = (age) =>
    age === 225
      ? new Promise((resolve) => {
          finish = () => load(age).then(resolve);
        })
      : load(age);
  const oldArrival = renderer.loadArrival(225);
  await renderer.prepare(300);
  finish();
  assert.equal(await oldArrival, false);
  assert.equal(renderer.stage.from, 300);
  assert.equal(renderer.arrival, null);
});
