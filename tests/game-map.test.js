import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import {
  vector,
  rotate,
  lonlat,
  distance,
  position,
  recordGuess,
  pinPosition,
  supportedRotationAt,
  attachPin,
  restoreGuess,
} from "../geo.js";
import {
  endpointPoint,
  plateSamples,
  plateScissor,
  eraPair,
} from "../raster-drift.js";
import { equalEarthRaw } from "../map-projection.js";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url));
const json = (p) => JSON.parse(read(p));
const data = json("data/paleomap/motion.json");
data.territories = json("data/paleomap/territories.json");
data.territories.rotations = data.rotations;
const owners = json("data/paleomap/owners.json");
const manifest = json("data/maps/raster-v2/manifest.json");
const catalogue = json("data/paleomap/countries.json");
const report = json("data/paleomap/country-support.json");
const bundles = catalogue.filter((c) => c.eligible).map((c) => json(c.url));
const countries = bundles.map((b) => b.country);
data.territories.countries = bundles.map((b) => b.territory);
const context = {};
vm.runInNewContext(read("vendor/d3.min.js").toString(), context);
const d3 = context.d3;
for (const c of countries)
  c.pid = data.placeAssignments.find((p) => p.name === c.name).pid;
for (const c of data.territories.countries)
  for (const p of c.parts)
    if (d3.geoArea({ type: "Polygon", coordinates: p.rings }) > 2 * Math.PI)
      p.rings = p.rings.map((r) => r.toReversed());
const eligible = data.territories.countries.filter(
  (t) => (t.unpartitionedArea + t.unsupportedArea) / t.sourceArea < 0.0001,
);

test("Terrain, masks, country scoring and pins share the exact published model bundle", () => {
  assert.equal(data.model, data.territories.model);
  assert.equal(data.model, owners.model);
  for (const dataset of [data, data.territories, owners])
    assert.equal(
      dataset.inputModelSHA256,
      manifest.inputHashes["paleomap2024-model.zip"],
    );
  assert.equal(eligible.length, 109);
  assert.equal(catalogue.length, 258);
  assert.equal(report.countries.length, catalogue.length);
  assert.equal(report.inputModelSHA256, data.inputModelSHA256);
  for (const bundle of bundles) {
    assert.equal(bundle.inputModelSHA256, data.inputModelSHA256);
    assert.equal(bundle.inputCountrySHA256, report.inputCountrySHA256);
    assert.equal(bundle.country.name, bundle.territory.name);
    assert.equal(bundle.license, "CC BY 4.0 + Natural Earth public domain");
  }
  for (const entry of catalogue) {
    const audit = report.countries.find((c) => c.id === entry.id);
    assert.equal(
      entry.eligible,
      audit.targetUnit &&
        audit.unsupportedFraction < report.maximumUnsupportedFraction &&
        audit.sourceArea > 0,
    );
    assert.equal(entry.eligible, entry.reasons.length === 0);
    assert.equal(entry.eligible, Boolean(entry.url));
  }
  assert.equal(
    report.inputCountrySHA256,
    "392a03db8aa3ba82c105852655620129b11182b95dfc34ef046827ea7d0e5b8c",
  );
  assert.ok(data.features.some((f) => f.begin === 0 && f.end === 0));
  for (const t of eligible)
    for (const p of t.parts)
      if (p.begin >= 300 && p.end <= 0)
        for (const age of data.times)
          assert.ok(
            supportedRotationAt(data, p.pid, age).every(Number.isFinite),
          );
});

test("All supported targets match pyGPlates endpoint coordinates, score correctly and carry the pin to today", () => {
  for (const t of eligible) {
    const country = countries.find((c) => c.name === t.name);
    const geometry = country.geometry;
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    for (const rings of polygons)
      if (d3.geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI)
        for (const r of rings) r.reverse();
    for (const [i, age] of [300, 225, 150, 75, 0].entries()) {
      const expected = data.references[country.name][age];
      assert.ok(distance(position(data, country, age), expected) < 0.01);
      const result = recordGuess(data, country, expected, i, d3.geoContains);
      assert.equal(result.inside, true, `${country.name} at ${age}`);
      assert.equal(result.score, (5 - i) * 1000);
      if (age) {
        result.attachment = result.territoryAttachment;
        assert.ok(result.attachment);
        assert.ok(
          distance(pinPosition(data, result, 0).point, country.point) < 0.01,
        );
      }
    }
  }
});

