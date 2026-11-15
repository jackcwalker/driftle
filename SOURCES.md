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
geometries are retained for point-containment validation only; they are not
transported as ancient national borders. The country name is visible up front.
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
- The scoring target is exactly the marked representative **interior point**,
  not the full country's reconstructed territory, centroid or capital. Modern
  national borders did not exist at these ages. A large country's territory may
  span several plates. No claim is made that its entirety shares this rotation.
- Six points with bundled plate assignments valid through 300–0 Ma are supported.
  Other countries, ambiguous assignments and unsupported ages are excluded, never
  mapped to a guessed plate. Extending the catalogue requires genuine point
  partitioning against the same model, validity checking and source validation.
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
- Daily selection uses UTC epoch-day modulo a fixed six-country catalogue. This
  deliberately repeats every six days. It is deterministic, not random or secret.
  Date changes are manual; a page left open across midnight keeps its selected day.
- Client-side game data is inspectable. Local history is optional and editable;
  there is no trusted leaderboard, anti-cheat, backend, analytics or account.
- Political geography follows Natural Earth's de facto representation.
- The referenced prior chat returned content-reference placeholders rather than
  the earlier design prose. This implementation follows the current request;
  its visual design and exact point-scoring rule are MVP decisions.

## Polar rendering tolerance

Two source polygons contain an exact South Pole vertex, where longitude is
undefined. To avoid D3 antimeridian clipping filling the world's oceans as land,
the renderer replaces only that singular vertex with two meridian vertices at
89.9999° latitude (an approximately 11 m cap), densifies geodesic edges to at most
2° and tilts the projection by 0.01°. This is numerical display regularization,
not new geological evidence. Original data and scoring coordinates stay intact.
The regression test checks that no individual feature floods the map at every
5 Ma sample from 300 to 0 Ma.
