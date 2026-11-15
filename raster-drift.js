import { ages, vector, lonlat, rotate } from "./geo.js?v=terrain-game6";
import { equalEarthRaw } from "./map-projection.js";

export function eraPair(age) {
  if (age < 0 || age > 300) throw Error("Unsupported geological age");
  const i = Math.min(3, Math.floor((300 - age) / 75));
  return [ages[i], ages[i + 1]];
}

export function atlasUV(point) {
  return [((point[0] + 180) / 360 + 1) % 1, (90 - point[1]) / 180];
}

// A native atlas location at an endpoint is the same material point used by
// country scoring and pins. Never interpolate endpoint longitude/latitude.
export function endpointPoint(point, currentRotation, endpointRotation) {
  const inverse = [
    currentRotation[0],
    ...currentRotation.slice(1).map((x) => -x),
  ];
  return lonlat(rotate(rotate(vector(point), inverse), endpointRotation));
}

export function plateSamples(features, stepDegrees = 2) {
  const groups = new Map();
  for (const f of features) {
    if (!groups.has(f.pid)) groups.set(f.pid, []);
    const samples = groups.get(f.pid);
    for (const ring of f.rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = vector(ring[i]),
          b = vector(ring[(i + 1) % ring.length]);
        const angle = Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              a.reduce((s, v, j) => s + v * b[j], 0),
            ),
          ),
        );
        const n = Math.max(1, Math.ceil((angle * 180) / Math.PI / stepDegrees));
        for (let j = 0; j < n; j++) {
          const t = j / n;
          const v =
            angle < 1e-10
              ? a
              : a.map(
                  (v, k) =>
                    (v * Math.sin((1 - t) * angle) +
                      b[k] * Math.sin(t * angle)) /
                    Math.sin(angle),
                );
          samples.push(v);
        }
      }
    }
  }
  return groups;
}

// Conservative screen bounds only reduce overdraw. The fragment shader handles
// spherical rotation and the date line, so no triangle can bridge the map seam.
export function plateScissor(samples, q, { scale, translate }, width, height) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  let lon0 = Infinity,
    lon1 = -Infinity,
    polar = false;
  for (const v of samples) {
    const p = rotate(v, q),
      lon = Math.atan2(p[1], p[0]);
    const lat = Math.asin(Math.max(-1, Math.min(1, p[2])));
    const raw = equalEarthRaw(lon, lat);
    const x = raw[0] * scale + translate[0],
      y = -raw[1] * scale + translate[1];
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    lon0 = Math.min(lon0, lon);
    lon1 = Math.max(lon1, lon);
    polar ||= Math.abs(lat) > (85 * Math.PI) / 180;
  }
  if (!Number.isFinite(x0)) return null;
  if (lon1 - lon0 > Math.PI || polar) {
    x0 = 0;
    x1 = width;
    y0 = 0;
    y1 = height;
  }
  const pad = scale * 0.065 + 3;
  x0 = Math.max(0, Math.floor(x0 - pad));
  x1 = Math.min(width, Math.ceil(x1 + pad));
  y0 = Math.max(0, Math.floor(y0 - pad));
  y1 = Math.min(height, Math.ceil(y1 + pad));
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
}
