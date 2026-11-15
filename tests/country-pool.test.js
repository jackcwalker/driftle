import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { supportedCountries, dailyCountry } from "../country-pool.js";
const catalogue = JSON.parse(
  fs.readFileSync(new URL("../data/paleomap/countries.json", import.meta.url)),
);

test("Every audited country enters the daily rotation equally; exclusions have a technical reason", () => {
  const pool = supportedCountries(catalogue);
  const seen = new Set();
  for (let day = 0; day < pool.length; day++) {
    const date = new Date(Date.UTC(2026, 0, 1 + day))
      .toISOString()
      .slice(0, 10);
    const first = dailyCountry(date, catalogue);
    assert.equal(first.id, dailyCountry(date, catalogue).id);
    seen.add(first.id);
  }
  assert.equal(seen.size, pool.length);
  for (const c of catalogue.filter((c) => !c.eligible))
    assert.ok(c.reasons.length);
  for (const name of ["Vatican", "Monaco", "Liechtenstein", "San Marino"]) {
    const entry = pool.find((c) => c.name === name);
    assert.ok(entry, `${name} must not be excluded for size`);
  }
});
