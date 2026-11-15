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

The existing 0.01% unsupported/unknown coordinate-area threshold retains Brazil,
Australia, Central African Republic and Czechia. Unsupported proportions are about
0.00082%, 0.00261%, 0%, and 0%, respectively. India remains excluded at about 2.91%,
and USA at about 22.83% plus 0.00117% unpartitioned. These are screening fractions
in locally unwrapped coordinate area, not physical land-area or accuracy estimates.
Modern 0 Ma scoring still uses the complete modern country, including islands and
holes. Ancient target area can be underwater: these are modern territorial material
locations, not ancient countries or a guarantee of dry land.

Saves use `driftle-paleomap-v1-<UTC date>`. The earlier Müller save is retained in
browser storage but is not reinterpreted under a different model. Saved missed-guess
pin attachments are validated against the matching model on reload, independently
of which owner textures are currently resident. Daily selection
and the four-country pool stay deterministic. Random testing does not overwrite
the daily save.

## Endpoint quality and playback

At each guessing stop, the full native atlas is drawn directly in Equal Earth.
There is no clipping to modern coastlines, static plate coverage or a triangle
mesh. The 0 Ma map includes the sharper Europe inset when zoomed in. Only final
results add modern country boundaries and translucent gold target highlighting.
Rivers remain removed. Modern natural lakes appear at Today.

During each 75 Ma transition, a screen fragment is inverse-rotated from the current
plate orientation to its modern material coordinates, then forward-rotated into
each endpoint's texture coordinates. This is the same quaternion convention used
by country reconstruction and pins. Categorical owner masks restrict transported
land to supported published domains at each endpoint. Longitude repeats across
the date line; latitude clamps at the poles. The inverse fragment projection avoids
triangles stretching across the seam. Conservative plate bounds reduce overdraw.

The two endpoint layers are composed separately before blending, avoiding opacity
seams from layering partially transparent individual plates. Full native atlases
also crossfade beneath moving land to fill gaps between rigid pieces. This can
show blended or ghosted coastlines between stops, particularly around Asia. The
intermediate landscapes are display interpolation, not published reconstructions
at those exact ages or newly inferred topography. Native endpoint shorelines and
scoring geometry remain intact.

Depending on age, roughly 87.6–92.3% of ancient exposed land has a supported raster
transport assignment in this preparation; about 99.95% of modern exposed land does.
Unassigned geography remains in the native crossfade and receives no invented
rotation. High-latitude raster cells beyond a 0.15° boundary allowance are removed
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

The browser keeps two endpoint atlases, their R8 owner textures and an optional
Europe inset on the GPU. Two temporary RGBA layers use CSS-pixel resolution during
motion; exact guessing stops retain the sharper device-resolution rendering.
Compressed later images are prefetched without keeping their decoded GPU textures.
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
python scripts/prepare-game-maps.py SOURCE_DIRECTORY
python scripts/audit-game-maps.py SOURCE_DIRECTORY
npm test
```

Source archives and scientific Python tools are preparation-only dependencies.
Generated game assets are committed. `npm start` serves the game without a build.
Tests cover model/archive consistency, target reference coordinate agreement,
full-country scoring, pin arrivals, inverse texture warps, categorical mask hashes,
and pole/date-line draw bounds, alongside the previous scoring/motion regressions.
Browser verification and measured playback results are in TESTING.md.
