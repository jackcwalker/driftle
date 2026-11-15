import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  position,
  distance,
  points,
  dailyIndex,
  vector,
  rotate,
  lonlat,
  renderRings,
  recordGuess,
  attachPin,
  pinPosition,
  feedback,
  bearing,
} from "../geo.js";
import { rotationAt, slerp } from "../vendor/motion.js";
const data = JSON.parse(
  fs.readFileSync(new URL("../data/motion.json", import.meta.url)),
);
const countries = JSON.parse(
  fs.readFileSync(new URL("../data/countries.json", import.meta.url)),
);
const places = JSON.parse(
  fs.readFileSync(new URL("../data/places.json", import.meta.url)),
);
const scope = {};
vm.runInNewContext(
  fs.readFileSync(new URL("../vendor/d3.min.js", import.meta.url), "utf8"),
  scope,
);
const d3 = scope.d3;
test("country interior points really fall inside modern country polygons", () => {
  for (const c of countries)
    assert.ok(
      d3.geoContains({ type: "Feature", geometry: c.geometry }, c.point),
      c.name,
    );
});
test("all curated country points match independent bundled GPlates samples within 100m", () => {
  const indices = [2, 4, 6, 1, 0, 3];
  countries.forEach((c, i) => {
    for (const age of [0, 160, 200, 240, 260, 300])
      assert.ok(
        distance(position(data, c, age), places.coordinates[age][indices[i]]) <
          0.1,
        `${c.name} at ${age}`,
      );
  });
});
test("every age produces finite supported positions, unsupported plates return null", () => {
  for (const c of countries)
    for (let a = 0; a <= 300; a += 0.5)
      assert.ok(position(data, c, a).every(Number.isFinite));
  assert.equal(position(data, { pid: 999999, point: [0, 0] }, 300), null);
  assert.equal(position(data, countries[0], 301), null);
});
test("great-circle distance wraps the date line and handles antipodes", () => {
  assert.ok(Math.abs(distance([179, 0], [-179, 0]) - 222.39) < 0.1);
  assert.ok(Math.abs(distance([0, 0], [180, 0]) - 20015.09) < 0.1);
  assert.equal(distance([0, 0], [0, 0]), 0);
});
test("quaternion sign, unit length and smooth sphere rotation", () => {
  const q = slerp([1, 0, 0, 0], [-1, 0, 0, 0], 0.5);
  assert.ok(Math.abs(q[0] - 1) < 1e-10);
  assert.ok(distance(lonlat(rotate(vector([179, 35]), q)), [179, 35]) < 0.001);
});
test("daily selection stable and score rewards accuracy and early guesses", () => {
  assert.equal(dailyIndex("2026-11-15", 6), dailyIndex("2026-11-15", 6));
  assert.notEqual(dailyIndex("2026-11-15", 6), dailyIndex("2026-11-16", 6));
  assert.equal(points(0, 0), 5000);
  assert.equal(points(0, 4), 1000);
  assert.ok(points(500, 0) > points(1500, 0));
});
test("projection clips antimeridian without a path across the map interior", () => {
  const p = d3
    .geoEqualEarth()
    .rotate([0, 0.01])
    .scale(100)
    .translate([320, 180]);
  let moves = 0;
  const context = {
    moveTo() {
      moves++;
    },
    lineTo() {},
    closePath() {},
  };
  d3.geoPath(
    p,
    context,
  )({
    type: "LineString",
    coordinates: [
      [170, 10],
      [-170, 10],
    ],
  });
  assert.equal(moves, 2);
  for (const point of [
    [179, 20],
    [-179, -20],
    [0, 0],
  ])
    assert.ok(distance(p.invert(p(point)), point) < 0.001);
});

