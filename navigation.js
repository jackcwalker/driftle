// Pure navigation math: used by wheel gestures and resize preservation.
export function zoomAround(view, anchor, factor, min = 1, max = 8) {
  const k = Math.max(min, Math.min(max, view.k * factor)),
    ratio = k / view.k;
  return {
    k,
    x: anchor[0] - (anchor[0] - view.x) * ratio,
    y: anchor[1] - (anchor[1] - view.y) * ratio,
  };
}
export function panBy(view, dx, dy) {
  return { ...view, x: view.x - dx, y: view.y - dy };
}
export function wheelIntent(event) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1;
  if (event.ctrlKey || event.metaKey)
    return { kind: "zoom", factor: Math.exp(-event.deltaY * unit * 0.01) };
  return { kind: "pan", dx: event.deltaX * unit, dy: event.deltaY * unit };
}
