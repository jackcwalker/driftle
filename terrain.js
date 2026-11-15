import { RasterMap } from "./map-renderer.js?v=raster4";
import { wheelIntent, zoomAround, panBy } from "./navigation.js";
const $ = (id) => document.getElementById(id),
  d3 = window.d3,
  canvas = $("map"),
  waterCanvas = $("water"),
  waterCtx = waterCanvas.getContext("2d");
let renderer,
  manifest,
  water,
  references,
  age = 0,
  width,
  height,
  projection,
  base,
  view = d3.zoomIdentity,
  focused = false,
  pending = 0,
  drawQueued = false;
const zoom = d3
  .zoom()
  .scaleExtent([1, 36])
  .filter((e) => e.type !== "wheel" && !e.button)
  .on("zoom", (e) => {
    view = e.transform;
    redraw();
  });
d3.select(canvas).call(zoom).on("dblclick.zoom", null);
function currentProjection() {
  return projection
    .scale(base.scale * view.k)
    .translate([
      base.translate[0] * view.k + view.x,
      base.translate[1] * view.k + view.y,
    ]);
}
function redraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    draw();
  });
}
function draw() {
  if (!renderer || !projection || renderer.gl.isContextLost()) return;
  const start = performance.now();
  const p = currentProjection();
  renderer.draw({ scale: p.scale(), translate: p.translate(), k: view.k });
  waterCtx.clearRect(0, 0, width, height);
  if (age === 0 && water) {
    const path = d3.geoPath(p, waterCtx),
      rank = Math.min(9, 1.8 + Math.log2(view.k) * 1.65);
    for (const f of water.features) {
      if (f.properties.rank > rank) continue;
      const b = f.projectedBounds,
        scale = p.scale(),
        translate = p.translate();
      const bounds = [
        [b[0][0] * scale + translate[0], b[0][1] * scale + translate[1]],
        [b[1][0] * scale + translate[0], b[1][1] * scale + translate[1]],
      ];
      if (
        bounds[1][0] < 0 ||
        bounds[0][0] > width ||
        bounds[1][1] < 0 ||
        bounds[0][1] > height
      )
        continue;
      waterCtx.beginPath();
      path(f);
      waterCtx.fillStyle = "#648e9c";
      waterCtx.fill();
    }
  }
  $("zoom-level").textContent = Math.round(view.k * 100) + "%";
  canvas.dataset.drawMs = (performance.now() - start).toFixed(2);
  canvas.dataset.textureMiB = (renderer.residentBytes / 1048576).toFixed(1);
}
function setView(t) {
  d3.select(canvas).call(
    zoom.transform,
    d3.zoomIdentity.translate(t.x, t.y).scale(t.k),
  );
}
function focusEurope() {
  focused = true;
  const points = references[String(age)],
    raw = d3.geoEqualEarth().scale(1).translate([0, 0]);
  const ps = points.map(raw),
    xs = ps.map((p) => p[0]),
    ys = ps.map((p) => p[1]);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const targetScale =
    Math.min((width - 40) / (right - left), (height - 220) / (bottom - top)) *
    0.85;
  const k = Math.max(1, Math.min(36, targetScale / base.scale));
  setView({
    k,
    x: width / 2 - k * (base.translate[0] + (base.scale * (left + right)) / 2),
    y:
      (height + 20) / 2 -
      k * (base.translate[1] + (base.scale * (top + bottom)) / 2),
  });
}
function reset() {
  focused = false;
  setView({ k: 1, x: 0, y: 0 });
}
function resize() {
  const center =
    projection && currentProjection().invert([width / 2, height / 2]);
  width = innerWidth;
  height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, width < 650 ? 1.5 : 2);
  renderer.resize(width, height, ratio);
  waterCanvas.width = Math.round(width * ratio);
  waterCanvas.height = Math.round(height * ratio);
  waterCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  projection = d3.geoEqualEarth().fitExtent(
    [
      [12, 65],
      [width - 12, height - (width < 700 ? 125 : 105)],
    ],
    { type: "Sphere" },
  );
  base = { scale: projection.scale(), translate: projection.translate() };
  zoom.extent([
    [0, 0],
    [width, height],
  ]);
  if (focused) focusEurope();
  else if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
    const point = projection(center);
    setView({
      k: view.k,
      x: width / 2 - point[0] * view.k,
      y: height / 2 - point[1] * view.k,
    });
  } else redraw();
}
async function selectAge(next) {
  const token = ++pending;
  document.body.classList.add("loading");
  $("status").textContent = "Loading map…";
  try {
    if (!(await renderer.snapshot(manifest, next)) || token !== pending) return;
    age = next;
    $("age").textContent = age ? `${age} Ma` : "Today";
    $("source").textContent = age
      ? "PALEOMAP 2024 · reconstructed elevation"
      : "ETOPO 2022 · modern physical relief";
    document.querySelectorAll("[data-age]").forEach((b) => {
      b.classList.toggle("active", +b.dataset.age === age);
      b.setAttribute("aria-pressed", String(+b.dataset.age === age));
    });
    $("status").textContent = age
      ? "Scotese et al. · CC BY 4.0"
      : "NOAA NCEI · Made with Natural Earth";
    if (focused) focusEurope();
    else redraw();
  } catch (e) {
    $("status").textContent = "Map unavailable: " + e.message;
  } finally {
    if (token === pending) document.body.classList.remove("loading");
  }
}
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const intent = wheelIntent(e),
      box = canvas.getBoundingClientRect(),
      anchor = [e.clientX - box.left, e.clientY - box.top];
    const next =
      intent.kind === "zoom"
        ? zoomAround(view, anchor, intent.factor, 1, 36)
        : panBy(view, intent.dx, intent.dy);
    setView(next);
  },
  { passive: false },
);
$("europe").onclick = focusEurope;
$("world").onclick = reset;
$("reset").onclick = reset;
$("zoom-in").onclick = () => d3.select(canvas).call(zoom.scaleBy, 1.5);
$("zoom-out").onclick = () => d3.select(canvas).call(zoom.scaleBy, 1 / 1.5);
document
  .querySelectorAll("[data-age]")
  .forEach((b) => (b.onclick = () => selectAge(+b.dataset.age)));
