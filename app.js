import { eraPair } from "./raster-drift.js?v=terrain-game6";
import { DriftMap } from "./drift-map.js?v=terrain-game6";
import {
  dailyCountry,
  supportedCountries,
} from "./country-pool.js?v=terrain-game6";
import { driftClock } from "./drift.js";
import { challengeOutcome } from "./challenge.js";
import { zoomAround, panBy, wheelIntent } from "./navigation.js";
import {
  ages,
  renderRings,
  recordGuess,
  restoreGuess,
  attachPin,
  pinPosition,
} from "./geo.js?v=terrain-game6";
const $ = (id) => document.getElementById(id),
  d3 = window.d3,
  canvas = $("map"),
  ctx = canvas.getContext("2d"),
  terrainCanvas = $("terrain-map");
let renderer,
  manifest,
  owners,
  water,
  data,
  countries,
  modernCountries,
  territories,
  country,
  projection,
  width,
  height,
  round = 0,
  age = 300,
  guess = null,
  busy = false,
  finished = false,
  history = [],
  keyboard = [0, 0],
  run = 0;
const today = new Date().toISOString().slice(0, 10);
let testing = false;
$("about").onclick = () => $("help").showModal();
$("close").onclick = () => $("help").close();
const safeRead = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
function save() {
  if (testing) return;
  try {
    localStorage.setItem(
      "driftle-paleomap-v2-" + today,
      JSON.stringify({
        guesses: history,
        arrived: finished,
        modelHash: data.inputModelSHA256,
        countryId: country.id,
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}
async function start(restore = true, randomize = false) {
  if (!data || !countries || !renderer) return;
  testing = randomize;
  const previousCountry = country;
  run++;
  const token = run;
  renderer.ticket++;
  busy = true;
  $("feedback").hidden = true;
  finished = false;
  history = [];
  delete canvas.dataset.playback;
  round = 0;
  age = 300;
  guess = null;
  country = dailyCountry(today, countries);
  if (randomize) {
    const pool = supportedCountries(countries).filter(
      (c) => c.name !== previousCountry?.name,
    );
    country = pool[Math.floor(Math.random() * pool.length)] ?? country;
  }
  if (!country)
    throw Error("No supported country territory for this challenge");
  $("results").hidden = true;
  $("results").classList.remove("collapsed");
  document.body.classList.remove("finished");
  $("results").replaceChildren();
  $("country-name").textContent = country.name;
  ui();
  $("status").textContent = "Loading map…";
  try {
    const response = await fetch(country.url, { cache: "no-cache" });
    if (!response.ok) throw Error(`Country: ${response.status}`);
    const payload = await response.json();
    if (token !== run) return;
    if (
      payload.inputModelSHA256 !== data.inputModelSHA256 ||
      payload.country.id !== country.id
    )
      throw Error("Country reconstruction mismatch");
    country = payload.country;
    data.territories = { ...territories, countries: [payload.territory] };
    const polygons =
      country.geometry.type === "Polygon"
        ? [country.geometry.coordinates]
        : country.geometry.coordinates;
    for (const rings of [
      ...polygons,
      ...payload.territory.parts.map((p) => p.rings),
    ]) {
      if (d3.geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI)
        for (const r of rings) r.reverse();
    }
  } catch (e) {
    if (token !== run) return;
    $("status").textContent =
      "Country unavailable. Reset to retry. " + e.message;
    return;
  }
  const stored = restore ? safeRead("driftle-paleomap-v2-" + today) : null;
  const saved = Array.isArray(stored) ? stored : stored?.guesses;
  if (
    Array.isArray(saved) &&
    (!stored?.modelHash || stored.modelHash === data.inputModelSHA256) &&
    stored?.countryId === country.id &&
    saved.length <= 5 &&
    saved.every(
      (h, i) =>
        h.age === ages[i] &&
        h.countryName === country.name &&
        Array.isArray(h.guess) &&
        h.guess.length === 2 &&
        h.guess.every(Number.isFinite),
    )
  ) {
    history = challengeOutcome(
      saved.map((h, i) => restoreGuess(data, country, h, i, d3.geoContains)),
    ).guesses;
    round = Math.min(history.length, 4);
    age = ages[round];
    finished = challengeOutcome(history).finished;
  }
  const replayWin =
    finished &&
    history.some((h) => h.inside) &&
    !stored?.arrived &&
    history.at(-1).age > 0;
  if (replayWin) {
    finished = false;
    round = history.length - 1;
    age = history.at(-1).age;
  } else if (finished) {
    round = 4;
    age = 0;
  }
  $("country-name").textContent = country.name;
  busy = true;
  ui();
  $("status").textContent = "Loading map…";
  try {
    if (!(await renderer.prepare(age)) || token !== run) return;
  } catch (e) {
    if (token !== run) return;
    $("status").textContent = "Map unavailable. Reset to retry. " + e.message;
    return;
  }
  busy = false;
  if (!restore) resetView();
  ui();
  draw();
  if (!restore) save();
  if (replayWin) {
    driftTo(0, () => {
      finished = true;
      round = 4;
      reveal();
    });
  } else if (finished) reveal();
}
function ui() {
  $("round").textContent = finished
    ? "COMPLETE"
    : busy && history.some((h) => h.inside)
      ? "COUNTRY FOUND · DRIFTING TO TODAY"
      : `GUESS ${round + 1} / 5`;
  $("age").textContent = Math.round(age);
  $("age-unit").textContent = age === 0 ? "Today" : "million years ago";
  $("map-note").textContent =
    age === 0
      ? "NOAA NCEI · ETOPO 2022 · MADE WITH NATURAL EARTH"
      : "SCOTESE ET AL. · PALEOMAP 2024 · CC BY 4.0";
  const outcome = challengeOutcome(history);
  $("score").textContent = outcome.total.toLocaleString();
  $("show-results").hidden = !finished;
  $("confirm").hidden = finished || busy || !guess;
  $("confirm").disabled = busy || !guess || finished;
  $("confirm").textContent = round === 4 ? "Final pick →" : "Pick →";
  $("timeline").innerHTML = ages
    .map((a, i) => {
      const result = outcome.rounds[i];
      return `<div class="step ${i === round ? "active" : ""} ${result ? "done" : ""}">${a === 0 ? "Today" : a + " Ma"}<small>${result ? result.score.toLocaleString() + " pts<br>" + (result.automatic ? "Awarded" : result.inside ? "In country" : result.distance.toLocaleString() + " km") : "—"}</small></div>`;
    })
    .join("");
  $("status").textContent = finished
    ? `${country.name} · ${outcome.solvedRound ? "Found in " + outcome.solvedRound + (outcome.solvedRound === 1 ? " pick." : " picks.") : "Five guesses complete."}`
    : busy
      ? history.some((h) => h.inside)
        ? "Drifting to today…"
        : "Drifting…"
      : "";
  $("status").hidden = !$("status").textContent;

}
$("show-results").onclick = () => {
  if (!$("results").innerHTML) reveal();
  else $("results").hidden = !$("results").hidden;
};
let baseScale,
  baseTranslate,
  zoomTransform = d3.zoomIdentity;
let renderQueued = false;
function requestMapDraw() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    draw();
  });
}
const zoom = d3
  .zoom()
  .scaleExtent([1, 24])
  .filter((e) => !e.button)
  .touchable(() => true)
  .clickDistance(8)
  .tapDistance(12)
  .on("zoom", (e) => {
    zoomTransform = e.transform;
    $("zoom-level").textContent = Math.round(zoomTransform.k * 100) + "%";
    $("zoom-in").disabled = zoomTransform.k >= 24;
    $("zoom-out").disabled = zoomTransform.k <= 1;
    applyZoom();
    requestMapDraw();
  });
d3.select(canvas).call(zoom).on("wheel.zoom", null);
function setView(view) {
  if (!projection) return;
  const transform = d3.zoomIdentity.translate(view.x, view.y).scale(view.k);
  const bounds = [
    [0, 0],
    [width, height],
  ];
  d3.select(canvas).call(
    zoom.transform,
    zoom.constrain()(transform, bounds, zoom.translateExtent()),
  );
}
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const box = canvas.getBoundingClientRect(),
      anchor = [e.clientX - box.left, e.clientY - box.top];
    const intent = wheelIntent(e);
    setView(
      intent.kind === "zoom"
        ? zoomAround(zoomTransform, anchor, intent.factor, 1, 24)
        : panBy(zoomTransform, intent.dx, intent.dy),
    );
  },
  { passive: false },
);
// Multi-touch and drags must never become a guessed location on pointer-up.
let pointerOrigins = new Map(),
  suppressTapUntil = 0;
