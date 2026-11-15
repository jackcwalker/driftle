# Verification — 15 November 2026

`npm test`: 13 tests pass. No dependency installation required.

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
