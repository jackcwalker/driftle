# Physical map preview

Run `npm start`, then open <http://localhost:4173/terrain.html?view=europe>.
These five endpoint maps are also integrated into the playable game at `/`, with
matching PALEOMAP motion, country scoring and pins. This route remains a static
cartographic comparison. See [GAME-MAP-INTEGRATION.md](GAME-MAP-INTEGRATION.md)
for playback, model validation and integration details.

Choose 300, 225, 150, 75 Ma or Today. Europe follows nine supported European
reference sites under the accompanying PALEOMAP model, so ancient comparisons
show the relevant reconstructed region rather than today's European coordinates.
These camera references are not target-country geometry. World resets the view.
Drag to pan, pinch to zoom; trackpad scroll pans and Ctrl+wheel zooms. Keyboard
`+`, `−`, and `0` work when the map has focus.

## Cartography and limits

- Four exact ancient 0.1° elevation snapshots supply real age-specific shorelines,
  inland seas, shelves, mountain systems and basins. No modern coastline mask is
  applied. Colours indicate elevation, not historical vegetation or climate.
- Elevation tints and multidirectional relief are baked offline. Relief uses
  physical horizontal cell sizes adjusted for latitude. Ancient relief is
  exaggerated sevenfold for readability; modern relief uses 1.6×. These are
  artistic display choices, not changes to the source elevation values.
- Compared with the first raster proof, ancient gradient smoothing is reduced
  from 0.75 to 0.35 pixels, relief contrast is stronger, elevation colours are
  less pale, and a bounded high-pass adjustment from the same DEM clarifies
  existing terrain edges. No procedural texture or invented valleys are added.
- The source's 0.1° sampling is approximately 11 km north–south. The ancient maps
  were derived from indexed elevation maps and contain only 171–212 distinct
  heights at these four ages. Broad, soft reconstructed landforms remain visible
  on close zoom. More pixels or sharpening cannot supply missing geological detail.
- Modern terrain uses measured ETOPO 2022 elevation and bathymetry: approximately
  6-minute global sampling and native 1-minute input over Europe. The European
  inset covers 20°W–50°E, 30–72°N and blends into the global map while zooming.
  The final inset is 3600×2160; mobile uses 1800×1080. Other regions retain the
  coarser global sampling.
- The modern river overlay has been removed completely. We do not carry modern
  rivers into ancient eras. Natural Earth natural lakes remain on Today; ancient
  water comes only from the published ancient elevation grids. No river drainage
  is inferred from these coarse reconstructed surfaces.
- No political borders or place names appear. Mountain shapes and coastlines
  are approximate reconstructions, not independently validated historical facts.

## Sources, licences and changes

