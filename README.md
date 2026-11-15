# Driftle

A local, responsive daily continental-drift geography game for driftle.games.

## Run

Requires Python 3 and a current browser. No install or build step.

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
points, compass hint and improvement from the last pick. After playback the next
round is immediately ready; selecting a new location clears the previous feedback. Trackpad: two-finger scroll to pan and pinch to zoom around the gesture position.
Phone: one-finger drag to pan, two-finger pinch to zoom, tap to select. Mouse:
drag to pan and Ctrl+wheel to zoom. Use +/− or keyboard +/− to zoom, and ↺ or
keyboard 0 to reset. Pan bounds keep land in reach; window rotation/resizing
preserves the viewed location. Drags and pinches do not place guesses.

Scores are on the side; instructions use a dialog. Final results are a non-modal,
collapsible map overlay, with modern country borders and a gold target country. The country is the target area: any pick inside its supported reconstruction earns
that round's full points. Misses use shortest great-circle distance to the nearest
territory edge, never to a hidden point. Earlier rounds have higher maximum scores.
The final map highlights the whole modern country in gold. Existing saved guesses
are re-scored on load; incorrect old target-point scores are not retained.

The daily pool currently supports Brazil, Australia, Central African Republic and
Czechia. India and USA are omitted because too much territory has unsupported
300 Ma positions. The original six-entry UTC date rotation is retained, skipping
unsupported entries forward, so existing Brazil challenge dates remain Brazil.
Country geometry comes from modern Natural Earth territory partitioned across the
published model's static plates. This is a rigid-plate educational approximation,
not ancient political geography or continental deformation. Tiny unsupported
fragments are omitted at older ages rather than assigned invented positions; the
modern 0 Ma round uses the complete modern country geometry.

Keyboard: focus map, arrows to move by 5°, Shift+arrows by 1°, Enter to select,
then Tab to confirm. Reset cancels in-flight animation and selects a different supported country for testing.
Daily progress is saved locally when storage is available; random testing rounds do not overwrite it. The challenge date is fixed automatically.

**Scientific scope:** reconstructed modern coastlines and plate-partitioned modern
country territory, not ancient national borders or ancient shorelines. Read
[SOURCES.md](SOURCES.md) for reuse assessment, attribution, provenance and limits.

## Verify

Node.js 22+ is needed only for tests (no npm dependencies):

```sh
npm test
```

Tests cover modern point containment, reference GPlates coordinate agreement,
continuous supported ages, unsupported plate rejection, quaternion sign handling,
date-line distances, antipodes, spherical projection clipping, daily selection
and scoring. Browser verification is recorded in TESTING.md.

## Future Cloudflare Pages setup (not deployed)

This is an ordinary static site. Use this directory as the output directory,
with no build command. No Workers, secrets or server are required. Preserve
LICENSE, SOURCES.md and vendor/D3-LICENSE in the published assets. Add the custom
domain driftle.games only after explicit authorization. The source is versioned in the private GitHub repository
https://github.com/jackcwalker/driftle. Nothing has been purchased or deployed.

## Files

- app.js: game state, canvas rendering, animation and UI
- geo.js: plate-partitioned territory containment, nearest-edge scoring and pin motion
- data/motion.json: attributed published model derivatives
- data/countries.json: full public-domain modern country geometries
- data/country-territories.json: attributed model-partitioned scoring areas
- vendor/: D3 and upstream quaternion/mesh helpers with licences
- tests/: deterministic geometry and data checks

### Experimental terrain

Open http://localhost:4173/terrain.html?view=europe for the five-age physical-map preview: native 300, 225, 150, 75 Ma elevation maps and detailed modern European relief. This is the cartographic proof; geological animation and game integration await the matched-model validation described in [RASTER-MAPS.md](RASTER-MAPS.md). The normal game remains unchanged. No river overlay or political borders are drawn. Ancient landforms are reconstructed and remain broader than measured modern terrain.
