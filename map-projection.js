// Equal Earth, same coefficients and radians contract as D3 7.9.
const A1 = 1.340264,
  A2 = -0.081106,
  A3 = 0.000893,
  A4 = 0.003796,
  M = Math.sqrt(3) / 2;
export const EQUAL_EARTH_COEFFICIENTS = { A1, A2, A3, A4, M };
export function equalEarthRaw(lambda, phi) {
  const t = Math.asin(M * Math.sin(phi)),
    t2 = t * t,
    t6 = t2 * t2 * t2;
  return [
    (lambda * Math.cos(t)) /
      (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))),
    t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)),
  ];
}
export function equalEarthInverse(x, y) {
  let t = y;
  for (let i = 0; i < 12; i++) {
    const t2 = t * t,
      t6 = t2 * t2 * t2,
      delta =
        (t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y) /
        (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2));
    t -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  const t2 = t * t,
    t6 = t2 * t2 * t2;
  return [
    (x * M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))) / Math.cos(t),
    Math.asin(Math.max(-1, Math.min(1, Math.sin(t) / M))),
  ];
}
export const EQUAL_EARTH_BOUNDS = [
  equalEarthRaw(-Math.PI, 0)[0],
  equalEarthRaw(0, -Math.PI / 2)[1],
  equalEarthRaw(Math.PI, 0)[0],
  equalEarthRaw(0, Math.PI / 2)[1],
];
