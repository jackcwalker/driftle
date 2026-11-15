import test from "node:test";
import assert from "node:assert/strict";
import { zoomAround, panBy, wheelIntent } from "../navigation.js";
test("pinch zoom preserves the geographic point under the fingers", () => {
  const view = { k: 2, x: -100, y: -50 },
    anchor = [300, 200],
    next = zoomAround(view, anchor, 1.4);
  assert.ok(
    Math.abs((anchor[0] - view.x) / view.k - (anchor[0] - next.x) / next.k) <
      1e-10,
  );
  assert.ok(
    Math.abs((anchor[1] - view.y) / view.k - (anchor[1] - next.y) / next.k) <
      1e-10,
  );
  assert.equal(zoomAround(view, anchor, 100).k, 8);
  assert.equal(zoomAround(view, anchor, 0.001).k, 1);
});
test("two-finger wheel scroll pans on both axes; ctrl pinch zooms", () => {
  assert.deepEqual(wheelIntent({ deltaX: 18, deltaY: -30, deltaMode: 0 }), {
    kind: "pan",
    dx: 18,
    dy: -30,
  });
  assert.deepEqual(panBy({ k: 2, x: 50, y: 60 }, 18, -30), {
    k: 2,
    x: 32,
    y: 90,
  });
  assert.ok(
    wheelIntent({ deltaY: -20, deltaMode: 0, ctrlKey: true }).factor > 1,
  );
  assert.equal(wheelIntent({ deltaX: 0, deltaY: 3, deltaMode: 1 }).dy, 48);
});
