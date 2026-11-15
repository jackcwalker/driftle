# Verification — 15 November 2026

`npm test`: 24 tests pass. No dependency installation required.

- Six interior points fall inside their Natural Earth modern-country polygons.
- Reconstructed points agree with the bundled GPlates coordinate samples at 0,
  160, 200, 240, 260 and 300 Ma within 100 metres. Both derive from the same model;
  this is a transformation check, not independent validation of ancient geography.
- Every half-million-year age returns finite coordinates for supported points;
  unknown plates and ages above 300 Ma return unsupported.
- Distance wraps the date line, handles antipodes, and scores early/close guesses.
- Quaternion sign invariance and projection inverse/antimeridian clipping pass.
- Every source feature at each valid 5 Ma sample is projected and checked against
  accidental near-global fill. This caught the exact-pole clipping bug and passes
  after rendering-only pole regularization. Original data is unchanged.

## Browser / computer verification

Used the Codex in-app browser against the actual Python server at localhost:4173.
Inspected screenshots at the default browser size, 390×844 phone and 1440×900
desktop sizes. Checked the 300 Ma map and present-day map visually, including the
previously broken South Pole. The fixed present-day map shows oceans and land.

Exercised map click selection, keyboard selection, confirm/Pick, all five ages,
score accumulation, country/result reveal, local progress restoration, Begin and
restart, zoom, and numbered previous pins. During a drift the Pick button is
disabled and the displayed geological age changes; after playback it reaches the
next exact age. Four transitions end at 0 Ma, with no fabricated future data.
The revised full-screen design displays the country name immediately and keeps
score/instructions in overlays. No browser warning/error logs were observed in
the revised flow. Some browser wait-for-text assertions hit the tool's short
selector deadline during animation; subsequent DOM snapshots verified the correct
endpoints. No FPS or low-end-device performance benchmark has been performed.

## Limits of verification

No real-device touch test, screen-reader test, cross-browser matrix or deployed
Cloudflare test. Unit tests exercise antimeridian projection and distance, not
all possible spherical configurations at every animation frame. Exact ancient
positions remain model estimates. No unsupported country's reconstruction has
been fabricated. This first catalogue is intentionally limited to six supported
points; whole-country territory reconstruction is outside this MVP.

The revised flow also checks that moving a later keyboard pin cannot mutate an
earlier recorded guess. Saved scores were verified unchanged after reload
(400 + 238 = 638 for the first two browser test guesses).

## Follow-up: seams, moving pins and round feedback

Removed source-piece strokes and the coordinate grid. Land renders in one fill.
Added tests that inverse-partition a 300 Ma South American land click, verify the
plate assignment, reconstruct the pin at multiple ages through today, and check
that it travels over 1,000 km. Verified ocean fallback stays fixed. Feedback tests
cover verdict, earned score, compass bearing across the date line and improvement.
Browser testing confirmed a 300 Ma land pick 9 km from the target earned 4,974 pts,
showed immediate feedback, and reached 225 Ma with a plate-attached pin. The next
round starts automatically after the drift, without a Next guess step. Feedback
stays visible until the player selects a new location.

Follow-up verification: after a pick, feedback stayed visible through the drift;
the map reached 225 Ma and accepted a new location immediately, clearing the old
feedback. No Next guess control or plate-motion status message remains.

## Map navigation follow-up

Added pure tests for preserving the map location under the pinch/wheel anchor,
minimum/maximum zoom, two-axis trackpad pan and wheel delta-unit normalization.
Browser verified 100% → 150% → 225% zoom, responsive resize at 390×844, and an
actual drag visibly moving the map without enabling Pick or adding a guess.
Two-finger touch is handled by D3's established pinch gesture implementation,
with explicit pointer-movement/multitouch suppression of accidental picks.
Physical phone pinch and physical trackpad hardware have not been tested.

## Final results overlay

Removed the results dialog and replay slider. The final modern country layer is
tested for target-point containment and pathological global polygon fill. Results
show a total and per-guess distance, points and modern arrival country; distances
remain measured at the guessed age, not at the modern arrival.

Browser confirmed the final state renders as a normal page region, not a dialog:
five guess rows, total score, arrival-country names, target-country highlight and
country boundaries are visible simultaneously. The map remains zoomable and the
results panel can collapse. No replay slider is present.

