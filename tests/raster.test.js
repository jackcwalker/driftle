import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import {
  equalEarthRaw,
  equalEarthInverse,
  EQUAL_EARTH_BOUNDS,
} from "../map-projection.js";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root));
const manifest = JSON.parse(read("data/maps/raster-v2/manifest.json"));
const context = {};
vm.runInNewContext(read("vendor/d3.min.js").toString(), context);

test("GPU projection reference agrees with D3 across poles and date line", () => {
  const d3 = context.d3.geoEqualEarth().scale(1).translate([0, 0]);
  const radians = Math.PI / 180;
  for (const lon of [-180, -179.99, -120, -30, 0, 45, 179.99, 180]) {
    for (const lat of [-90, -89.99, -60, -30, 0, 45, 89.99, 90]) {
      const p = equalEarthRaw(lon * radians, lat * radians);
      const expected = d3([lon, lat]);
      assert.ok(Math.abs(p[0] - expected[0]) < 1e-12);
      assert.ok(Math.abs(p[1] + expected[1]) < 1e-12);
      const inverse = equalEarthInverse(...p);
      assert.ok(Math.abs(inverse[0] / radians - lon) < 1e-8);
      assert.ok(Math.abs(inverse[1] / radians - lat) < 1e-5);
    }
  }
  assert.ok(EQUAL_EARTH_BOUNDS.every(Number.isFinite));
});

test("All five endpoint rasters are bundled with verified dimensions and hashes", () => {
  assert.deepEqual(manifest.ages, [300, 225, 150, 75, 0]);
  assert.match(
    manifest.registration,
    /pixel centres.*no duplicate seam column/,
  );
  const assets = [
    manifest.water,
    manifest.europe.texture,
    manifest.europe.overview,
  ];
  for (const age of manifest.ages) {
    const snapshot = manifest.snapshots[age];
    assert.equal(snapshot.full.width, 3600);
    assert.equal(snapshot.full.height, 1800);
    assert.equal(snapshot.overview.width, 1800);
    assert.equal(snapshot.overview.height, 900);
    assets.push(snapshot.full, snapshot.overview);
    if (age)
      assert.match(
        snapshot.sourceFile,
        new RegExp(`^${String(age).padStart(3, "0")}_.*\\.nc$`),
      );
  }
  for (const asset of assets) {
    const data = read(asset.url);
    assert.equal(data.length, asset.bytes);
    assert.equal(createHash("sha256").update(data).digest("hex"), asset.sha256);
    if (asset.url.endsWith(".webp")) {
      assert.equal(data.toString("ascii", 0, 4), "RIFF");
      assert.equal(data.toString("ascii", 8, 12), "WEBP");
      assert.equal(data.toString("ascii", 12, 16), "VP8 ");
      assert.equal(data.readUInt16LE(26) & 0x3fff, asset.width);
      assert.equal(data.readUInt16LE(28) & 0x3fff, asset.height);
    }
  }
  assert.deepEqual(manifest.europe.bounds, [-20, 30, 50, 72]);
  assert.ok(
    manifest.sources.some(
      (s) => s.license === "CC BY 4.0" && s.url.includes("10659112"),
    ),
  );
  assert.ok(
    Object.values(manifest.inputHashes).every((hash) =>
      /^[a-f0-9]{64}$/.test(hash),
    ),
  );
});

test("Modern water overlay contains natural lakes without names or river lines", () => {
  const water = JSON.parse(read(manifest.water.url));
  assert.equal(water.features.length, manifest.water.features);
  for (const f of water.features) {
    assert.equal(f.properties.kind, "lakes");
    assert.ok(["Polygon", "MultiPolygon"].includes(f.geometry.type));
    assert.deepEqual(Object.keys(f.properties).sort(), [
      "kind",
      "minZoom",
      "rank",
    ]);
  }
});

test("Europe comparison camera has supported references at all five ages", () => {
  const references = JSON.parse(
    read("data/maps/raster-v2/europe-reference.json"),
  );
  for (const age of manifest.ages) {
    assert.equal(references[age].length, 9);
    assert.ok(references[age].flat().every(Number.isFinite));
  }
  assert.ok(Math.abs(references[0][4][0] - 15) < 1e-8);
  assert.ok(Math.abs(references[0][4][1] - 50) < 1e-8);
  assert.ok(Math.abs(references[300][4][1] - references[0][4][1]) > 40);
});
