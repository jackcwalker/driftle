# Driftle

A local, responsive daily continental-drift geography game for driftle.games.

## Run

Requires Python 3 and a current browser with WebGL2. No install or build step.

```sh
git clone https://github.com/jackcwalker/driftle.git
cd driftle
python3 -m http.server 4173
```

Open http://localhost:4173 . All assets are bundled: no API keys, CDN or live
reconstruction service is required. Stop the server with Ctrl-C.

## Play

The country name is shown immediately. Click where it was at 300 Ma,
then Pick. A correct pick secures full points for every remaining round, then the drift
continues smoothly all the way to today before showing final results. No further
picks are needed during this final journey. Earlier misses keep their original scores. Otherwise watch
75 million years of drift and try again at 225, 150, 75 and 0 Ma.
The target country stays the same. Earlier guesses have higher maximum scores.
Numbered land pins attach to an unambiguous source continental plate and drift
with it. Ocean/ambiguous clicks stay grey and fixed; the limitation is described in How to play.
Overlapping pins have offset labels with leader lines. Each pick shows its distance,
and points earned. After playback the next
round is immediately ready; selecting a new location clears the previous feedback. Trackpad: two-finger scroll to pan and pinch to zoom around the gesture position.
Phone: one-finger drag to pan, two-finger pinch to zoom, tap to select. Mouse:
drag to pan and Ctrl+wheel to zoom. Use +/− or keyboard +/− to zoom, and ↺ or
keyboard 0 to reset. Pan bounds keep land in reach; window rotation/resizing
preserves the viewed location. Drags and pinches do not place guesses.

Scores are on the side; instructions use a dialog. Final results are a non-modal,
collapsible map overlay, with modern country borders and a gold target country. The country is the target area: any pick inside its supported reconstruction earns
that round's full points. Misses use shortest great-circle distance to the nearest
territory edge, never to a hidden point. Earlier rounds have higher maximum scores.
The final map highlights the whole modern country in gold over the terrain.
Saved progress is versioned by reconstruction model; the terrain integration
starts a fresh daily save instead of applying old Müller guesses to a new map.

The pool is opt-out: all 258 country/territory features in the Natural Earth source
are classified: 247 are countries/territories, and 109 pass the reconstruction
checks. Leases and uncoded indeterminate features such as ice fields are outside
the target scope. Country/territory exclusions then reflect unsupported domain
lifetimes, rotations or territorial coverage, with no
size or difficulty filter. See [COUNTRY-POOL.md](COUNTRY-POOL.md) and the generated
support report for every inclusion and exclusion. Daily selection cycles evenly
through all eligible entries; detailed geometry loads only for the selected country.
Country geometry comes from modern Natural Earth territory partitioned across the
published model's static plates. This is a rigid-plate educational approximation,
not ancient political geography or continental deformation. Tiny unsupported
fragments are omitted at older ages rather than assigned invented positions; the
modern 0 Ma round uses the complete modern country geometry.

Keyboard: focus map, arrows to move by 5°, Shift+arrows by 1°, Enter to select,
then Tab to confirm. Reset cancels in-flight animation and selects a different supported country for testing.
Daily progress is saved locally when storage is available; random testing rounds do not overwrite it. The challenge date is fixed automatically.

**Scientific scope:** native published PALEOMAP 2024 terrain at the four ancient
stops, NOAA ETOPO 2022 modern relief, and modern country territory partitioned and
rotated with the matching PALEOMAP model. Between stops, supported land moves on
its plates using only the departure atlas. The next map is requested after arrival
and settles in over 320 ms while geological time stays fixed. Unsupported departure
land fades out without a guessed rotation. Gaps and overlaps can appear between
rigid pieces. These are cartographic visual transitions, not continuous paleoelevation or deforming-land simulations. Ancient
features are broad reconstructions; only modern Europe has the finer terrain inset.
There are no political boundaries during guessing and no river overlay. Read
[SOURCES.md](SOURCES.md) and [GAME-MAP-INTEGRATION.md](GAME-MAP-INTEGRATION.md)
for attribution, model checks, reproduction and limitations.

## Verify

Node.js 22+ is needed only for tests (no npm dependencies):

```sh
npm test
```

Tests cover modern point containment, reference GPlates coordinate agreement,
continuous supported ages, unsupported plate rejection, quaternion sign handling,
date-line distances, antipodes, spherical projection clipping, daily selection
and scoring. Browser verification is recorded in TESTING.md.

## Cloudflare hosting

The publishing target is Cloudflare Workers Static Assets, Cloudflare's current
recommendation for new static sites. The game stays entirely browser-based. Run
`npm ci`, `npm test`, then `npm run deploy:check` to validate the public package.
`npm run preview` serves the exact package locally. The build keeps only the game,
active scientific data and required attribution documents in ignored `dist/`.

Play the demo at https://driftle.xjackwalker.workers.dev/. Pushing to `main`
automatically runs tests and publishes through Cloudflare. Hosting settings and
future custom-domain setup are documented in [HOSTING.md](HOSTING.md). Source
is versioned at https://github.com/jackcwalker/driftle.

## Files

- app.js: game state, pin/result canvas, animation and UI
- drift-map.js / map-renderer.js: georeferenced WebGL2 terrain and plate-warped transitions
- geo.js: plate-partitioned territory containment, nearest-edge scoring and pin motion
- data/paleomap/: matched motion, scoring territory, transport masks and audit
- data/maps/raster-v2/: five elevation-tinted, relief-shaded endpoint atlases
- data/paleomap/countries.json: audited pool; countries/: lazily loaded complete target geometries
- data/paleomap/country-support.json: technical coverage report for all 258 source entries
- data/countries.json: original six-country regression baseline
- data/motion.json and data/country-territories.json: preserved Müller regression baseline
- vendor/: D3 and upstream quaternion/mesh helpers with licences
- tests/: deterministic geometry and data checks

### Experimental terrain

Open http://localhost:4173/terrain.html?view=europe for the static comparison view
of the same five maps now used by the game. Source baking and cartography are
documented in [RASTER-MAPS.md](RASTER-MAPS.md). The earlier vector study remains
documented in TERRAIN.md as a regression baseline.
