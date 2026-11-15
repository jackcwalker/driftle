# Driftle physical-map implementation plan

Research date: 15 November 2026. Scope: a researched implementation specification; no gameplay or renderer changes in this research pass. All performance figures below are acceptance targets unless explicitly described as previous measurements.

## Recommendation

Build five carefully styled physical maps at 300, 225, 150, 75 and 0 Ma. Display the full age-specific map at each guessing stop. Between stops, transport supported raster patches using the existing quaternion machinery and blend their appearance toward the next snapshot. Unmatched geography may dissolve during the transition; it must not receive invented plate motion. These intermediate frames are a visual transition, not a landscape-evolution simulation.

Use the 2024 PALEOMAP 0.1° paleoDEMs as the leading ancient source candidate, with its accompanying paleogeographic rotation/polygon bundle. Use a modern measured terrain source plus modern hydrography at 0 Ma. Confirm the PALEOMAP registration before committing to the model change. Keep the current Müller bundle as a regression baseline.

Keep the game's framework: five guesses, territory scoring, quaternion interpolation, moving pins, Equal Earth projection, view controls, UI and result flow. A matched PALEOMAP data bundle replaces model-specific inputs if the registration checks pass. This is a data migration, not a switch to a new application framework. Replace the terrain drawing path with a small GPU raster renderer. Do not extend the existing vector elevation-band experiment.

The product requirement is geographic information from the map itself: coastlines, mountain systems, plateaus, basins, plains, and supported water features. No political borders, place labels, extra clue controls or directional hint system during guessing.

## What the research established

### Why the prototype disappointed

The current importer samples a 1° grid, extracts a handful of colour bands, simplifies those polygons to 0.25°, and uses a coarse directional gradient for shade. It clips everything to reconstructed modern coastlines. That discards geographic structure, hides ancient inland seas and shelves, and turns terrain into coloured patches. The runtime still rotates/projects thousands of polygons on the CPU. Its previous measured result was about 27 fps at 1440×900 after simplification.

Increasing bitmap size alone would not fix any of those losses. We need a finer input, raster cartography, age-specific water masks and a rendering path whose geometry count is independent of terrain detail.

### Source decisions

