import { rotationAt } from "./vendor/motion.js";
export const ages = [300, 225, 150, 75, 0];
export function vector([lon, lat]) {
  lon *= Math.PI / 180;
  lat *= Math.PI / 180;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
}
export function rotate(v, q) {
  const [w, x, y, z] = q;
  const [a, b, c] = v;
  const tx = 2 * (y * c - z * b),
    ty = 2 * (z * a - x * c),
    tz = 2 * (x * b - y * a);
  return [
    a + w * tx + y * tz - z * ty,
    b + w * ty + z * tx - x * tz,
    c + w * tz + x * ty - y * tx,
  ];
}
export function lonlat(v) {
  return [
    (Math.atan2(v[1], v[0]) * 180) / Math.PI,
    (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI,
  ];
}
// Rendering-only pole cap: split the undefined pole longitude into its incoming
// and outgoing meridians, 0.0001 degree (11m) from the pole. Source stays intact.
export function renderRings(rings) {
  return rings.map((r) => {
    let out = r.flatMap((p, i) =>
      Math.abs(p[1]) === 90
        ? [
            [r[(i + r.length - 1) % r.length][0], Math.sign(p[1]) * 89.9999],
            [r[(i + 1) % r.length][0], Math.sign(p[1]) * 89.9999],
          ]
        : [p],
    );
    if (out[0][0] !== out.at(-1)[0] || out[0][1] !== out.at(-1)[1])
      out.push([...out[0]]);
    return out.flatMap((a, i) => {
      if (i === out.length - 1) return [a];
      const b = out[i + 1],
        va = vector(a),
        vb = vector(b);
      const angle = Math.acos(
        Math.max(
          -1,
          Math.min(
            1,
            va.reduce((sum, v, j) => sum + v * vb[j], 0),
          ),
        ),
      );
      const n = Math.max(1, Math.ceil(angle / (Math.PI / 90)));
      return Array.from({ length: n }, (_, j) => {
        if (j === 0) return a;
        const t = j / n,
          sa = Math.sin((1 - t) * angle) / Math.sin(angle),
          sb = Math.sin(t * angle) / Math.sin(angle);
        return lonlat(va.map((v, k) => sa * v + sb * vb[k]));
      });
    });
  });
}

export function position(data, country, age) {
  if (age < 0 || age > 300 || !data.rotations[country.pid]) return null;
  const assignment = data.placeAssignments.find((a) => a.pid === country.pid);
  if (!assignment || age > assignment.valid_time[0]) return null;
  return lonlat(
    rotate(vector(country.point), rotationAt(data, country.pid, age)),
  );
}
export function distance(a, b) {
  const va = vector(a),
    vb = vector(b);
  return (
    6371 *
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          va.reduce((s, v, i) => s + v * vb[i], 0),
        ),
      ),
    )
  );
}
export function points(km, round) {
  return Math.round((5 - round) * 1000 * Math.exp(-km / 1800));
}
export function dailyIndex(date, count) {
  const day = Math.floor(Date.parse(date + "T00:00:00Z") / 86400000);
  if (!Number.isFinite(day)) throw Error("Invalid date");
  return ((day % count) + count) % count;
}

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const unit = (v) => {
  const length = Math.hypot(...v);
  return length > 1e-15 ? v.map((x) => x / length) : null;
};
const angle = (a, b) =>
  Math.atan2(Math.hypot(...cross(a, b)), Math.max(-1, Math.min(1, dot(a, b))));