canvas.addEventListener("pointerdown", (e) => {
  pointerOrigins.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointerOrigins.size > 1) suppressTapUntil = performance.now() + 800;
});
canvas.addEventListener("pointermove", (e) => {
  const origin = pointerOrigins.get(e.pointerId);
  if (origin && Math.hypot(e.clientX - origin[0], e.clientY - origin[1]) > 8)
    suppressTapUntil = performance.now() + 800;
});
function releasePointer(e) {
  if (pointerOrigins.size > 1) suppressTapUntil = performance.now() + 800;
  pointerOrigins.delete(e.pointerId);
}
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

$("zoom-in").onclick = () => d3.select(canvas).call(zoom.scaleBy, 1.5);
$("zoom-out").onclick = () => d3.select(canvas).call(zoom.scaleBy, 1 / 1.5);
// A fixed, target-independent opening camera keeps Pangaea readable on phones.
// Desktop retains the complete world. Resizing preserves the player's own view.
function openingView() {
  if (width > 600 || width >= height) return d3.zoomIdentity;
  const k = 2.4;
  const center = d3.geoEqualEarth()
    .scale(baseScale)
    .translate(baseTranslate)([25, -10]);
  return {
    k,
    x: width / 2 - center[0] * k,
    y: height / 2 - center[1] * k,
  };
}
function resetView() {
  setView(openingView());
}
$("zoom-reset").onclick = resetView;
function applyZoom() {
  if (projection && baseTranslate)
    projection
      .scale(baseScale * zoomTransform.k)
      .translate([
        baseTranslate[0] * zoomTransform.k + zoomTransform.x,
        baseTranslate[1] * zoomTransform.k + zoomTransform.y,
      ]);
}
function resize() {
  const oldCenter =
    projection && width && height
      ? projection.invert([width / 2, height / 2])
      : null;
  const box = canvas.getBoundingClientRect();
  width = box.width;
  height = box.height;
  const ratio = Math.min(devicePixelRatio || 1, width < 650 ? 1.5 : 2);
  renderer.resize(width, height, ratio);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  projection = d3.geoEqualEarth().fitExtent(
    [
      [16, 85],
      [width - 16, height - 95],
    ],
    { type: "Sphere" },
  );
  baseScale = projection.scale();
  baseTranslate = projection.translate();
  const worldBounds = d3.geoPath(projection).bounds({ type: "Sphere" });
  zoom
    .extent([
      [0, 0],
      [width, height],
    ])
    .translateExtent([
      [worldBounds[0][0] - 40, worldBounds[0][1] - 40],
      [worldBounds[1][0] + 40, worldBounds[1][1] + 40],
    ]);
  if (oldCenter) {
    const center = projection(oldCenter);
    setView({
      k: zoomTransform.k,
      x: width / 2 - center[0] * zoomTransform.k,
      y: height / 2 - center[1] * zoomTransform.k,
    });
  } else resetView();
  draw();
}
function marker(coord, color, r = 5, label = null) {
  const p = projection(coord);
  if (!p) return;
  ctx.beginPath();
  ctx.arc(...p, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff8d5";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (label !== null) {
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#153b3d";
    ctx.fillText(label, p[0], p[1] + 0.5);
  }
}
function draw() {
  if (!data || !projection) return;
  const started = performance.now();
  renderer.drawAge(age, {
    scale: projection.scale(),
    translate: projection.translate(),
    k: zoomTransform.k,
  });
  ctx.clearRect(0, 0, width, height);
  const path = d3.geoPath(projection, ctx);
  ctx.save();
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.clip();
  if (age === 0 && water) {
    const rank = Math.min(9, 1.8 + Math.log2(zoomTransform.k) * 1.65);
    const scale = projection.scale(),
      translate = projection.translate();
    for (const f of water.features) {
      if (f.properties.rank > rank) continue;
      const b = f.projectedBounds;
      if (
        b[1][0] * scale + translate[0] < 0 ||
        b[0][0] * scale + translate[0] > width ||
        b[1][1] * scale + translate[1] < 0 ||
        b[0][1] * scale + translate[1] > height
      )
        continue;
      ctx.beginPath();
      path(f);
      ctx.fillStyle = "#648e9c";
      ctx.fill();
    }
  }
  if (finished && modernCountries) {
    ctx.beginPath();
    path(modernCountries);
    ctx.strokeStyle = "#cbd6bf70";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    const target = modernCountries.features.find(
      (f) => f.properties.name === country.name,
    );
    if (target) {
      ctx.beginPath();
      path(target);
      ctx.fillStyle = "#edc67560";
      ctx.fill();
      ctx.strokeStyle = "#ffe4a0";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const arrivals = new Set(
      history.map((h) => countryAt(pinPosition(data, h, 0).point)),
    );
    for (const f of modernCountries.features) {
      if (
        f.properties.name !== country.name &&
        !arrivals.has(f.properties.name) &&
        !(zoomTransform.k >= 2.5 && d3.geoPath(projection).area(f) > 550)
      )
        continue;
      const point = projection(d3.geoCentroid(f));
      if (
        !point ||
        point[0] < 0 ||
        point[0] > width ||
        point[1] < 80 ||
        point[1] > height - 55
      )
        continue;
      ctx.font =
        f.properties.name === country.name ? "bold 14px Arial" : "11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "#173d36";
      ctx.lineWidth = 3;
      ctx.strokeText(f.properties.name, ...point);
      ctx.fillStyle = "#f5f0d5";
      ctx.fillText(f.properties.name, ...point);
    }
  }
  const placed = [];
  history.forEach((h, i) => {
    const pin = pinPosition(data, h, age);
    const p = projection(pin.point);
    let coord = pin.point;
    const nearby = placed.some(
      (q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 25,
    );
    if (nearby) {
      const angle = i * 2.4,
        offset = [p[0] + Math.cos(angle) * 24, p[1] + Math.sin(angle) * 24];
      const shifted = projection.invert(offset);
      if (shifted) {
        ctx.beginPath();
        ctx.moveTo(...p);
        ctx.lineTo(...offset);
        ctx.strokeStyle = "#d0deca";
        ctx.lineWidth = 1;
        ctx.stroke();
        coord = shifted;
      }
    }
    marker(coord, pin.moving ? "#a9c2b4" : "#a6aab2", 9, String(i + 1));
    placed.push(p);
  });
  if (guess) marker(guess, "#f5cc7c", 8);

  ctx.restore();
  canvas.dataset.age = age.toFixed(3);
  canvas.dataset.terrainSource = String(renderer.stage?.from);
  canvas.dataset.terrainArrival = renderer.arrival
    ? String(renderer.arrival.from)
    : "";
  canvas.dataset.terrainSettle = String(renderer.settle ?? 0);
  canvas.dataset.drawMs = (performance.now() - started).toFixed(2);
  canvas.dataset.textureMiB = (
    (renderer.residentBytes + (renderer.framebufferBytes ?? 0)) /
    1048576
  ).toFixed(1);
  canvas.dataset.phase = busy ? "drifting" : finished ? "finished" : "picking";
}
function select(point) {
  if (!data || busy || finished || !point || !point.every(Number.isFinite))
    return;
  const p = projection(point);
  if (!p || Math.abs(point[1]) > 90) return;
  $("feedback").hidden = true;
  guess = point;
  keyboard = [...point];
  ui();
  draw();
}
canvas.onclick = (e) => {
  if (!data || !projection || busy || finished) return;
  if (performance.now() < suppressTapUntil) return;
  const b = canvas.getBoundingClientRect(),
    xy = [e.clientX - b.left, e.clientY - b.top],
    p = projection.invert(xy);
  if (p) {
    const back = projection(p);
    if (Math.hypot(back[0] - xy[0], back[1] - xy[1]) < 2) select(p);
  }
};
canvas.onkeydown = (e) => {
  if (!data || !projection) return;
  if (["+", "=", "-", "0"].includes(e.key)) {
    e.preventDefault();
    if (e.key === "0") resetView();
    else d3.select(canvas).call(zoom.scaleBy, e.key === "-" ? 1 / 1.5 : 1.5);
    return;
  }
  if (!data || busy || finished) return;
  let step = e.shiftKey ? 1 : 5;
  if (e.key === "ArrowLeft") keyboard[0] -= step;
  else if (e.key === "ArrowRight") keyboard[0] += step;
  else if (e.key === "ArrowUp") keyboard[1] = Math.min(89, keyboard[1] + step);
  else if (e.key === "ArrowDown")
    keyboard[1] = Math.max(-89, keyboard[1] - step);
  else if (e.key !== "Enter") return;
  e.preventDefault();
  keyboard[0] = ((keyboard[0] + 540) % 360) - 180;
  select([...keyboard]);
};
function record(g, i) {
  const result = recordGuess(data, country, g, i, d3.geoContains);
  return {
    ...result,
    attachment:
      result.territoryAttachment ??
      (renderer.ownerAt(g, ages[i])
        ? attachPin(data, g, ages[i], d3.geoContains)
        : null),
  };
}
$("confirm").onclick = () => {
  if (busy || !guess || finished) return;
  const h = record(guess, round);
  history.push(h);
  $("feedback").hidden = false;
  $("guess-distance").textContent = h.inside
    ? `In ${country.name}`
    : (h.distance === 0
        ? "Less than 1 km"
        : h.distance.toLocaleString() + " km") + " from border";
  $("earned").textContent = `+${h.score.toLocaleString()} pts`;
  guess = null;
  save();
  if (round === 4) {
    finished = true;
    guess = null;
    ui();
    draw();
    reveal();
    return;
  }
  driftTo(h.inside ? 0 : ages[round + 1], () => {
    if (h.inside) {
      finished = true;
      round = 4;
      reveal();
    } else {
      round++;
      ui();
      draw();
    }
  });
};
async function driftTo(to, onArrival) {
  busy = true;
  ui();
  const token = run,
    frames = [],
    draws = [];
  let previousFrame;
  const segmentDuration = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 1500
    : 4500;
  try {
    while (age > to) {
      const from = age,
        end = Math.max(to, eraPair(from)[1]);
      renderer.beginDrift(end);
      const clock = driftClock(from, end, segmentDuration);
      const arrived = await new Promise((resolve) => {
        function frame(now) {
          if (token !== run) {
            resolve(false);
            return;
          }
          const state = clock(now);
          age = state.age;
          draw();
          $("age").textContent = Math.round(age);
          if (previousFrame !== undefined) frames.push(now - previousFrame);
          previousFrame = now;
          draws.push(+canvas.dataset.drawMs);
          if (!state.done) requestAnimationFrame(frame);
          else resolve(true);
        }
        requestAnimationFrame(frame);
      });
      if (!arrived || token !== run) return;
      // The destination is first requested after movement arrives, never shown
      // underneath the departing continents. Keep the moved landscape on screen
      // while it loads, then settle at the fixed destination age.
      if (!(await renderer.loadArrival(age)) || token !== run) return;
      const settleClock = driftClock(1, 0, 320);
      const settled = await new Promise((resolve) => {
        function frame(now) {
          if (token !== run) {
            resolve(false);
            return;
          }
          const state = settleClock(now);
          renderer.settle = 1 - state.age;
          draw();
          if (!state.done) requestAnimationFrame(frame);
          else resolve(true);
        }
        requestAnimationFrame(frame);
      });
      if (!settled || token !== run) return;
      renderer.commitArrival();
      draw();
    }
    const percentile = (a, p) =>
      a.toSorted((a, b) => a - b)[Math.floor((a.length - 1) * p)];
    canvas.dataset.playback = JSON.stringify({
      frames: frames.length,
      meanFrameMs: frames.reduce((a, b) => a + b, 0) / frames.length,
      p95FrameMs: percentile(frames, 0.95),
      p95CpuDrawMs: percentile(draws, 0.95),
      textureMiB:
        (renderer.residentBytes + (renderer.framebufferBytes ?? 0)) / 1048576,
    });
    guess = null;
    busy = false;
    onArrival();
  } catch (e) {
    if (token !== run) return;
    $("status").textContent = "Map unavailable. Reset to retry. " + e.message;
  }
}

function countryAt(point) {
  return (
    modernCountries?.features.find((f) => d3.geoContains(f, point))?.properties
      .name ?? "Ocean"
  );
}
function reveal() {
  save();
  const r = $("results");
  document.body.classList.add("finished");
  $("feedback").hidden = true;
  age = 0;
  ui();
  draw();
  const outcome = challengeOutcome(history),
    total = outcome.total;
  r.hidden = false;
  r.innerHTML = `<div class="results-heading"><div><small>DAILY RESULTS</small><h2>${country.name}</h2></div><button id="collapse-results" aria-label="Collapse results" aria-expanded="true">−</button></div><div class="results-content"><div class="final-score">${total.toLocaleString()} <small>/ 15,000</small></div><p class="map-legend">${outcome.solvedRound ? `Found in ${outcome.solvedRound} ${outcome.solvedRound === 1 ? "pick" : "picks"}. ` : "Five picks complete."}</p><table><thead><tr><th>Pick</th><th>Distance</th><th>Points</th></tr></thead><tbody>${outcome.rounds.map((h, i) => `<tr><td>${h.automatic ? "Awarded" : `<b>${i + 1}</b>`} · ${h.age === 0 ? "Today" : h.age + " Ma"}<small>${h.automatic ? "" : countryAt(pinPosition(data, h, 0).point)}</small></td><td>${h.automatic ? "Full points" : h.inside ? "In country" : (h.distance === 0 ? "&lt;1" : h.distance.toLocaleString()) + " km"}</td><td>${h.score.toLocaleString()}</td></tr>`).join("")}</tbody></table><div class="results-actions"><button id="share">Copy result</button><button id="play-again">Play again</button></div><span id="copy-status" role="status"></span></div>`;
  $("collapse-results").onclick = () => {
    const collapsed = r.classList.toggle("collapsed");
    $("collapse-results").textContent = collapsed ? "+" : "−";
    $("collapse-results").setAttribute("aria-expanded", String(!collapsed));
    $("collapse-results").setAttribute(
      "aria-label",
      collapsed ? "Expand results" : "Collapse results",
    );
  };
  $("play-again").onclick = () => {
    r.classList.remove("collapsed");
    start(false, testing);
  };
  $("share").onclick = async () => {
    const msg = `Driftle ${today}\n${outcome.total.toLocaleString()} / 15,000\n${outcome.rounds.map((h) => (h.automatic ? "⭐" : h.inside ? "🟩" : "🟨")).join("")}\n${new URL("./", location.href).href}`;
    try {
      await navigator.clipboard.writeText(msg);
      $("copy-status").textContent = " Copied!";
    } catch {
      $("copy-status").textContent = msg;
    }
  };
}
$("restart").onclick = () => start(false, true);
try {
  [data, countries, modernCountries, territories, manifest, owners] =
    await Promise.all(
      [
        "data/paleomap/motion.json",
        "data/paleomap/countries.json",
        "data/modern-countries.json",
        "data/paleomap/territories.json",
        "data/maps/raster-v2/manifest.json",
        "data/paleomap/owners.json",
      ].map(async (url) => {
        const response = await fetch(url, { cache: "no-cache" });
        if (!response.ok) throw Error(`${url}: ${response.status}`);
        return response.json();
      }),
    );
  for (const f of modernCountries.features) {
    f.geometry.coordinates = f.geometry.coordinates.map((rings) => {
      let r = renderRings(rings);
      if (d3.geoArea({ type: "Polygon", coordinates: r }) > 2 * Math.PI)
        r = r.map((ring) => ring.toReversed());
      return r;
    });
  }
  if (
    data.model !== territories.model ||
    data.model !== owners.model ||
    data.inputModelSHA256 !== manifest.inputHashes["paleomap2024-model.zip"] ||
    data.inputModelSHA256 !== territories.inputModelSHA256 ||
    data.inputModelSHA256 !== owners.inputModelSHA256
  )
    throw Error("Terrain, motion and scoring model mismatch");
  territories.rotations = data.rotations;
  data.territories = territories;
  renderer = new DriftMap(terrainCanvas, data, manifest, owners);
  water = await (await fetch(manifest.water.url)).json();
  const rawPath = d3.geoPath(d3.geoEqualEarth().scale(1).translate([0, 0]));
  for (const f of water.features) {
    const polygons =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;
    for (const rings of polygons)
      if (d3.geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI)
        for (const r of rings) r.reverse();
    f.projectedBounds = rawPath.bounds(f);
  }
  // Pins on newly partitioned pieces use the very same model rotations.
  for (const [pid, samples] of Object.entries(territories.rotations))
    if (!data.rotations[pid]) data.rotations[pid] = samples;
  if (!supportedCountries(countries).length)
    throw Error("No supported challenges");
  for (const f of data.features) {
    f.rings = renderRings(f.rings);
    if (d3.geoArea({ type: "Polygon", coordinates: f.rings }) > 2 * Math.PI)
      f.rings = f.rings.map((r) => [...r].reverse());
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  await start();
} catch (error) {
  $("status").textContent =
    "Could not load the reconstruction. Reload to retry. " + error.message;
  $("mapstatus").textContent = "DATA UNAVAILABLE";
}

terrainCanvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  run++;
  busy = true;
  ui();
  $("status").textContent = "Restoring map…";
});
terrainCanvas.addEventListener("webglcontextrestored", async () => {
  renderer = new DriftMap(terrainCanvas, data, manifest, owners);
  resize();
  await start(true, false);
});