| Source | Verified findings | Use |
| --- | --- | --- |
| [PALEOMAP 2024 supplement](https://zenodo.org/records/10659112), v24221 | CC BY 4.0 in the record API. The actual downloaded NetCDF archive contains all five exact ages, each 3601×1801. The supplement includes a paleogeography-specific plate model and clean elevation source rasters without administrative overlays. | First ancient-source candidate. Use numeric DEMs, not labelled map screenshots. |
| [Scotese & Wright 2018 PaleoDEMs](https://zenodo.org/records/5460860), v2 | CC BY 4.0. Downloaded and checksum-verified the 6-minute archive, not just its catalogue. All five ages exist at 3601×1801. | Independent version comparison and fallback if 2024 registration/appearance is worse. Do not mix releases casually. |
| [GEBCO 2026](https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid) | Modern global elevation/bathymetry at 15 arc-seconds, with attribution-required public-domain terms. Regional subsets are available. | Leading modern DEM candidate. Preprocess only the resolution needed by the game; do not ship the 7 GB source. |
| [Natural Earth physical vectors](https://www.naturalearthdata.com/downloads/10m-physical-vectors/) and [terms](https://www.naturalearthdata.com/about/terms-of-use/) | Public-domain rivers, lakes and coastline products, including European supplements and scale-rank attributes. | Modern river/lake context, rank-filtered and unlabelled. Filter out reservoirs and artificial canals where identifiable. |
| [Natural Earth shaded relief](https://www.naturalearthdata.com/downloads/10m-cross-blend-hypso/shaded-relief/) | Public-domain relief raster available up to 21,600×10,800. | A cartographic quality reference and rapid modern comparison, not the default ancient texture. Its environment-dependent colours should not be mistaken for elevation alone. |
| [Paleo-Physiography collection](https://www.hydroshare.org/resource/0106c156507c4861b4cfd404022f9580/) | Published 0.05° landscape simulations include drainage-related variables. However, the [elevation-only download](https://www.hydroshare.org/resource/b3f1e3581d174bf58b00ba5672604710/) and checked [131–280 Ma resource](https://www.hydroshare.org/resource/0d90071c575f49a3b06b59066eed72fc/) explicitly carry CC BY-NC-SA 4.0, despite CC BY on the collection. | Exclude as a product dependency under these terms. A collection licence is not permission to ignore individual resource licences. Any future use needs a separately suitable grant and explicit simulation provenance. |
| [EarthByte paleotopo assimilation](https://github.com/EarthByte/paleotopo-data-assimilation) | A newer workflow; its README describes the associated amplitude-correction methodology as in review. It primarily addresses elevation amplitudes. | Monitor, not a release dependency. More vertical amplitude does not automatically supply missing valleys, coastlines or rivers. |

A 0.1° cell is about 11 km north–south, with narrower east–west spacing at higher latitude. That is ten times finer linear sampling than the old input, not ten times better geological knowledge. The 2024 archive's five slices have only 171–243 distinct elevation values across each world grid; the supplement explains their derivation from indexed elevation maps. Expect broad reconstructed landforms, not survey-quality ancient drainage. Detailed modern rivers must not be transported to 300 Ma as historical rivers.

### Actual archive audit

Checksums and filenames were inspected locally. All 2024 slices run north-to-south in latitude; longitude includes both -180 and +180, so one duplicate seam column must be handled deliberately.

| Age | Exact 2024 source file | Grid |
| --- | --- | --- |
| 300 Ma | `300_v23230d.nc` | 3601×1801 |
| 225 Ma | `225_v23221.nc` | 3601×1801 |
| 150 Ma | `150_v23220d.nc` | 3601×1801 |
| 75 Ma | `075_v24085.nc` | 3601×1801 |
| 0 Ma | `000_v21144.nc` | 3601×1801; compare with modern DEM |

Archives checked:

- 2018 6-minute NetCDF ZIP: MD5 `89eb50d8645707ab221b023078535bda`.
- 2024 `5a. PaleoDEM (nc, 3601x1801).zip`: MD5 `a7285e0e6a7d1e93837ed89243bbfa6e`.
- 2024 plate bundle: `3a. PALEOMAP Global Plate Model for Paleogeographic Reconstructions v.19o_r1d.zip`; model files `Scotese_Plate_Model_forPgeog_v19o_r1d_v240506a.rot` and `Scotese_Plate_Polygons__forPgeog_v19o_v240506.gpml`.

See [numeric grid audit](docs/terrain-grid-audit.json).

### Registration and missing geometry are real constraints

Our existing Müller motion and PALEOMAP terrain cannot be treated as interchangeable geographic coordinates. Different reconstruction frames and relative configurations can diverge with age. A hand-adjusted global offset would not establish local correspondence. See [GPlates model descriptions](https://gwsdoc.gplates.org/models/).

A coarse check sampled positive 2024 DEM elevations on a 1° lattice and tested them against reconstructed 2024 PALEOMAP static polygons, weighted by cosine(latitude). Approximate sampled land coverage was 99.99% at 0 Ma, 92.32% at 75 Ma, 90.37% at 150 Ma, 92.26% at 225 Ma and 92.12% at 300 Ma. This checks polygon-domain coverage, not geological accuracy or fine shoreline agreement. See [coverage audit](docs/terrain-coverage-audit.json).

Therefore, clipping the whole map to present-day coastlines or even to all static polygons would lose published ancient land. Endpoint raster display must be complete. Static polygons are the motion attachment mechanism, not the authoritative ancient shoreline mask. [GPlates documents reconstructed raster patches using static polygons](https://www.gplates.org/docs/user-manual/Export/).

Representative modern points for all six existing catalogue countries partitioned into the new plate model and had rotations at all five ages. That does **not** prove full country support: the full polygon partition, all intervening rotation samples and local alignment still need validation.

## Visual specification

Use one physical-atlas style across ages:

- Deep ocean: quiet desaturated blue; shallow shelves: lighter blue/cyan derived from age-specific negative elevations. Reserve the strongest land/water contrast for the shoreline. Avoid decorative shoreline glow that looks like a shelf.
- Lowlands: muted warm green; uplands: olive/ochre; high mountains: stone/tan. Continuous tints with controlled contrast rather than six flat bands. Pale peaks do not imply ancient snow or ice without supporting data.
- Relief: broad and local scale shading combined, with multidirectional lighting so mountain orientation does not determine whether it is visible. Keep basins readable rather than uniformly dark.
- Coastline and island shapes: crisp at the source's justified scale. No contours at world scale; no arbitrary terrain noise, satellite land cover or modern mountains added to ancient maps.
- Rivers/lakes: clear but subordinate blue, with screen-space widths and feature ranks. Modern water appears at 0 Ma, with a brief visual blend in the final transition. Ancient drainage only if a reusable, age-specific source is subsequently established; it is not required for the first release of this map work.
- Zoom: world scale shows continental structure; regional scale resolves ranges, plains and shelves; modern country scale adds waterways and smaller relief. Ancient zoom must stop gaining artificial sharpness after source detail is exhausted.

For the present-day Czechia benchmark, inspect the Bohemian uplands/basin structure, neighbouring mountain arcs and major river network in context. The standard is that a geography-aware player can orient within central Europe using physical structure, without labels or borders. Do not give every era the modern Alps or the modern river network. At older ages, assess the actual reconstructed features available in the source.

This is an internal cartographic review, not an end-user playtest programme. Finish the map before broader product testing.

## Implementation architecture

### 1. Offline asset pipeline

Pin source versions and checksums in a manifest. Read NetCDF axes, units, registration and no-data metadata explicitly. Normalize latitude orientation and periodic longitude. Treat zero elevation as a legitimate shoreline value, not automatically as missing data.

Create a common georeferenced elevation and validity pipeline for each exact age. Render colour, water masks and relief at native useful resolution before encoding. Calculate slopes in physical distance units with latitude correction or suitable regional metric reprojection. Do not apply metre-scale elevation gradients as though degrees were metres. [GDAL hillshade documentation](https://gdal.org/en/stable/programs/gdaldem.html) supports multidirectional shading and explains unit scaling and geographic-coordinate caveats.

Because the paleoDEMs are quantized, compare a small, documented edge-preserving smoothing pass against the raw result. Smooth terracing without moving meaningful coastlines or inventing finer landforms. Derive shoreline masks from the approved unsmoothed field; preserve a mask separately from colour. Apply the same cartographic decisions consistently across tiles, with overlapping margins to avoid shading seams.

Export static image pyramids in equirectangular coordinates, not Web Mercator. This covers poles and fits source rasters. Start with 512 px tiles with 4–8 px gutters, plus a complete low-resolution overview for each age. Use tested high-quality WebP/PNG encoding first. Lossless masks and crisp hydrography should not acquire lossy compression halos. Only add KTX2/Basis compression if measured memory or upload time justifies its decoder and build complexity.

Ancient detail ends near native 0.1° resolution. Modern detail can continue to an effective 16k–32k global-width pyramid, loaded regionally. Native 15 arc-second modern data need not all reach the browser. All source grids and Python/GIS processing stay offline.

### 2. One model bundle for geography and scoring

Prepare a versioned candidate `paleomap2024` bundle with the existing data contract: modern plate domains, validity, rotations sampled across 300–0 Ma, and split modern country territories. Reuse the quaternion interpolator and territory-distance algorithms.

Use the paleogeography-specific rotation file supplied with the chosen DEM release. Check its anchor/reference convention against the source maps at every stop; being in the same archive is promising, not sufficient proof. Do not casually substitute the other tectonic model also present in the supplement.

Rebuild country partitions, pin attachment and daily eligibility against that bundle. Validate all five country positions and support between stops. Unsupported fragments stay unsupported; missing rotations never become identity rotations. Keep overlap resolution deterministic and record coverage per country. Do not borrow another country's centroid or hand-place a difficult target.

If the matched-source candidate fails registration, stop that migration and investigate the source association. Do not silently retain Müller scoring under a PALEOMAP picture. A quantified Müller-to-PALEOMAP transfer remains a fallback research option, but it has more error sources and is not the recommended production path.

Model changes require a saved-game schema/model version. Preserve old records with their original model or explain a fresh challenge state once; do not reinterpret old geographic clicks and award different scores silently. Random testing rounds remain separate from daily saves.

### 3. Raster renderer with the current interaction model

Add a focused WebGL2 map renderer under the existing Canvas pin/selection overlay. Keep Equal Earth, D3 navigation/inverse picking, UI DOM, scoring and animation state. Both drawing layers consume a single projection/view state.

At a guessing stop, render the **complete native-age raster** on a tessellated sphere projected through Equal Earth. This avoids the static-plate coverage holes and makes endpoints the actual published maps. Geography is georeferenced; a raster pixel's elevation does not change the country's scoring geometry.

During drift, use a static spherical triangle mesh partitioned by supported plate domain, with texture coordinates into both endpoint snapshots. The GPU rotates mesh positions using the same plate quaternions as the CPU pins, samples the appropriate endpoints and blends their appearance. Pixel detail resides in textures, so adding detail does not add contour geometry. Update rotations and blend weights; avoid rebuilding tens of thousands of projected paths each frame.

Implement the projection from a pinned D3-compatible Equal Earth formula and test it against D3 numerically. Set mesh subdivision from projection error at the maximum supported zoom, with a target under one CSS pixel. Flat texture geometry is sufficient; no extruded 3D terrain, globe camera or terrain physics engine is needed.

Use at most a few batched draw passes, a texture-page cache and reused buffers. A small WebGL helper library may be vendored if it saves boilerplate, but do not adopt a full map platform solely to obtain texture drawing. WebGL moves the expensive work to a more suitable path; it is not a performance guarantee until measured.

### 4. Date line, poles and seams

Dynamic rotation means a triangle can cross ±180° at any time. Offline seam splitting alone is insufficient. Implement per-triangle longitude unwrapping around its rotated centre and clipped wrap copies in the GPU path, or an equivalently tested spherical clipping method. Handle pole caps explicitly. This is an early renderer milestone, before visual polish.

Clamp texture sampling to valid tile interiors; duplicate source seam texels consistently. Use shared mesh edges and tile gutters rather than expanding coastlines to hide cracks. Test transparent/premultiplied-alpha edges, overlapping plate domains, tiny islands and continental fragments at every age and intermediate seam crossing.

The overlay projection must match the GPU projection so a pin does not slide relative to a recognisable ridge during pan, zoom or drift. Target under one CSS pixel difference at normal zoom and under two at maximum zoom.

### 5. Five-snapshot transition

For interval A→B, a supported material point p in the plate reference frame appears at Q(t)p. Its source samples come from Q(A)p in map A and Q(B)p in map B. This gives corresponding outgoing/incoming terrain on the same moving patch. Blend rendered appearance with a smooth weight reaching exactly zero/one at the endpoints; do not simulate mountain formation by linearly interpreting elevation as a historical prediction.

Use premultiplied alpha and consistent linear-light blending so coastlines and colours do not darken or halo. Shading is baked cartography; it need not behave as dynamic 3D sunlight.

Geography without a supported material correspondence dissolves out of the outgoing snapshot and into the incoming snapshot at its source location, only during the transition. Never attach it to the nearest guessed plate. Quiet ocean colour conceals temporary gaps; endpoint maps remain complete. Audit the unmatched mask regionally and reject conspicuous duplicate continental silhouettes. If a target's meaningful territory lacks support, it cannot be offered as a moving reconstructed target.

Preload the incoming overview before the transition. Show the exact endpoint and enable picking only after it is ready. On an early correct guess, chain the remaining intervals through every endpoint to 0 Ma, with no extra clicks. Keep the new single animation-frame clock and cancellation token; results appear only at arrival. Test reload, reset and a backgrounded tab during this chain.

Modern rivers are specific to 0 Ma. They can visually fade into the final transition, but must not be retained in earlier stopping maps. Put this distinction in Sources; do not add instructional game overlays.

## Performance and delivery budgets

These are engineering targets to prove on real hardware, not claims about the current code:

| Measure | Target / response if missed |
| --- | --- |
| First playable map | ≤3 seconds on a measured 10 Mbps connection, current-age overview + model + scoring available; set a measured total initial payload budget of ≤4 MB compressed, including existing game data. Trim unused modern-country data from initial load or defer it to reveal if needed. |
| Raster overview | ≤1 MB compressed per age as a first budget; prefetch only current and next before normal play. Image quality wins over an arbitrary byte target if the budget is revised explicitly. |
| Phone animation | 30 fps minimum target on named midrange Android and iPhone Safari devices; record p95 frame intervals ≤40 ms and long stalls separately. |
| Desktop animation | 60 fps target; p95 frame interval ≤20 ms on the named reference machine. |
| Gesture response | Visible pan/zoom feedback within 50 ms; tap must remain distinct from drag/pinch. |
| Texture residency | Initial target ≤48 MiB mobile / ≤96 MiB desktop for resident textures, including mipmaps; separately account for framebuffers, mesh and decoded images. Tune after real-device measurement. |
| Geometry | Initial target ≤100k resident triangles, adjusted to the projection-error requirement and measured draw cost. No per-frame CPU terrain resampling or hillshading. |
| Rendering when idle | Draw on camera/state/asset changes; stop animation-frame requests when stationary. |

A 4096×2048 RGBA texture is 32 MiB before mipmaps even if its downloaded WebP is small. Never decode or upload five full-resolution worlds simultaneously. Keep current/next overviews and an LRU of visible detail pages. Close decoded ImageBitmaps after upload where possible and delete evicted GPU resources. Budget staging uploads; do not decode/upload large images in a single interaction frame. See [WebGL memory and batching guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

Use automatic internal render-scale limits, with a sharper stationary frame after interaction if needed. Lower raster resolution before deleting geographic clue features. Detect context loss and restore from the manifest/cache. For browsers without WebGL2, display exact preprojected snapshot rasters with Canvas pan/zoom and a clearly documented simplified transition; maintain scoring and input. Do not maintain a second elaborate terrain renderer.

Ship static generated assets and a manifest, with content-hashed filenames and cache headers. No live GPlates/terrain API calls during play, account, paid map service or tile backend. [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/) currently allows 25 MiB per asset and 20,000 files on its free plan. Keep each tile small and the asset count comfortably below that. Raw scientific archives stay out of deployment and Git. Heavy preparation runs locally or as an explicit data build; normal Pages builds copy prepared assets. No deployment is part of this plan.

## Implementation sequence and decision gates

1. **Source and registration audit.** Pin 2024/2018 inputs; prepare endpoint diagnostic crops and coastline/plate/country overlays for Europe, South America, Australia and date-line/polar cases. Confirm the candidate model and measure full country support. Deliver source manifest, attribution inventory, coverage masks and a comparison report. Gate: a consistent map/scoring reference, no unexplained systematic displacement.
2. **Prove the cartography before animation.** Render Europe at 0 Ma using modern DEM + water, and the same physical region at 225 and 300 Ma using the candidate data. Produce world and country-scale views at desktop and phone sizes. Compare against native source maps. Gate: recognisable ranges, basins, coasts and, at 0 Ma, useful waterways; no terraces, blurry colour blobs or invented detail. If ancient inputs cannot support the intended scale, document that limit before producing five maps.
3. **Prove the raster renderer.** Build exact 0/300/225 endpoint rendering, pan/zoom, projection parity and date-line/pole handling on the experimental route. Load only useful tile levels. Gate: endpoint fidelity, pin alignment and device budgets. Do this before making a large asset pipeline.
4. **Prove one transition.** Implement 300→225 with both supported texture transport and explicit unmatched-area fading. Compare first/last frames with native endpoints and inspect Czechia's moving territory. Gate: no ghost continents, seam streaks, false plate assignments or loading stalls.
5. **Generate all five maps and integrate.** Bake the approved style for 150/75, modern final detail and water; add the matched country bundle, versioned saves, sequential winning drift and unchanged minimal controls. Gate: a complete game from first pick to final reveal with correct positions and every required stopping map.
6. **Technical/cartographic acceptance.** Device profiling, terrain/source comparison and regression checks described below. Only then is the map ready for a broader product review. Do not spend this phase on clue systems, share animations, accounts or unrelated UI.

Each gate produces inspectable output and can fail. Particularly, raster source quality and reference alignment are unresolved until the comparison assets pass; the research does not justify promising survey-level terrain at 300 Ma.

## Verification and definition of done

- Compare decoded tiles with their source grids: known sample sites, north/south orientation, duplicate seam, valid zero values, no-data and georeferencing. Image encoding may alter colours slightly, never move geography.
- Test GPU-vs-D3 Equal Earth projection at a spherical grid, all zooms and poles/date line. Verify inverse picking using the same view state.
- Independently reconstruct control points in pyGPlates, then compare browser pin positions at all five ages and during transitions. Keep country geometry coverage tests, holes, islands, nearest-edge scoring and full-credit interior cases.
- Compare endpoint coverage with the complete source land/water masks. Unsupported motion must never make source land vanish at a guessing stop. Inspect all unmatched regions with a debug overlay that is absent from the game.
- Cartographic checks: present-day Europe/Czechia context; ancient Europe without modern anachronisms; Brazil's broad relief; Australia; fragmented Southeast Asia; Alaska/Fiji/date-line cases; Antarctica and pole crossings. No labels or political outlines during guessing.
- Interaction checks: mouse, trackpad, touch pinch, one-finger pan, tap suppression after drag, zoom limits, orientation change, device pixel ratios, background/resume and reduced-motion mode. Preserve the full journey after early success.
- Network/graphics checks: cold and warm cache, slow connection, missing tile, decoded-image failure, WebGL context loss, memory pressure and fallback. A missing fine tile must not make a click score against a blank view.
- Re-run existing tests and add raster/model/renderer checks. Record actual device/browser/viewport, payload, p50/p95 frame times, longest stalls, texture estimates and source versions. Do not call desktop viewport emulation a physical-phone performance test.
- Preserve required citations and licence notices in Sources and generated manifests. Record colour, shading, resampling, model and transition modifications. Data licences remain separate from the MIT application licence.

Done means five visually useful and correctly registered endpoint maps, useful present-day inland-country orientation, full plate-driven pin travel, supported raster transitions, honest handling of unmatched data, clean UI and demonstrated device performance. It does not mean every invisible political boundary becomes deducible from nature.

## Proposed repository pieces

- `scripts/prepare-map-assets.py`: source reading, normalization, shading and tile pyramid; explicit pinned offline dependencies.
- `scripts/prepare-model-bundle.py`: candidate rotations, domains, validity and country partition; produces coverage report.
- `data/maps/manifest.json`: source citation/licence/checksum, model ID, ages, geographic registration, tile levels, validity masks and render-style version.
- `data/maps/<style-version>/<age>/...`: static overview/detail imagery and masks.
- `data/models/<model-version>/...`: compatible motion/country bundle.
- `map-renderer.js`, `map-projection.js`, `map-tiles.js`: GPU drawing, projection parity and bounded tile lifecycle.
- Existing `geo.js`, `navigation.js`, `challenge.js`, `drift.js` remain the main shared behaviour, with model/version plumbing as needed.
- Existing experimental route remains the review surface until all gates pass; normal game is integrated afterwards.

The important first deliverable is a credible, correctly registered **physical-map comparison**, not another complete animated world made from inadequate detail.
