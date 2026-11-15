import { challengeOutcome } from "./challenge.js";
import { zoomAround, panBy, wheelIntent } from "./navigation.js";
import { rotationAt } from "./vendor/motion.js";
import {
  ages,
  vector,
  rotate,
  lonlat,
  position,
  distance,
  points,
  dailyIndex,
  renderRings,
  recordGuess,
  attachPin,
  pinPosition,
  feedback,
} from "./geo.js";
const $ = (id) => document.getElementById(id),
  d3 = window.d3,
  canvas = $("map"),
  ctx = canvas.getContext("2d");
let data,
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
$("date").value = today;
$("date").max = today;
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
  try {
    localStorage.setItem(
      "driftle-v2-" + $("date").value,
      JSON.stringify(history),
    );
  } catch {
    /* Storage is optional. */
  }
}
function valid(c) {
  const t = data.territories?.countries.find((t) => t.name === c.name);
  return t && (t.unpartitionedArea + t.unsupportedArea) / t.sourceArea < 0.0001;
}
function start(restore = true) {
  run++;
  busy = false;
  $("feedback").hidden = true;
  finished = false;
  history = [];
  round = 0;
  age = 300;
  guess = null;
  const startIndex = dailyIndex($("date").value, countries.length);
  country = Array.from(
    { length: countries.length },
    (_, i) => countries[(startIndex + i) % countries.length],
  ).find(valid);
  if (!country)
    throw Error("No supported country territory for this challenge");
  $("results").hidden = true;
  $("results").classList.remove("collapsed");
  document.body.classList.remove("finished");
  $("results").replaceChildren();
  const saved = restore ? safeRead("driftle-v2-" + $("date").value) : null;
  if (
    Array.isArray(saved) &&
    saved.length <= 5 &&
    saved.every(
      (h, i) =>
        h.age === ages[i] &&
        (h.countryName === country.name ||
          (!h.countryName && country.name === countries[startIndex].name)) &&
        Array.isArray(h.guess) &&
        h.guess.length === 2 &&
        h.guess.every(Number.isFinite),
    )
  ) {
    history = challengeOutcome(saved.map((h, i) => record(h.guess, i))).guesses;
    save(); // Migrate old point-based scores without changing the original guesses.
    round = Math.min(history.length, 4);
    age = ages[round];
    finished = challengeOutcome(history).finished;
  }
  $("country-name").textContent = country.name;
  ui();
  draw();
  if (finished) reveal();
}
function ui() {
  $("round").textContent = finished
    ? "COMPLETE"
    : busy && history.some((h) => h.inside)
      ? "COUNTRY FOUND · DRIFTING TO TODAY"
      : `GUESS ${round + 1} / 5`;
  $("age").textContent = Math.round(age);
  $("age-unit").textContent = age === 0 ? "Today" : "million years ago";
  const outcome = challengeOutcome(history);
  $("score").textContent = outcome.total.toLocaleString();
  $("show-results").hidden = !finished;
  $("confirm").hidden = finished;
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
        ? "Full points secured. Drifting to today…"
        : "Drifting 75 million years…"
      : guess
        ? "Pick this location?"
        : `Click where ${country.name} was.`;
  $("mapstatus").textContent = busy
    ? ""
    : finished
      ? "GOLD: ANSWER · NUMBERED PINS: YOUR GUESSES"
      : guess
        ? `${Math.abs(guess[1]).toFixed(1)}° ${guess[1] < 0 ? "S" : "N"} · ${Math.abs(guess[0]).toFixed(1)}° ${guess[0] < 0 ? "W" : "E"}`
        : "";
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
  .scaleExtent([1, 8])
  .filter((e) => !e.button)
  .touchable(() => true)
  .clickDistance(8)
  .tapDistance(12)
  .on("zoom", (e) => {
    zoomTransform = e.transform;
    $("zoom-level").textContent = Math.round(zoomTransform.k * 100) + "%";
    $("zoom-in").disabled = zoomTransform.k >= 8;
    $("zoom-out").disabled = zoomTransform.k <= 1;
    applyZoom();
    requestMapDraw();
  });
d3.select(canvas).call(zoom).on("wheel.zoom", null);
function setView(view) {
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
        ? zoomAround(zoomTransform, anchor, intent.factor)
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
$("zoom-reset").onclick = () => setView(d3.zoomIdentity);
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
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  projection = d3
    .geoEqualEarth()
    .rotate([0, 0.01])
    .fitExtent(
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
  } else setView(zoomTransform);
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
  ctx.clearRect(0, 0, width, height);
  const path = d3.geoPath(projection, ctx);
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = "#1c4849";
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.clip();
  if (finished && modernCountries) {
    ctx.beginPath();
    path(modernCountries);
    ctx.fillStyle = "#9eb495";
    ctx.fill();
    ctx.beginPath();
    path(modernCountries);
    ctx.strokeStyle = "#648474";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    const target = modernCountries.features.find(
      (f) => f.properties.name === country.name,
    );
    if (target) {
      ctx.beginPath();
      path(target);
      ctx.fillStyle = "#edc675";
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
  } else {
    // One land fill avoids outlining internal source-piece seams.
    ctx.beginPath();
    const rotations = {};
    for (const f of data.features) {
      if (age > f.begin || age < f.end) continue;
      const q = (rotations[f.pid] ??= rotationAt(data, f.pid, age));
      path({
        type: "Polygon",
        coordinates: f.vectors.map((r) => r.map((v) => lonlat(rotate(v, q)))),
      });
    }
    ctx.fillStyle = "#9eb495";
    ctx.fill();
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
    if (e.key === "0") setView(d3.zoomIdentity);
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
      result.territoryAttachment ?? attachPin(data, g, ages[i], d3.geoContains),
  };
}
$("confirm").onclick = () => {
  if (busy || !guess || finished) return;
  const h = record(guess, round);
  history.push(h);
  const f = feedback(h, history.at(-2));
  $("feedback").hidden = false;
  $("verdict").textContent = f.title;
  $("guess-distance").textContent = h.inside
    ? `In ${country.name}`
    : (h.distance === 0
        ? "Less than 1 km"
        : h.distance.toLocaleString() + " km") + " from border";
  $("earned").textContent = f.earned;
  $("feedback-detail").textContent = f.detail;
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
  busy = true;
  ui();
  const token = run,
    from = age,
    to = h.inside ? 0 : ages[round + 1],
    startTime = performance.now(),
    duration =
      ((from - to) / 75) *
      (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1500 : 4500);
  let previous = 0;
  function frame(now) {
    if (token !== run) return;
    const t = Math.min(1, (now - startTime) / duration);
    age = from + (to - from) * t;
    if (now - previous > 30 || t === 1) {
      draw();
      $("age").textContent = Math.round(age);
      previous = now;
    }
    if (t < 1) requestAnimationFrame(frame);
    else {
      guess = null;
      busy = false;
      if (h.inside) {
        finished = true;
        round = 4;
        reveal();
      } else {
        round++;
        ui();
        draw();
      }
    }
  }
  requestAnimationFrame(frame);
};
function countryAt(point) {
  return (
    modernCountries?.features.find((f) => d3.geoContains(f, point))?.properties
      .name ?? "Ocean"
  );
}
function reveal() {
  const r = $("results");
  document.body.classList.add("finished");
  $("feedback").hidden = true;
  age = 0;
  ui();
  draw();
  const outcome = challengeOutcome(history),
    total = outcome.total;
  r.hidden = false;
  r.innerHTML = `<div class="results-heading"><div><small>DAILY RESULTS</small><h2>${country.name}</h2></div><button id="collapse-results" aria-label="Collapse results" aria-expanded="true">−</button></div><div class="results-content"><div class="final-score">${total.toLocaleString()} <small>/ 15,000</small></div><p class="map-legend">${outcome.solvedRound ? `Found in ${outcome.solvedRound} ${outcome.solvedRound === 1 ? "pick" : "picks"}. ${5 - history.length ? "Remaining rounds awarded full points." : ""}` : "Five picks complete."}<br>Gold: ${country.name} · Numbers: your picks</p><table><thead><tr><th>Pick</th><th>Distance</th><th>Points</th></tr></thead><tbody>${outcome.rounds.map((h, i) => `<tr><td>${h.automatic ? "Awarded" : `<b>${i + 1}</b>`} · ${h.age === 0 ? "Today" : h.age + " Ma"}<small>${h.automatic ? "No pick needed" : countryAt(pinPosition(data, h, 0).point)}</small></td><td>${h.automatic ? "Full points" : h.inside ? "In country" : (h.distance === 0 ? "&lt;1" : h.distance.toLocaleString()) + " km"}</td><td>${h.score.toLocaleString()}</td></tr>`).join("")}</tbody></table><p class="results-note">Country names show where your pins end up today. In-country picks earn full points. Miss distances are to the nearest country edge at the time of your pick.</p><div class="results-actions"><button id="share">Copy result</button><button id="play-again">Play again</button></div><span id="copy-status" role="status"></span></div>`;
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
    start(false);
  };
  $("share").onclick = async () => {
    const msg = `Driftle ${$("date").value}\n${outcome.total.toLocaleString()} / 15,000\n${outcome.rounds.map((h) => (h.automatic ? "⭐" : h.inside ? "🟩" : "🟨")).join("")}\ndriftle.games`;
    try {
      await navigator.clipboard.writeText(msg);
      $("copy-status").textContent = " Copied!";
    } catch {
      $("copy-status").textContent = msg;
    }
  };
}
$("date").onchange = () => {
  if (/^\d{4}-\d{2}-\d{2}$/.test($("date").value)) start();
};
$("restart").onclick = () => start(false);
try {
  [data, countries, modernCountries, territories] = await Promise.all(
    [
      "data/motion.json",
      "data/countries.json",
      "data/modern-countries.json",
      "data/country-territories.json",
    ].map(async (url) => {
      const response = await fetch(url);
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
  data.territories = territories;
  for (const c of territories.countries)
    for (const p of c.parts) {
      if (d3.geoArea({ type: "Polygon", coordinates: p.rings }) > 2 * Math.PI)
        p.rings = p.rings.map((r) => r.toReversed());
    }
  // Pins on newly partitioned pieces use the very same model rotations.
  for (const [pid, samples] of Object.entries(territories.rotations))
    if (!data.rotations[pid]) data.rotations[pid] = samples;
  if (!countries.some(valid)) throw Error("No supported challenges");
  for (const f of data.features) {
    f.rings = renderRings(f.rings);
    if (d3.geoArea({ type: "Polygon", coordinates: f.rings }) > 2 * Math.PI)
      f.rings = f.rings.map((r) => [...r].reverse());
    f.vectors = f.rings.map((r) => r.map(vector));
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  start();
} catch (error) {
  $("status").textContent =
    "Could not load the reconstruction. Reload to retry. " + error.message;
  $("mapstatus").textContent = "DATA UNAVAILABLE";
}
