# Driftle: sources, reuse assessment and scientific limits

Inspected 15 November 2026. No service account, purchase or deployment was made.

## Base assessment

https://github.com/TurtleBotDev/pangea-earth at commit
`f5ab2bf5e22053e1a90b6864d0d35ad230aa9a32` is suitable as a source of rigid-plate
motion data and quaternion interpolation for this educational MVP. It is not a
ready-made country reconstruction dataset or an ancient political map. We reuse
`motion.json`, `places.json` (verification only), and `motion.js` under their
respective terms. The game UI and map renderer are new. The upstream Cesium,
NASA satellite images, PALEOMAP rasters and fonts are not included or used.

Upstream application code: MIT, copyright (c) 2026 TurtleBotDev. See LICENSE.
The data is separately CC BY 4.0; MIT does not override that licence.

## Plate model and derived data — CC BY 4.0

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

Six country features were selected without changing their coordinates. Modern
geometries define modern territory and are split by source static plate polygons
for rigid reconstruction. They do not represent ancient national borders. The country name is visible up front.
The upstream representative points correspond to Brazil (-55,-15), Australia
(134,-25), India (78,22), USA (-100,40), Central African Republic (20,8) and Czechia
(15,50). Tests check containment in modern country geometries and reconstructed
positions against the separately bundled GPlates place samples. These comparisons
check transformation correctness, not independent scientific model accuracy.

## Rendering software

D3 7.9.0: https://github.com/d3/d3/tree/v7.9.0 — ISC licence, Mike Bostock.
Vendored browser bundle, licence in vendor/D3-LICENSE. No CDN requests at runtime.

## Scientific and gameplay limits

- The map transports **modern continental coastlines** with a published plate
  model. It does not reconstruct ancient shorelines, sea levels, mountains,
  deformation, oceanic-crust creation/subduction or complete paleogeography.
- Scoring uses the union of supported reconstructed country pieces: any contained
  click receives the round maximum. Misses use the shortest spherical distance
  to any territory edge. A 10 m numerical boundary tolerance counts edge clicks
  as inside; it is not a claim about geological accuracy. Modern 0 Ma scoring
  uses the full original country geometry, including islands and holes.
- The daily pool includes Brazil, Australia, Central African Republic and Czechia.
  India and USA are excluded because a material fraction of their territory has
  no valid reconstruction through all five rounds. Tiny unsupported fragments in
  otherwise supported countries are omitted at older ages, not given guessed
  rotations. See coverage details below.
- Land pieces disappear outside source validity. There can be overlaps, seams and
  simplified islands. These are inherited model/geometry limits, not interpolated
  national boundaries. Finite rotations between 5 Ma samples use shortest-path
  quaternion interpolation; this is a visual approximation between model samples.
- D3 performs spherical clipping at the antimeridian and poles before projection;
  scoring uses spherical great-circle distance and wraps longitude naturally.
- Four 75 Ma animations connect the five guessing ages. After 0 Ma the country
  is revealed; a fifth 75 Ma advance would invent a future model and is omitted.
- Reduced-motion preference shortens the transition to a 1.5 s duration
  instead of 4.5 s (motion still occurs to preserve the game mechanic).
- Daily selection uses UTC epoch-day modulo the original six-country catalogue,
  skipping forward past unsupported countries. The sequence repeats every six days. It is deterministic, not random or secret.
  Date changes are manual; a page left open across midnight keeps its selected day.
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
2° and tilts the projection by 0.01°. This is numerical display regularization,
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

Internal source-piece outlines and the latitude/longitude grid are no longer
drawn. Land is combined in one fill to avoid antialiasing seams. Actual gaps and
holes in the source remain; they are not digitally painted over. After each guess
feedback uses great-circle distance and initial compass bearing at the guessed
age; warmer/colder compares distances to each round's reconstructed country edge.

## Final modern country layer

`data/modern-countries.json` generalizes the same public-domain Natural Earth /
Open Knowledge Foundation country dataset cited above, using spherical chord
simplification tolerance 0.001 (approximately 6.4 km), retaining small rings where
simplification would collapse them. This is a modern cartographic display layer,
shown only after the final 0 Ma pick. It is never projected backwards as ancient
national borders. The target is highlighted, and pin arrival countries are found
by modern point-in-polygon containment. Labels at low zoom show the target and
pin-arrival countries; zooming in reveals other sufficiently large countries.

Rebuild using `python3 scripts/prepare-countries.py INPUT.geojson`. The input was
retrieved on 15 November 2026 from the previously cited datasets/geo-countries
source; its SHA-256 is `392a03db8aa3ba82c105852655620129b11182b95dfc34ef046827ea7d0e5b8c`.
The output inherits Natural Earth's public-domain / package PDDL 1.0 terms.

## Country-wide scoring data and reproduction

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
