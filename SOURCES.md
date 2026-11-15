# Driftle: sources, reuse assessment and scientific limits

Inspected 15 November 2026. No service account, purchase or deployment was made.

## Active game terrain and reconstruction

The playable game now uses PALEOMAP 2024 v24221 elevation atlases and the matching
paleogeographic plate bundle, CC BY 4.0. Credit: Christopher R. Scotese, Christian
Vérard, Landon Burgener, Reece P. Elling and Ádám T. Kocsis (2024),
*Phanerozoic-scope supplementary material to “The Cretaceous World: Plate Tectonics,
Paleogeography, and Paleoclimate” from the PALEOMAP project*,
https://zenodo.org/records/10659112. Modern terrain is NOAA NCEI ETOPO 2022,
freely reusable under NOAA's service terms; natural lakes and country boundaries
are public-domain Natural Earth data. No river layer is included.

See [RASTER-MAPS.md](RASTER-MAPS.md) for full source terms, exact inputs and raster
changes; [GAME-MAP-INTEGRATION.md](GAME-MAP-INTEGRATION.md) for matched-frame
country partitions, validity screening, transport masks, audit and reproduction.
The game checks the shared model-archive SHA-256 before play. The retained Müller
files described below supply regression tests and upstream attribution only.

## Base assessment

https://github.com/TurtleBotDev/pangea-earth at commit
`f5ab2bf5e22053e1a90b6864d0d35ad230aa9a32` is suitable as a source of rigid-plate
motion data and quaternion interpolation for the original educational MVP. It is not a
ready-made country reconstruction dataset or an ancient political map. We reuse
`motion.json` and `places.json` (now regression baselines), and `motion.js` under their
respective terms. The game UI and map renderer are new. The upstream Cesium,
NASA satellite images, PALEOMAP rasters and fonts are not included or used.

Upstream application code: MIT, copyright (c) 2026 TurtleBotDev. See LICENSE.
The data is separately CC BY 4.0; MIT does not override that licence.

## Retained Müller regression data — CC BY 4.0

Müller, R. D., Flament, N., Cannon, J., Tetley, M. G., Williams, S. E., Cao, X.,
Bodur, Ö. F., Zahirovic, S. and Merdith, A. (2022), “A tectonic-rules-based mantle
reference frame since 1 billion years ago – implications for supercontinent cycles
and plate–mantle system evolution,” Solid Earth 13, 1127–1159.
https://doi.org/10.5194/se-13-1127-2022

Dataset v1.2.4: https://zenodo.org/records/13636799
Licence: https://creativecommons.org/licenses/by/4.0/
Zenodo record API was checked and reports `cc-by-4.0`.
Service: https://gws.gplates.org/ ; https://gwsdoc.gplates.org/models/#muller2022

Upstream extracts simplified continental coastlines from
`Coastlines/shapes_coastlines_Merdith_etal.gpmlz` and records plate IDs, validity,
and scalar-first finite-rotation quaternions sampled every 5 Ma, anchor plate 0.
Upstream reports fetching the service data on 7 October 2026. We retain bundled
coordinates unchanged on disk; runtime changes are quaternion slerp, rotation,
ring orientation normalization and Equal Earth projection. See
[data/UPSTREAM-ATTRIBUTION.md](data/UPSTREAM-ATTRIBUTION.md) for the preserved
upstream notice, including datasets not shipped here.

## Modern country silhouettes — public domain / PDDL 1.0

Made with Natural Earth; Tom Patterson, Nathaniel Vaughn Kelso and contributors.
https://www.naturalearthdata.com/about/terms-of-use/

Retrieved 15 November 2026 through Open Knowledge Foundation / Lexman:
https://github.com/datasets/geo-countries/blob/master/data/countries.geojson
https://github.com/datasets/geo-countries/blob/master/README.md
https://opendatacommons.org/licenses/pddl/1.0/

All 258 country/territory features are now screened automatically, with 116
technically supported entries shipped as lazy-loaded target bundles. Source modern
coordinates are preserved. The original six-country file remains a regression
baseline. Full input SHA-256, coverage fractions and exclusion reasons are in
`data/paleomap/country-support.json`; see COUNTRY-POOL.md. Modern geometries define modern territory and are split by source static plate polygons
for rigid reconstruction. They do not represent ancient national borders. The country name is visible up front.
The upstream representative points correspond to Brazil (-55,-15), Australia
(134,-25), India (78,22), USA (-100,40), Central African Republic (20,8) and Czechia
(15,50). Tests check containment in modern country geometries and reconstructed
positions against the separately bundled Müller GPlates place samples in the baseline tests. The active PALEOMAP references are bundled separately in `data/paleomap/motion.json`. These comparisons
check transformation correctness, not independent scientific model accuracy.

