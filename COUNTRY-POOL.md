# Country pool

The game screens **all 258 country/territory features** in the bundled preparation
source, Natural Earth via [datasets/geo-countries](https://github.com/datasets/geo-countries/blob/master/data/countries.geojson).
There is no hand-picked allowlist, minimum size, difficulty filter, continent quota
or recognition test. This follows the source's geographic units, including
territories and disputed areas; it is not a list of sovereign states.

**116 pass; 142 fail technical checks** against PALEOMAP 2024 v24221.
The daily challenge cycles evenly through eligible entries in stable ASCII ID
order, using the UTC epoch day. Random reset selects a different eligible entry
and does not write over the daily save. Saves use a new `paleomap-v2` namespace
and validate the country ID as well as the model archive hash.

## Eligibility

The original complete modern geometry, including islands and holes, is partitioned
across the published present-day static material domains. A piece is supported only
when its source domain spans 300–0 Ma and every 5 Ma rotation sample exists. Missing
rotations never become identity. Great-circle edges are densified to at most 0.05°;
intersections use locally unwrapped longitudes and retain separate date-line pieces.

A target needs positive source geometry and at least one continuously supported
piece. Its combined unassigned and unsupported fraction must be **below 0.01%**,
the existing numerical support threshold. Fractions use locally unwrapped
longitude/latitude coordinate area, not physical area or an accuracy estimate.
Tiny unsupported fragments below the threshold are omitted at ancient ages;
0 Ma scoring uses the complete original country geometry. Country territory may
have been underwater. No deformation, missing plate motion or ancient borders
are fabricated.

The machine-readable [support report](data/paleomap/country-support.json) records
every source entry, exact fractions and exclusion reason codes:

| Reason | Technical cause |
| --- | --- |
| `unassigned-territory` | Too much modern territory lies outside the published material domains. |
| `unsupported-rotation-or-domain-lifetime` | Assigned material lacks the required source lifetime or rotation samples. |
| `combined-support-gap` | Individually small gaps exceed the threshold when combined. |
| `no-continuously-supported-territory` | No material piece can be followed through the whole game. |
| `empty-geometry` | No positive source geometry is available. |

Examples retained include Brazil, Czechia, Belgium, Greenland, Vietnam, Monaco,
Vatican and the United Kingdom. India and the USA still fail the technical audit.
Their exclusion is not a gameplay or difficulty decision.

## Loading and reproduction

`data/paleomap/countries.json` is a small catalogue. Each eligible entry points to
one full geometry/partition bundle in `countries/`; the browser downloads only the
selected target's bundle. Full-pool geometry is not loaded into a game session.
`territories.json` is a lightweight metadata index, sharing `motion.json` rotations.
The independent pyGPlates reference coordinates cover every source entry.

From the scientific preparation environment in GAME-MAP-INTEGRATION.md:

```sh
python scripts/prepare-game-maps.py SOURCE_DIRECTORY COUNTRIES_GEOJSON --countries-only
npm test
```

Input SHA-256: `392a03db8aa3ba82c105852655620129b11182b95dfc34ef046827ea7d0e5b8c`.
Natural Earth coordinates retain their public-domain/PDDL terms. Derived plate
partitions and rotations retain PALEOMAP's CC BY 4.0 terms and Scotese, Vérard,
Burgener, Elling and Kocsis attribution. See SOURCES.md for full notices.
