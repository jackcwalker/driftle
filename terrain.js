import { vector, rotate, lonlat, renderRings } from "./geo.js";
import { rotationAt } from "./vendor/motion.js";
import { wheelIntent, zoomAround, panBy } from "./navigation.js";
const d3 = window.d3,
  $ = (id) => document.getElementById(id),
  canvas = $("map"),
  ctx = canvas.getContext("2d");
let data,
  terrain,
  projection,
  age = 300,
  frame = 0,
  playing = false,
  transform = d3.zoomIdentity,
  base,
  width,
  height;
const rotationCache = new Map();
const colors = [
  "#a8b696",
  "#aab18a",
  "#b4ad85",
  "#aa9976",
  "#91846e",
  "#d3c8aa",
];
function prepare(f) {
  let r = renderRings(f.rings);
  if (d3.geoArea({ type: "Polygon", coordinates: r }) > 2 * Math.PI)
    r = r.map((r) => r.toReversed());
  f.area = d3.geoArea({ type: "Polygon", coordinates: r });
  f.vectors = r.map((r) => r.map(vector));
}
function geometry(f) {
  let q = rotationCache.get(f.pid);
  if (!q) {
    q = rotationAt(data, f.pid, age);
    rotationCache.set(f.pid, q);
  }
  return (
    q && {
      type: "Polygon",
      coordinates: f.vectors.map((r) => r.map((v) => lonlat(rotate(v, q)))),
    }
  );
}
function available(f) {
  return (
    f.begin >= age &&
    f.end <= age &&
    f.area * (base.scale * transform.k) ** 2 >= 0.7
  );
}
function draw() {
  if (!data || !projection) return;
  rotationCache.clear();
  ctx.clearRect(0, 0, width, height);
  projection
    .scale(base.scale * transform.k)
    .translate([
      base.translate[0] * transform.k + transform.x,
      base.translate[1] * transform.k + transform.y,
    ]);
  const path = d3.geoPath(projection, ctx);
  ctx.save();
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = "#21484d";
  ctx.fill();
  ctx.clip();
  ctx.beginPath();
  for (const f of terrain.coastlines)
    if (available(f)) {
      const g = geometry(f);
      if (g) path(g);
    }
  ctx.fillStyle = $("terrain").checked ? "#a8b696" : "#9eb495";
  ctx.fill();
  ctx.save();
  ctx.clip(); // Keep simplified terrain inside the exact rendered land mask.
  if ($("terrain").checked) {
    for (const group of terrain.snapshots[age === 0 ? "0" : "300"].groups) {
      ctx.beginPath();
      for (const f of group) {
        if (!available(f)) continue;
        const g = geometry(f);
        if (g) path(g);
      }
      const f = group[0];
      ctx.fillStyle =
        f.kind === "elevation"
          ? colors[f.band]
          : f.band === 0
            ? "rgba(29,40,34,.12)"
            : "rgba(255,245,204,.10)";
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
  $("age").textContent = age === 0 ? "Today" : `${Math.round(age)} Ma`;
  $("snapshot").textContent =
    age === 0
      ? "Published 0 Ma terrain · comparison"
      : "300 Ma terrain snapshot · carried with plates";
}
const zoom = d3
  .zoom()
  .scaleExtent([1, 8])
  .filter((e) => e.type !== "wheel" && !e.button)
  .on("zoom", (e) => {
    transform = e.transform;
    draw();
  });
d3.select(canvas).call(zoom).on("dblclick.zoom", null);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const b = canvas.getBoundingClientRect(),
      p = [e.clientX - b.left, e.clientY - b.top],
      intent = wheelIntent(e);
    const t =
      intent.kind === "zoom"
        ? zoomAround(transform, p, intent.factor)
        : panBy(transform, intent.dx, intent.dy);
    d3.select(canvas).call(
      zoom.transform,
      d3.zoomIdentity.translate(t.x, t.y).scale(t.k),
    );
  },
  { passive: false },
);
function resize() {
  width = innerWidth;
  height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  projection = d3
    .geoEqualEarth()
    .rotate([0, 0.01])
    .fitExtent(
      [
        [12, 100],
        [width - 12, height - (width < 650 ? 185 : 115)],
      ],
      { type: "Sphere" },
    );
  base = { scale: projection.scale(), translate: projection.translate() };
  d3.select(canvas).call(zoom.transform, d3.zoomIdentity);
}
function stop() {
  playing = false;
  cancelAnimationFrame(frame);
  $("play").textContent = "Play 300 → 225 Ma";
}
$("play").onclick = () => {
  if (playing) {
    stop();
    return;
  }
  age = 300;
  playing = true;
  $("play").textContent = "Pause";
  const start = performance.now();
  let frames = 0,
    renderTime = 0;
  function tick(now) {
    age = 300 - 75 * Math.min(1, (now - start) / 9000);
    $("time").value = age;
    const before = performance.now();
    draw();
    renderTime += performance.now() - before;
    frames++;
    canvas.dataset.frames = String(frames);
    canvas.dataset.averageRenderMs = (renderTime / frames).toFixed(1);
    if (age > 225) frame = requestAnimationFrame(tick);
    else stop();
  }
  frame = requestAnimationFrame(tick);
};
$("time").oninput = () => {
  stop();
  age = +$("time").value;
  draw();
};
$("today").onclick = () => {
  stop();
  age = 0;
  draw();
};
$("ancient").onclick = () => {
  stop();
  age = 300;
  $("time").value = 300;
  draw();
};
$("terrain").onchange = draw;
$("zoom-in").onclick = () => d3.select(canvas).call(zoom.scaleBy, 1.5);
$("zoom-out").onclick = () => d3.select(canvas).call(zoom.scaleBy, 1 / 1.5);
$("reset").onclick = () =>
  d3.select(canvas).call(zoom.transform, d3.zoomIdentity);
window.addEventListener("resize", resize);
try {
  [data, terrain] = await Promise.all(
    ["data/motion.json", "data/terrain-study.json"].map(async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw Error(u);
      return r.json();
    }),
  );
  terrain.coastlines.forEach(prepare);
  Object.values(terrain.snapshots).forEach((s) => {
    s.features.forEach(prepare);
    s.groups = [...Map.groupBy(s.features, (f) => f.kind + f.band).values()];
  });
  resize();
  $("status").textContent =
    "Scotese & Wright (2018) · CC BY 4.0 · Müller et al. (2022) plate motion · Experimental cross-model transfer";
} catch (e) {
  $("status").textContent = "Terrain could not load: " + e.message;
}