## Rendering software

D3 7.9.0: https://github.com/d3/d3/tree/v7.9.0 — ISC licence, Mike Bostock.
Vendored browser bundle, licence in vendor/D3-LICENSE. No CDN requests at runtime.

## Scientific and gameplay limits

- At each guessing stop, the map uses a native published age-specific elevation
  atlas with reconstructed shorelines, mountain systems and seas. Between stops,
  only the departure terrain follows its plate rotations. The destination atlas
  loads after arrival, then settles over 320 ms at a fixed geological age. This is
  display interpolation, not continuous elevation evolution, continental deformation or
  a reconstruction published at that exact intermediate age.
- Scoring uses the union of supported reconstructed country pieces: any contained
  click receives the round maximum. Misses use the shortest spherical distance
  to any territory edge. A 10 m numerical boundary tolerance counts edge clicks
  as inside; it is not a claim about geological accuracy. Modern 0 Ma scoring
  uses the full original country geometry, including islands and holes.
- Every source country/territory is audited; 116 pass and 142 fail technical
  reconstruction checks. No size or difficulty exclusions are applied. Tiny
  unsupported fragments in otherwise eligible countries are omitted at older
  ages, without guessed rotations. See COUNTRY-POOL.md and the generated report.
- Unsupported departure material fades out during the first 5.5% of a transition
  without invented motion. Rigid patches can overlap or separate over a quiet
  ocean background; gaps remain visible. The native map returns only at arrival.
  These are model and display limits, not ancient national boundaries. Finite
  rotations between 5 Ma samples use shortest-path quaternion interpolation.
- D3 performs spherical clipping at the antimeridian and poles before projection;
  scoring uses spherical great-circle distance and wraps longitude naturally.
- Four 75 Ma animations connect the five guessing ages. After 0 Ma the country
  is revealed; a fifth 75 Ma advance would invent a future model and is omitted.
- Reduced-motion preference shortens the transition to a 1.5 s duration
  instead of 4.5 s (motion still occurs to preserve the game mechanic).
- Daily selection uses UTC epoch-day modulo the full eligible pool in stable ID
  order. Every eligible entry appears once per 116-day cycle. It is deterministic,
  not secret. A page left open across midnight keeps its selected day until reload.
- Client-side game data is inspectable. Local history is optional and editable;
  there is no trusted leaderboard, anti-cheat, backend, analytics or account.
- Political geography follows Natural Earth's de facto representation.
- The referenced prior chat returned content-reference placeholders rather than
  the earlier design prose. This implementation follows the current request;
  its visual design and the nearest-edge scoring rule are MVP decisions.

## Polar rendering tolerance

Two source polygons contain an exact South Pole vertex, where longitude is
undefined. To avoid D3 antimeridian clipping filling the world's oceans as land,
the renderer replaces only that singular vertex with two meridian vertices at
89.9999° latitude (an approximately 11 m cap), densifies geodesic edges to at most
2°. The old Müller baseline also tilted the projection by 0.01°; the raster game
uses zero rotation to match the inverse GPU projection. This is numerical display regularization,
not new geological evidence. Original data and scoring coordinates stay intact.
The regression test checks that no individual feature floods the map at every
5 Ma sample from 300 to 0 Ma.

## Guess pin motion and feedback

For land clicks, the guessed-age quaternion is inverted to map the click back to
modern source coordinates. Point-in-polygon tests against valid source continental
pieces assign a plate only if the match is unambiguous. The pin is then rotated
from that same source coordinate on each animation frame. This does not attach
all clicks to the target country's plate or invent ocean-floor movement. If the
click has no unique source assignment, or its source piece is invalid at the
displayed age, the pin remains at its original geographic coordinate, in grey.
These bundled continental pieces are not a complete oceanic plate partition.

Internal source-piece outlines and the latitude/longitude grid are not drawn.
The full native raster is shown at each guessing stop. Intermediate rigid patches
are composited over a quiet ocean using only departure terrain; the native
arrival atlas appears after motion, as described in GAME-MAP-INTEGRATION.md. After each guess
feedback uses great-circle distance and initial compass bearing at the guessed
age; warmer/colder compares distances to each round's reconstructed country edge.

## Final modern country layer

`data/modern-countries.json` generalizes the same public-domain Natural Earth /
Open Knowledge Foundation country dataset cited above, using spherical chord
simplification tolerance 0.001 (approximately 6.4 km), retaining small rings where
simplification would collapse them. This is a modern cartographic display layer,
shown only after the challenge reaches its final results at 0 Ma. It is never projected backwards as ancient
national borders. The target is highlighted, and pin arrival countries are found
by modern point-in-polygon containment. Labels at low zoom show the target and
pin-arrival countries; zooming in reveals other sufficiently large countries.