test("Raster inverse warps and country rotations track the same material across the date line", () => {
  for (const pid of [101, 201, 301, 501, 701, 801, 901])
    for (const age of [287.5, 212.5, 137.5, 37.5]) {
      const q = supportedRotationAt(data, pid, age);
      for (const modern of [
        [179.9, 35],
        [-179.9, -40],
        [15, 50],
        [0, 89.9],
      ]) {
        const current = lonlat(rotate(vector(modern), q));
        for (const end of eraPair(age)) {
          const endQ = supportedRotationAt(data, pid, end);
          const expected = lonlat(rotate(vector(modern), endQ));
          assert.ok(distance(endpointPoint(current, q, endQ), expected) < 0.01);
        }
      }
    }
});

test("Reload preserves validated missed-guess pin attachments without loading historical owner textures", () => {
  const country = countries.find((c) => c.name === "Brazil");
  const pick = data.references["United States of America"][225];
  const saved = recordGuess(data, country, pick, 1, d3.geoContains);
  saved.attachment = attachPin(data, pick, 225, d3.geoContains);
  assert.ok(saved.attachment);
  const restored = restoreGuess(
    data,
    country,
    JSON.parse(JSON.stringify(saved)),
    1,
    d3.geoContains,
  );
  assert.equal(restored.inside, false);
  assert.deepEqual(restored.attachment, saved.attachment);
  assert.ok(distance(pinPosition(data, restored, 0).point, [-100, 40]) < 0.01);
  assert.equal(
    restoreGuess(
      data,
      country,
      { ...saved, attachment: null },
      1,
      d3.geoContains,
    ).attachment,
    null,
  );
});

test("Date-line and pole interiors remain inside conservative GPU draw bounds", () => {
  const view = { scale: 100, translate: [320, 180] },
    identity = [1, 0, 0, 0];
  for (const [rings, interior] of [
    [
      [
        [
          [179, -5],
          [179, 5],
          [-179, 5],
          [-179, -5],
          [179, -5],
        ],
      ],
      [
        [180, 0],
        [-179.5, 2],
      ],
    ],
    [
      [
        [
          [0, 80],
          [90, 80],
          [180, 80],
          [-90, 80],
          [0, 80],
        ],
      ],
      [
        [0, 90],
        [160, 88],
      ],
    ],
  ]) {
    const samples = plateSamples([{ pid: 1, rings }]).get(1);
    const b = plateScissor(samples, identity, view, 640, 360);
    assert.ok(b);
    for (const [lon, lat] of interior) {
      const p = equalEarthRaw((lon * Math.PI) / 180, (lat * Math.PI) / 180);
      const x = p[0] * view.scale + 320,
        y = -p[1] * view.scale + 180;
      assert.ok(x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]);
    }
  }
});

test("Transport masks retain unmatched land, valid PNG dimensions and exact file hashes", () => {
  for (const [age, entry] of Object.entries(owners.ages)) {
    assert.ok(
      entry.areaWeightedLandCoverage > 0.8 &&
        entry.areaWeightedLandCoverage < 1,
    );
    for (const name of ["full", "overview"]) {
      const asset = entry[name],
        bytes = read(asset.url);
      assert.equal(bytes.readUInt32BE(16), asset.width);
      assert.equal(bytes.readUInt32BE(20), asset.height);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        asset.sha256,
      );
    }
    for (const index of entry.indices) {
      const pid = owners.indexToPid[index];
      assert.ok(
        data.features.some(
          (f) => f.pid === pid && age <= f.begin && age >= f.end,
        ),
      );
    }
  }
});
