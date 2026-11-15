# Terrain in the playable game

The approved physical maps are now used at `/`, alongside the existing five-round
game, country-area scoring, numbered pins, navigation and final result overlay.
The static comparison route remains at `/terrain.html`.

## One geographic frame

Active terrain and plate reconstruction use the [PALEOMAP 2024 v24221 supplement](https://zenodo.org/records/10659112),
CC BY 4.0, attributed to Christopher R. Scotese, Christian Vérard, Landon Burgener,
Reece P. Elling and Ádám T. Kocsis. Full source filenames, attribution and raster
transformations remain in RASTER-MAPS.md. Modern elevation is NOAA NCEI ETOPO 2022;
modern natural lakes and country geometry are public-domain Natural Earth data.
Upstream MIT and older Müller CC BY notices remain intact.

`data/paleomap/motion.json`, `territories.json`, and `owners.json` share a model ID
and the SHA-256 of the exact source model archive used by the raster baker. The
game checks these against the raster manifest before accepting play. The older
Müller model is retained for regression tests but is not loaded by the game.

Country geometry is split across the published present-day static domains using
the existing great-circle densification and locally unwrapped intersection
framework. Overlap priority is descending plate ID; within the same ID the longer
supported domain is preferred. Domain lifetimes and missing rotations are respected.
In particular, source polygons marked `0..0` are not extended into the past.
Finite rotations are calculated with pyGPlates, anchor plate 0, every 5 Ma;
existing quaternion interpolation supplies intermediate motion for scoring/pins.
The territory file references the motion file's rotations to avoid duplicating
their download and decoded memory.

The pool now audits every one of the 258 country/territory features in the source,
using the existing 0.01% unsupported/unknown coordinate-area threshold. 247 are countries/territories under the source classification; 109 pass and
138 fail technical support checks. Eleven leases/uncoded indeterminate features
are outside the target scope. No size or difficulty filter is applied. `country-support.json` records the exact fractions and reasons;
COUNTRY-POOL.md describes the policy. Each eligible country's original full geometry
and partition are stored in a separate bundle; only the selected bundle downloads.
Modern 0 Ma scoring still uses the complete modern country, including islands and
holes. Ancient target area can be underwater: these are modern territorial material
locations, not ancient countries or a guarantee of dry land.

Saves use `driftle-paleomap-v2-<UTC date>`. The earlier Müller save is retained in
browser storage but is not reinterpreted under a different model. Saved missed-guess
pin attachments are validated against the matching model on reload, independently
of which owner textures are currently resident. Daily selection
cycles evenly through the 109 eligible entries in stable ID order. Saves also check
the selected country ID, so a changed pool cannot reinterpret another target's picks. Random testing does not overwrite
the daily save.

## Endpoint quality and playback

At each guessing stop, the full native atlas is drawn directly in Equal Earth.
There is no clipping to modern coastlines, static plate coverage or a triangle
mesh. The 0 Ma map includes the sharper Europe inset when zoomed in. Only final
results add modern country boundaries and translucent gold target highlighting.
Rivers remain removed. Modern natural lakes appear at Today.

During each 75 Ma transition, the current landscape is carried forward. A screen
fragment is inverse-rotated from the current plate orientation to modern material
coordinates, then forward-rotated into the **departure** texture coordinates. This
is the same quaternion convention used by countries and pins. Categorical source
owner masks restrict transported land to supported published domains. Longitude
repeats across the date line; latitude clamps at the poles. The inverse fragment
projection avoids triangles stretching across the seam. Conservative plate bounds
reduce overdraw.

The destination atlas is neither requested nor shown during this movement. The
renderer rejects an arrival load before the geological clock reaches the endpoint.
Once it arrives, the moved departure landscape stays on screen while the endpoint
loads. The native atlas then settles in over 320 ms **at the fixed arrival age**,
before guessing or the next segment begins. Only the source landscape moves;
there are no destination continents fading underneath it. This replaces the earlier
two-endpoint/native-underlay crossfade.

Unsupported departure geography fades out over the first 5.5% of the segment and
receives no invented rotation. A quiet ocean lies behind transported land. Gaps
and overlaps between rigid pieces remain visible; we do not fill them using guessed
plates or ghosted destination geography. Intermediate landscapes carry published
source terrain; they are not newly inferred elevation or exact reconstructions
published at every animation age. Native endpoint shorelines and scoring geometry
remain intact.

Depending on age, roughly 87.6–92.3% of ancient exposed land has a supported raster
transport assignment in this preparation; about 99.95% of modern exposed land does.
Unassigned geography is retained in the exact native maps at guessing stops,
and fades during motion without invented rotation. High-latitude raster cells beyond a 0.15° boundary allowance are removed
when they fail the original spherical domain check. `owner-audit.json` records
3,000 sampled owned cells per age, checked independently with pyGPlates against
the original spherical domains, allowing 0.22° for categorical raster boundaries.
All 15,000 audited cells pass. This is a registration check, not independent
validation of the geological model.

A correct guess secures remaining points immediately and plays every intervening
era to 0 Ma before results. Reset invalidates pending loads and animation callbacks.
Reloading an unfinished daily win replays from the successful guess's era. No extra
pins are created for automatically awarded rounds.

## Performance and limits

During movement the browser keeps the departure atlas and its R8 owner texture.
A single temporary RGBA layer uses CSS-pixel resolution; exact guessing stops
retain sharper device-resolution rendering. The next atlas/owner (and Europe inset
at 0 Ma) load only after arrival, coexist briefly for the settle, then replace the
departure assets. No future-era image prefetch remains.
Terrain detail does not increase geometry count. Duplicate requests share downloads.
Main-canvas DPR is capped at 2 on desktop and 1.5 on narrow screens.

WebGL2 is required. Context-loss recovery reloads the selected daily state and can
replay an unfinished daily win; random testing state is not persisted. Actual
physical-phone performance and forced context-loss recovery remain unverified.
Ancient source resolution, quantified palette and reconstruction uncertainty still
limit deduction at close zoom. All data is client-side and inspectable; no backend,
anti-cheat, analytics, accounts, purchased service or deployment is introduced.

## Reproduce and verify

Bake the raster inputs as in RASTER-MAPS.md, then use the same Python environment
and source directory:

```sh
python scripts/prepare-game-maps.py SOURCE_DIRECTORY COUNTRIES_GEOJSON
# To rebuild only the pool, partitions and model metadata (keep existing masks):
python scripts/prepare-game-maps.py SOURCE_DIRECTORY COUNTRIES_GEOJSON --countries-only
python scripts/audit-game-maps.py SOURCE_DIRECTORY
npm test
```

Source archives and scientific Python tools are preparation-only dependencies.
Generated game assets are committed. `npm start` serves the game without a build.
Tests cover model/archive consistency, target reference coordinate agreement,
full-country scoring, pin arrivals, inverse texture warps, categorical mask hashes,
and pole/date-line draw bounds, alongside the previous scoring/motion regressions.
Browser verification and measured playback results are in TESTING.md.