test("polar source polygons do not flood the world at any 5 Ma sample", () => {
  const projection = d3.geoEqualEarth().rotate([0, 0.01]).scale(100);
  const path = d3.geoPath(projection);
  const sphereArea = path.area({ type: "Sphere" });
  for (const f of data.features) {
    let rings = renderRings(f.rings);
    if (d3.geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI)
      rings = rings.map((r) => [...r].reverse());
    const vectors = rings.map((r) => r.map(vector));
    for (let age = 0; age <= 300; age += 5) {
      if (age > f.begin || age < f.end) continue;
      const q = rotationAt(data, f.pid, age);
      const area = path.area({
        type: "Polygon",
        coordinates: vectors.map((r) => r.map((v) => lonlat(rotate(v, q)))),
      });
      assert.ok(
        area < sphereArea * 0.7,
        `Plate ${f.pid}, ${age} Ma floods the map`,
      );
    }
  }
});

test("recorded guesses are immutable snapshots and reload recomputes identical scores", () => {
  const cursor = [0, 0];
  const first = recordGuess(data, countries[0], cursor, 0);
  cursor[0] = 40;
  cursor[1] = 20;
  assert.deepEqual(first.guess, [0, 0]);
  const loaded = JSON.parse(JSON.stringify(first));
  assert.deepEqual(recordGuess(data, countries[0], loaded.guess, 0), first);
});

test("land pin is inverse-partitioned at 300 Ma and follows the correct plate to today", () => {
  const model = structuredClone(data);
  for (const f of model.features) {
    f.rings = renderRings(f.rings);
    if (d3.geoArea({ type: "Polygon", coordinates: f.rings }) > 2 * Math.PI)
      f.rings = f.rings.map((r) => r.toReversed());
  }
  const c = countries[0],
    clicked = position(model, c, 300);
  const attachment = attachPin(model, clicked, 300, d3.geoContains);
  assert.ok(attachment);
  assert.equal(attachment.pid, c.pid);
  const pin = { guess: clicked, attachment };
  for (const a of [300, 275, 225, 150, 75, 0])
    assert.ok(
      distance(pinPosition(model, pin, a).point, position(model, c, a)) < 0.001,
    );
  assert.ok(
    distance(
      pinPosition(model, pin, 300).point,
      pinPosition(model, pin, 0).point,
    ) > 1000,
  );
  assert.equal(attachPin(model, [0, 0], 0, d3.geoContains), null);
  assert.deepEqual(
    pinPosition(model, { guess: [0, 0], attachment: null }, 75),
    { point: [0, 0], moving: false },
  );
});
test("feedback gives distance-based verdict, score, direction and improvement", () => {
  assert.equal(bearing([0, 0], [10, 0]), "east");
  assert.equal(bearing([179, 0], [-179, 0]), "east");
  const f = feedback(
    { distance: 500, score: 3000, age: 225, bearing: "east" },
    { distance: 900 },
  );
  assert.match(f.title, /trail/);
  assert.match(f.detail, /400 km closer/);
  assert.match(f.detail, /east/);
  assert.match(f.earned, /3,000/);
  assert.match(
    feedback({ distance: 100, score: 4900, age: 300 }).title,
    /nailed/,
  );
});

test("final modern country overlay contains all six targets and clips without global fill", () => {
  const world = JSON.parse(
    fs.readFileSync(new URL("../data/modern-countries.json", import.meta.url)),
  );
  const path = d3.geoPath(d3.geoEqualEarth().rotate([0, 0.01]).scale(100));
  const area = path.area({ type: "Sphere" });
  for (const f of world.features) {
    f.geometry.coordinates = f.geometry.coordinates.map((rings) => {
      let r = renderRings(rings);
      if (d3.geoArea({ type: "Polygon", coordinates: r }) > 2 * Math.PI)
        r = r.map((ring) => ring.toReversed());
      return r;
    });
    assert.ok(path.area(f) < area * 0.7, f.properties.name);
  }
  for (const c of countries) {
    const feature = world.features.find((f) => f.properties.name === c.name);
    assert.ok(feature, c.name);
    assert.ok(d3.geoContains(feature, c.point), c.name);
  }
});
