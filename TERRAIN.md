# Terrain experiments

The active preview at `/terrain.html` now uses five native physical-map snapshots.
See [RASTER-MAPS.md](RASTER-MAPS.md) for current controls, attribution, reproduction,
renderer and limitations. The material below documents the superseded vector study;
its generated data and tests are retained as a baseline. Its old playback controls
are no longer on the preview page.

# Earlier vector study

Run `npm start` in the repository, then open http://localhost:4173/terrain.html. The regular game remains at `/`. No additional browser dependencies, server, or API. Work lives on `experiment/paleoterrain`.

This is a visual feasibility study, not a replacement reconstruction model. Play carries the **300 Ma elevation snapshot** forward to 225 Ma with the game's existing Müller plate rotations. Today switches to the published 0 Ma snapshot. Terrain toggles the styling; drag, touch pinch, trackpad pan/pinch and reset work in this view. No country borders are added.

## Source and attribution

Christopher R. Scotese and Nicky Wright (2018), **PALEOMAP Paleodigital Elevation Models (PaleoDEMs) for the Phanerozoic**, version 2, https://doi.org/10.5281/zenodo.5460860, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Derived data in `data/terrain-study.json` retain that licence. The archive includes PALEOMAP plate polygons and rotations used for the transfer. Existing Müller et al. (2022) and upstream code attribution remain in SOURCES.md and LICENSE.

Inputs from that record:

- `Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip`, MD5 `77147998623ab039d86ff3e0b5e40344`.
- `Scotese_PaleoAtlas_v3.zip`, MD5 `9a8d16ab2d7f070ae3e89da7835ce4d4` (only PALEOMAP_PlateModel.rot and PALEOMAP_PlatePolygons.gpml used).
- DEM files: Map57 (Late Pennsylvanian, 300 Ma) and Map01 (Holocene, 0 Ma).

Changes: nearest-grid elevation sampling, cross-model transfer, contour extraction, coastline clipping, simplification and rounding. Colours are artistic elevation classes, not vegetation or climate. Relief shading is a restrained directional difference of source DEM gradients, not physically calibrated lighting.

## How the models connect

The PALEOMAP raster and Müller's reconstruction have different reference frames. We **do not** overlay their ancient longitudes directly. Offline, a modern 1° grid is partitioned against the PALEOMAP static plates. Each supported site is reconstructed under PALEOMAP to 300 Ma and samples that DEM. Its elevation becomes a material attribute at its modern location. Elevation and shading contours are clipped against Driftle's existing modern coastline fragments and inherit each fragment's Müller plate ID. Runtime uses the same quaternion interpolation, spherical coordinate helpers, date-line clipping and Canvas/D3 projection as the game.

This is an approximate cross-model transfer, not a validated geological correspondence. Static plate differences and their boundaries can create misplaced or discontinuous relief. Interpolation across different PALEOMAP plates can blur such boundaries. These issues are why this is an isolated study rather than production geography.

## Limits / promotion decision

- Only 300 Ma and 0 Ma elevation snapshots are included. The 300→225 animation **does not depict evolving elevation**. Do not extend this fixed terrain across the whole game as if it were age-specific.
- Source resolution is 1°; smoothing contours cannot create finer geological detail. The generated shapes simplify to 0.25° and drop very small patches.
- Modern coastline masks remain, so ancient inland seas, real ancient shorelines, shelves and bathymetry are not represented. Negative DEM elevations remain neutral land rather than inventing water features.
- Polar-cap fragments and latitudes beyond ±85° remain neutral; unsupported sample sites are masked rather than assigned an identity rotation. Grid-site counts are diagnostic, **not a land-area coverage percentage**.
- This adds about 2 MB of static data to the experimental route only. The normal game does not fetch it.
- Before promotion: inspect the transferred mountain belts against the source maps, improve plate-boundary transfer, and measure animation performance on physical phones. This experiment is not yet sufficient to claim scientifically validated ancient terrain.

The study also simplifies its display-only coastlines to 0.18°; original model and scoring geometry remain untouched.

## Reproduce

Python environment: pygplates 1.0.0, shapely 2.2.0, numpy 2.5.4, netCDF4 1.7.5.1.post1, contourpy 1.4.0. Download the two archives from the DOI record, extract the two model files to a directory, then:

```
python scripts/prepare-terrain-study.py /path/to/paleodem.zip /path/to/model-directory
```

The source archive is not needed to run the app; generated attributed assets are committed. The importer uses planar, locally unwrapped clipping for cartographic display, not spherical geological deformation.

## Verification

27 Node tests pass, including terrain provenance, plate inheritance, local date-line edges and rigid material motion. Browser checks covered playback ending at 225 Ma, Terrain off/on, 0 Ma comparison, desktop and 390×844 phone layouts. After display simplification and subpixel fragment culling, the 1440×900 preview recorded 248 rendered frames over nine seconds (about 27 fps; mean drawing time 35.8 ms). This is not a 60 fps result or a physical-phone benchmark. A fixed terrain snapshot and the cross-model correspondence still need scientific review before promotion.
