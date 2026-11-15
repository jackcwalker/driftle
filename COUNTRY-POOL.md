# Country pool

The pool contains **countries and territories**, as selected for this game. The
source file contains 258 features, including administrative units, leases and
indeterminate geographic fragments. The published Natural Earth `TYPE` metadata
and source ISO codes distinguish these before reconstruction checks:

- Country, sovereign-country, sovereignty, dependency and disputed administrative
  units remain candidates.
- Leases are excluded. Indeterminate features need their own assigned ISO code.
  This retains Palestine and Western Sahara while removing the ice fields,
  glaciers, reefs, river-island fragments and other uncoded features.
- Territories such as Greenland, Aland, Aruba and Ashmore/Cartier remain candidates.
  This is not a sovereign-state-only roster.

**247 source units are countries/territories. 109 pass the reconstruction audit;
138 fail technical checks. Eleven other source features are not game targets.**
There is no hand-picked country allowlist, minimum size or difficulty filter.

The [support report](data/paleomap/country-support.json) records all 258 source
features, their target-unit classification and separate reconstruction results.
[data/country-kinds.json](data/country-kinds.json) preserves the publisher's
administrative metadata and archive checksum. This corrects the earlier mistake
of treating every feature in an admin-0 file as a country/territory.

Daily selection cycles evenly through eligible targets in stable ID order. Random
reset selects a different target and does not overwrite the daily save. Saves
validate country ID and model hash, so a changed pool cannot reinterpret another
country's guesses.

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
| `non-country-feature` | A lease or uncoded indeterminate geographic feature, outside the chosen target scope. |

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
python scripts/prepare-country-kinds.py NE_ADMIN_COUNTRIES_ZIP
python scripts/prepare-game-maps.py SOURCE_DIRECTORY COUNTRIES_GEOJSON --countries-only
npm test
```

Input SHA-256: `392a03db8aa3ba82c105852655620129b11182b95dfc34ef046827ea7d0e5b8c`.
Natural Earth coordinates retain their public-domain/PDDL terms. Derived plate
partitions and rotations retain PALEOMAP's CC BY 4.0 terms and Scotese, Vérard,
Burgener, Elling and Kocsis attribution. See SOURCES.md for full notices.

Administrative metadata: Natural Earth Admin 0 Countries v5.1.1, public domain,
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/.
Archive SHA-256: `ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6`.
Only classification attributes are added; existing country geometries and
geological rotations are unchanged.