canvas.onkeydown = (e) => {
  if (e.key === "+" || e.key === "=") $("zoom-in").click();
  else if (e.key === "-") $("zoom-out").click();
  else if (e.key === "0") reset();
  else return;
  e.preventDefault();
};
try {
  renderer = new RasterMap(canvas);
  [manifest, references] = await Promise.all(
    [
      "data/maps/raster-v2/manifest.json",
      "data/maps/raster-v2/europe-reference.json",
    ].map(async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw Error(u);
      return r.json();
    }),
  );
  resize();
  window.addEventListener("resize", resize);
  await selectAge(0);
  water = await (await fetch(manifest.water.url)).json();
  for (const f of water.features) {
    if (f.geometry.type === "Polygon") {
      if (d3.geoArea(f) > 2 * Math.PI)
        f.geometry.coordinates = f.geometry.coordinates.map((r) =>
          r.toReversed(),
        );
    } else if (f.geometry.type === "MultiPolygon") {
      f.geometry.coordinates = f.geometry.coordinates.map((r) =>
        d3.geoArea({ type: "Polygon", coordinates: r }) > 2 * Math.PI
          ? r.map((r) => r.toReversed())
          : r,
      );
    }
  }
  const rawPath = d3.geoPath(d3.geoEqualEarth().scale(1).translate([0, 0]));
  for (const f of water.features) f.projectedBounds = rawPath.bounds(f);
  redraw();
  const params = new URLSearchParams(location.search);
  if (params.get("view") === "europe") focusEurope();
  if (params.has("age") && manifest.ages.includes(+params.get("age")))
    await selectAge(+params.get("age"));
  if (params.has("benchmark")) await benchmark();
} catch (e) {
  $("status").textContent = "Map could not load: " + e.message;
}

async function benchmark() {
  const original = view,
    deltas = [],
    draws = [];
  let previous;
  for (let i = 0; i < 180; i++) {
    const now = await new Promise(requestAnimationFrame);
    if (previous !== undefined) deltas.push(now - previous);
    previous = now;
    setView({
      k: original.k,
      x: original.x + Math.sin(i / 30) * 60,
      y: original.y,
    });
    draws.push(+$("map").dataset.drawMs || 0);
  }
  setView(original);
  const percentile = (a, p) =>
    a.toSorted((a, b) => a - b)[Math.floor((a.length - 1) * p)];
  const metrics = {
    viewport: [width, height],
    devicePixelRatio,
    frames: deltas.length,
    meanFrameMs: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    p95FrameMs: percentile(deltas, 0.95),
    p95CpuDrawMs: percentile(draws, 0.95),
    textureMiB: renderer.residentBytes / 1048576,
  };
  canvas.dataset.benchmark = JSON.stringify(metrics);
  $("status").textContent =
    `Map pan benchmark · ${(1000 / metrics.meanFrameMs).toFixed(0)} fps · ${metrics.textureMiB.toFixed(0)} MiB textures`;
}
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  pending++;
  $("status").textContent = "Restoring map…";
});
canvas.addEventListener("webglcontextrestored", async () => {
  renderer = new RasterMap(canvas);
  resize();
  await selectAge(age);
});