export function nearestBoundary(point, rings) {
  const p = vector(point);
  let best = Infinity,
    nearest = null;
  for (const ring of rings)
    for (let i = 0; i < ring.length - 1; i++) {
      const a = vector(ring[i]),
        b = vector(ring[i + 1]);
      let candidate = a,
        arc = angle(p, a);
      const endpoint = angle(p, b);
      if (endpoint < arc) {
        arc = endpoint;
        candidate = b;
      }
      const normal = unit(cross(a, b));
      if (normal) {
        const foot = unit(p.map((v, j) => v - dot(p, normal) * normal[j]));
        if (foot && angle(a, foot) + angle(foot, b) <= angle(a, b) + 1e-9) {
          const d = angle(p, foot);
          if (d < arc) {
            arc = d;
            candidate = foot;
          }
        }
      }
      if (arc < best) {
        best = arc;
        nearest = candidate;
      }
    }
  return { km: best * 6371, point: nearest ? lonlat(nearest) : null };
}
export function rotationAvailable(data, pid, age) {
  const samples = data.rotations[pid];
  if (!samples) return false;
  const upper = data.times.findIndex((t) => t >= age);
  if (upper < 0) return false;
  if (data.times[upper] === age) return Boolean(samples[upper]);
  return upper > 0 && Boolean(samples[upper - 1]) && Boolean(samples[upper]);
}
export function supportedRotationAt(data, pid, age) {
  if (!rotationAvailable(data, pid, age))
    throw Error("Unsupported plate rotation at this age");
  const index = data.times.indexOf(age);
  return index >= 0 ? data.rotations[pid][index] : rotationAt(data, pid, age);
}
export function territoryAt(data, country, age) {
  const dataset = data.territories,
    territory = dataset?.countries.find((c) => c.name === country.name);
  if (!territory || age < 0 || age > 300) return [];
  return territory.parts.filter(
    (p) =>
      age <= p.begin && age >= p.end && rotationAvailable(dataset, p.pid, age),
  );
}
export function countryDistance(data, country, point, age, contains) {
  if (!contains) throw Error("Country containment engine is required");
  if (age === 0) {
    const geometry = country.geometry;
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    if (contains(geometry, point))
      return { km: 0, inside: true, point: [...point], attachment: null };
    let best = { km: Infinity, point: null };
    for (const rings of polygons) {
      const d = nearestBoundary(point, rings);
      if (d.km < best.km) best = d;
    }
    return { ...best, inside: best.km <= 0.01 };
  }
  let best = { km: Infinity, point: null, inside: false };
  for (const part of territoryAt(data, country, age)) {
    const raw = supportedRotationAt(data.territories, part.pid, age),
      q = raw.map((v) => v / Math.hypot(...raw));
    const local = lonlat(rotate(vector(point), [q[0], -q[1], -q[2], -q[3]]));
    const attachment = {
      pid: part.pid,
      point: local,
      begin: part.begin,
      end: part.end,
    };
    if (contains({ type: "Polygon", coordinates: part.rings }, local))
      return { km: 0, inside: true, point: [...point], attachment };
    const d = nearestBoundary(local, part.rings);
    if (d.km < best.km)
      best = {
        km: d.km,
        point: lonlat(rotate(vector(d.point), q)),
        inside: d.km <= 0.01,
        attachment: d.km <= 0.01 ? attachment : null,
      };
  }
  if (!Number.isFinite(best.km))
    throw Error("Country territory is unsupported at this age");
  if (best.inside) best.km = 0;
  return best;
}
export function recordGuess(data, country, g, i, contains) {
  const result = countryDistance(data, country, g, ages[i], contains);
  const km = result.inside ? 0 : result.km;
  return {
    age: ages[i],
    guess: [...g],
    distance: Math.round(km),
    exactDistance: km,
    inside: result.inside,
    countryName: country.name,
    score: points(km, i),
    bearing: result.inside ? null : bearing(g, result.point),
    territoryAttachment: result.attachment,
  };
}

// Undo the finite rotation at the clicking age before testing modern source
// continental pieces. Only an unambiguous plate is allowed to carry a pin.
export function attachPin(data, point, age, contains) {
  const candidates = [];
  const localByPid = {};
  for (const f of data.features) {
    if (age > f.begin || age < f.end || !rotationAvailable(data, f.pid, age))
      continue;
    let local = localByPid[f.pid];
    if (!local) {
      const q = rotationAt(data, f.pid, age);
      local = lonlat(rotate(vector(point), [q[0], -q[1], -q[2], -q[3]]));
      localByPid[f.pid] = local;
    }
    if (contains({ type: "Polygon", coordinates: f.rings }, local))
      candidates.push({ pid: f.pid, point: local, begin: f.begin, end: f.end });
  }
  const pids = new Set(candidates.map((c) => c.pid));
  if (pids.size !== 1) return null;
  return candidates.find((c) => c.begin >= 300 && c.end <= 0) ?? candidates[0];
}
export function pinPosition(data, record, age) {
  const a = record.attachment;
  if (
    !a ||
    age > a.begin ||
    age < a.end ||
    !rotationAvailable(data, a.pid, age)
  )
    return { point: record.guess, moving: false };
  return {
    point: lonlat(
      rotate(vector(a.point), supportedRotationAt(data, a.pid, age)),
    ),
    moving: true,
  };
}
// Historical owner textures need not be resident during reload. Re-score the
// guess and validate its saved material attachment against the same model;
// otherwise a restored land pin would silently become a fixed ocean pin.
export function restoreGuess(data, country, saved, i, contains) {
  const result = recordGuess(data, country, saved.guess, i, contains);
  let attachment = result.territoryAttachment ?? null;
  const old = saved.attachment;
  if (
    !attachment &&
    Array.isArray(old?.point) &&
    old.point.length === 2 &&
    old.point.every(Number.isFinite)
  ) {
    const candidate = attachPin(data, saved.guess, ages[i], contains);
    if (
      candidate &&
      candidate.pid === old.pid &&
      distance(candidate.point, old.point) < 0.1
    )
      attachment = candidate;
  }
  return { ...result, attachment };
}
export function bearing(from, to) {
  const rad = Math.PI / 180,
    dl = (to[0] - from[0]) * rad,
    a = from[1] * rad,
    b = to[1] * rad;
  const angle =
    (Math.atan2(
      Math.sin(dl) * Math.cos(b),
      Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(dl),
    ) /
      rad +
      360) %
    360;
  return [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ][Math.round(angle / 45) % 8];
}