## Country-wide scoring correction

The old interior-point scoring rule has been replaced. Regression tests require
São Paulo, Rio de Janeiro, Porto Alegre and Brasília areas to receive the full
round maximum at every guessing age, even far from the former target point.
A separate test reconstructs Czechia's three distinct plates and checks all
three pieces receive full credit. Tests also cover nearest-edge rather than
centroid distance, holes, segment endpoints, islands, antimeridian geometry and
rejection of unsupported historical territory. The existing save-load snapshot
test now runs under territory scoring.

Browser: on a separate archive challenge (2026-11-09), a 300 Ma Brazil location
near reconstructed Brasília received exactly 5,000 / 5,000 with Country found /
In Brazil feedback, and advanced to the next round. Original today's saved guesses
remain intact and are re-evaluated when loaded.

Saved-game browser check: today's original five guesses were kept and the total
changed from 1,277 (old point rule) to 4,464 under nearest-country-edge scoring.
Exact supported rotation samples are also tested beside an unavailable sample,
to prevent accidental interpolation into missing geological data.

## Immediate play and early success

Removed Begin; the first map selection is available as soon as the data loads.
Outcome tests require a first-round success to secure 15,000, a later success to
preserve previous miss deductions, five misses to finish normally, and legacy
saved games to stop at their first in-country success. Automatically credited
rounds carry no coordinates and never create pins.

An early success now plays continuously from the successful age to 0 Ma at the
normal geological playback speed (18 seconds from 300 Ma; 6 with reduced motion).
No further picks are accepted while it runs. Results appear only at the end.
Saved completed wins restore to the final map without replaying the journey.

Browser verified a fresh first-round success immediately secured 15,000 while
the map remained in motion at 297 Ma with Pick disabled and no results overlay.
After continuous playback reached 0 Ma, results showed one actual pick and four
explicitly awarded rounds. No Begin button was present.

## Clean controls and winning drift (2026-11-15)

29 automated tests pass. New frame-clock checks cover a full 300→0 Ma win,
75 Ma miss, endpoint clamping and a backward timestamp without reversing drift.
Browser verification: a correct 300 Ma Brazil pick awards 15,000, animates to
0 Ma before showing results, and an immediate reload restarts the unfinished
winning journey (observed at 285 Ma, then completed at 0). Random reset changed
Brazil → Czechia → Australia, each at 300 Ma with zero score; no date input
remains. Result legend and explanatory paragraph are removed.
Random test rounds do not persist over the daily challenge. Legacy saved arrays
are migrated; completed winning saves without arrival metadata replay once.


## Five-endpoint raster proof — 15 November 2026

- All 33 Node tests pass. New checks compare the shader's shared Equal Earth
  coefficients/reference inverse with D3 at poles and the date line, verify every
  endpoint asset/hash and registration metadata, reject river-line/name data in
  the lake overlay, and check all five reconstructed Europe camera views.
- In-app browser: 1440×900 and 390×844 viewport layouts; every age selected,
  Europe reference framing, World/reset, zoom control and drag panning checked.
  All five age labels and pressed states update; no console errors/warnings.
- Ancient views now have reduced relief smoothing, stronger elevation colours and
  more directional/local contrast. Modern rivers are removed. Native modern
  European detail extends westward across France/Britain, rather than stopping
  at Greenwich. No political boundaries or labels are added.
- 180-frame horizontal pan benchmark, desktop DPR 1: 8.43 ms mean / 9.30 ms p95
  frame intervals, 2.30 ms p95 CPU draw submission, estimated 72.5 MiB textures.
  Narrow viewport, same desktop hardware: 8.33 / 9.20 ms frame intervals,
  2.50 ms p95 CPU draw submission, 18.1 MiB textures. This is RAF/CPU measurement,
  not a GPU timing result, continental drift benchmark or physical-phone test.
- WebGL2-only cartographic proof: no geological animation or gameplay migration
  in this route. Main game remains unchanged. Context restoration has a handler
  but forced context-loss recovery has not been tested on physical hardware.
- Ancient source detail is still coarse and reconstructed; zoom cannot expose
  survey-quality ancient valleys or rivers. Attribution/reproduction and the
  integration gate are documented in RASTER-MAPS.md.
