import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rotationAvailable, vector, rotate } from "../geo.js";
import { rotationAt } from "../vendor/motion.js";
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = read("../data/motion.json"),
  terrain = read("../data/terrain-study.json");
test("Terrain snapshots retain source provenance and only claim two sampled ages", () => {
  assert.deepEqual(Object.keys(terrain.snapshots).sort(), ["0", "300"]);
  assert.match(terrain.source, /5460860/);
  assert.equal(terrain.license, "CC BY 4.0");
  for (const [age, s] of Object.entries(terrain.snapshots)) {
    assert.ok(s.features.length > 100);
    assert.ok(s.unmappedGridSites > 0);
    assert.match(s.sourceFile, new RegExp("_" + age + "Ma.nc$"));
  }
});
test("Every terrain patch inherits a source coastline plate and has finite, local date-line edges", () => {
  for (const s of Object.values(terrain.snapshots))
    for (const f of s.features) {
      assert.ok(
        data.features.some(
          (p) => p.pid === f.pid && p.begin === f.begin && p.end === f.end,
        ),
      );
      for (const r of f.rings) {
        assert.ok(r.length >= 4);
        assert.deepEqual(r[0], r.at(-1));
        for (let i = 0; i < r.length; i++) {
          const [lon, lat] = r[i];
          assert.ok(Number.isFinite(lon) && Number.isFinite(lat));
          assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 85);
          if (i)
            assert.ok(
              Math.abs(lon - r[i - 1][0]) <= 180,
              "no polygon shortcuts across date line",
            );
        }
      }
    }
});
test("Supported terrain material distances remain rigid through playback", () => {
  for (const f of terrain.snapshots["300"].features.filter(
    (f, i) => i % 50 === 0,
  )) {
    if (f.begin < 300 || f.end > 225) continue;
    const [a, b] = f.rings[0].slice(0, 2).map(vector),
      dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
      before = dot(a, b);
    for (const age of [300, 278.2, 250, 225]) {
      assert.ok(rotationAvailable(data, f.pid, age));
      const q = rotationAt(data, f.pid, age);
      assert.ok(Math.abs(dot(rotate(a, q), rotate(b, q)) - before) < 1e-7);
    }
  }
});