Rebuild using `python3 scripts/prepare-countries.py INPUT.geojson`. The input was
retrieved on 15 November 2026 from the previously cited datasets/geo-countries
source; its SHA-256 is `392a03db8aa3ba82c105852655620129b11182b95dfc34ef046827ea7d0e5b8c`.
The output inherits Natural Earth's public-domain / package PDDL 1.0 terms.

## Retained Müller scoring baseline and reproduction

Active PALEOMAP scoring partitions are in `data/paleomap/countries/`; the
`territories.json` file is their metadata index. See GAME-MAP-INTEGRATION.md. The following records the older regression baseline.

`data/country-territories.json` is derived from the full selected Natural Earth
country geometries and `StaticPolygons/shapes_static_polygons_Merdith_etal.gpml`
in the published v1.2.4 archive. Model file:
https://zenodo.org/records/13636799/files/Muller_etal_2022_SE_v1.2.4.zip

`optimisation/1000_0_rotfile_MantleOpt.rot` provides mantle-frame rotations anchored
to plate 0. Normalized quaternions for the six original point plates agree with
the existing map samples to floating-point precision (maximum 1−|dot| ~2.3e−16).
Existing plate IDs reuse the map's exact bundled samples; additional plate IDs
use rotations calculated from the same published model every 5 Ma.

Rebuild with Python 3.12, `pygplates==1.0.0` and `shapely==2.2.0`:

```sh
python scripts/prepare-country-territories.py EXTRACTED_MODEL_DIRECTORY
```

The preprocessing preserves original vertices, densifies great-circle edges to
<=0.05 degrees, unwraps longitudes locally per country component, and intersects
country and static-plate polygons with Shapely. Overlaps are assigned in descending
plate-ID order. This is a sampled-edge cartographic partition, not exact spherical
Boolean geometry. It introduces small boundary approximation errors and does not
resolve deformation. Holes and separate components are retained. pyGPlates 1.0
polygon splitting only returns boundary polylines for intersecting polygons, so
that API is deliberately not used to fabricate closed territory fragments.

Country pieces preserve source plate ID and validity interval. No missing rotation
is replaced with identity. Countries are eligible when the fraction of unknown
or unsupported partition area is below 0.01% over the full 300–0 Ma interval.
Coverage is measured in locally unwrapped coordinate area for this screening
threshold, not physical land area or a geological accuracy estimate. Approximate
unsupported fractions: Brazil 0.00082%, Australia 0.00238%, India 3.05%, USA 13.40%;
Central African Republic and Czechia have no unsupported parts. The small unknown
partition fraction is also included in screening. Reconstructed target regions
are material occupying modern national territory, not countries that existed in
the past. Derived model geometry and rotations retain CC BY 4.0, alongside Natural
Earth's public-domain/PDDL input terms. pyGPlates and Shapely are preparation-only
dependencies, not distributed browser/runtime dependencies.

Pin attachment prefers the containing target-country piece for correct guesses,
then falls back to the original continental-piece partition for misses.

Preparation-tool licences: pyGPlates 1.0.0 is GPLv2; Shapely 2.2.0 is BSD-3-Clause
(and uses GEOS under its separate LGPL terms). These tools are installed only in
the development environment and are not copied into the distributable site.

## Early success

A correct country pick secures the win, then playback continues from the current
age all the way to 0 Ma before showing the final modern map and results.
All later rounds receive their full maximum as explicitly labelled awarded
points; these are not extra guesses or reconstructed pin positions. Earlier
miss deductions are retained. Saved actual guesses are re-scored and truncated
at their first success under the current country-area rule.

## Terrain comparison route

`terrain.html` uses age-specific Scotese, Vérard, Burgener, Elling & Kocsis (2024)
PALEOMAP v24221 PaleoDEMs, **CC BY 4.0**, https://zenodo.org/records/10659112,
plus NOAA NCEI ETOPO 2022 modern terrain (freely reusable NOAA data) and public-domain
Natural Earth natural lakes. Rivers are removed. Full attribution, exact inputs,
changes, licences, reproduction and limits are in [RASTER-MAPS.md](RASTER-MAPS.md)
and the generated `data/maps/raster-v2/manifest.json`. The normal game uses the
same physical maps. The earlier Scotese & Wright (2018) CC BY 4.0 vector study data
are retained; their provenance remains in [TERRAIN.md](TERRAIN.md).