**Ancient terrain and Europe camera model:** Christopher R. Scotese, Christian
Vérard, Landon Burgener, Reece P. Elling and Ádám T. Kocsis (2024), *Phanerozoic-scope
supplementary material to “The Cretaceous World: Plate Tectonics, Paleogeography,
and Paleoclimate” from the PALEOMAP project*, version v24221,
[Zenodo record 10659112](https://zenodo.org/records/10659112),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Derived ancient rasters and camera references retain this licence and attribution.

Input `5a. PaleoDEM (nc, 3601x1801).zip`, renamed `paleodem-2024.zip`:
`300_v23230d.nc`, `225_v23221.nc`, `150_v23220d.nc`, `075_v24085.nc`.
Input `3a. PALEOMAP Global Plate Model for Paleogeographic Reconstructions v.19o_r1d.zip`,
renamed `paleomap2024-model.zip`: rotation file
`Scotese_Plate_Model_forPgeog_v19o_r1d_v240506a.rot` and static polygons
`Scotese_Plate_Polygons__forPgeog_v19o_v240506.gpml`.
Changes: node-to-pixel-centre averaging, duplicate seam removal, tints, relief,
WebP encoding and downsampled mobile variants. Supported reference sites are
reconstructed with pyGPlates; missing rotations cause an error, never identity.

**Modern elevation:** NOAA National Centers for Environmental Information,
*ETOPO 2022 v1 60 arc-second ice-surface global relief model*, served by
[NOAA ERDDAP](https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.html).
That service permits free use and redistribution with source credit. Changes:
subsampling, coordinate resampling, regional cropping, tints, relief and encoding.
This proof uses ETOPO rather than the plan's GEBCO candidate because the official
subset service supplied reproducible, appropriately sized inputs.

**Modern lakes:** Made with Natural Earth; Tom Patterson, Nathaniel Vaughn Kelso
and contributors. [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/),
public domain. Changes: retain `Lake` features only, exclude reservoirs, filter
scale ranks through 9, simplify at 0.006°, round coordinates to four decimals,
remove all names. Rivers are neither distributed nor drawn in this proof.

Preparation uses NumPy, SciPy, netCDF4, Pillow, pyshp, Shapely and pyGPlates, solely
offline. Existing D3, upstream code and Müller data terms remain in SOURCES.md.
The generated manifest records source URLs, transformations, input SHA-256 hashes,
and image dimensions, sizes and SHA-256 hashes.

## Reproduce

The generated assets are committed; none of these tools or source downloads are
needed to run the site. For regeneration, use Python 3.12 with NumPy 2.5.4,
SciPy 1.18.1, netCDF4 1.7.5.1.post1, Pillow 13, pyshp 3.1.8, Shapely 2.2 and
pyGPlates 1.0. Download the two named archives from the Zenodo record. Extract
the rotation and static polygon files into `SOURCE_DIRECTORY/model2024/`.

Download the [Natural Earth lakes archive](https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_lakes.zip)
as `ne-lakes.zip`. Use NOAA's endpoint
`https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.nc` with these
literal, URL-encoded-as-needed query suffixes:

| Save as | Query |
| --- | --- |
| `etopo-world-6min.nc` | `?z[0:6:10799][0:6:21599]` |
| `etopo-europe-west-1min.nc` | `?z[7200:1:9719][20400:1:21599]` |
| `etopo-europe-east-1min.nc` | `?z[7200:1:9719][0:1:2999]` |

Then run:

```sh
python scripts/prepare-raster-maps.py SOURCE_DIRECTORY
npm test
```

The output is `data/maps/raster-v2/`. Longitude is periodic; latitude is clamped
at the poles. Global images have 3600×1800 pixel-centred cells, north to south,
with no duplicated date-line column. Mobile overviews have 1800×900 cells.

## Renderer and verification

A small WebGL2 renderer projects geographic textures into the game's Equal Earth
view in a fragment shader. Terrain complexity does not increase triangle count.
Raster filtering uses mipmaps; DPR is capped at 2 on desktop and 1.5 on narrow
screens. A two-texture LRU cache bounds steady-state decoded raster memory;
in-flight age changes may briefly hold additional textures. Concurrent duplicate
loads are shared. Lakes use a separate canvas, scale-rank filtering and cached
projected bounds for culling. No external requests occur during play.

WebGL2 is currently required by this experimental route. Unsupported browsers show
an error rather than an inaccurate fallback. Texture restoration is handled after
context loss. The integrated game also requires WebGL2 for terrain.

`?view=europe&benchmark=1` runs 180 frames of horizontal panning and reports RAF
intervals, CPU draw submission time and estimated uncompressed texture storage.
This is a static pan benchmark, not a geological-animation benchmark or GPU timer.
Desktop 1440×900 at DPR 1: mean frame interval 8.43 ms, 95th percentile 9.30 ms;
95th-percentile CPU draw submission 2.30 ms; approximately 72.5 MiB textures.
At a 390×844 viewport on the same desktop browser, the overview path measured
8.33 ms mean / 9.20 ms p95 frame intervals, 2.50 ms p95 CPU draw submission and
18.1 MiB textures. These measurements describe this desktop browser only. Physical-phone performance
and geological playback are not established by them.

Tests compare the Equal Earth projection against bundled D3 at the poles and
date line, verify all five assets and hashes, assert river-free unnamed water
geometry, and check reconstructed Europe camera samples. Existing game scoring,
motion and date-line tests remain in place. See TESTING.md for browser checks.

The maps are now in gameplay with the matched PALEOMAP country partition and
transition renderer described in GAME-MAP-INTEGRATION.md. Müller remains a
regression baseline; its ancient country coordinates are not used under these maps.
