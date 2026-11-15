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

export function recordGuess(data, country, g, i) {
  const target = position(data, country, ages[i]);
  if (!target) throw Error("Unsupported point — challenge unavailable");
  const km = distance(g, target);
  return {
    age: ages[i],
    guess: [...g],
    distance: Math.round(km),
    score: points(km, i),
  };
}
