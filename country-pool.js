import { dailyIndex } from "./geo.js?v=terrain-game6";

// Eligibility comes entirely from the offline geometry/rotation audit.
export function supportedCountries(catalogue) {
  return catalogue.filter((c) => c.eligible === true);
}
export function dailyCountry(date, catalogue) {
  const pool = supportedCountries(catalogue);
  if (!pool.length)
    throw Error("No supported country territory for this challenge");
  return pool[dailyIndex(date, pool.length)];
}
