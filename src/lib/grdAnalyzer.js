export function detectGrdType(rawPositions) {
  if (!rawPositions || rawPositions.length < 30) {
    return "unknown";
  }

  const xs = [];
  const ys = [];

  for (let i = 0; i < rawPositions.length; i += 3) {
    xs.push(rawPositions[i]);
    ys.push(rawPositions[i + 1]);
  }

  const uniqueXs = Array.from(new Set(xs)).sort((a, b) => a - b);
  const uniqueYs = Array.from(new Set(ys)).sort((a, b) => a - b);

  if (uniqueXs.length < 2 || uniqueYs.length < 2) {
    return "unknown";
  }

  const dx = [];
  const dy = [];

  for (let i = 1; i < uniqueXs.length; i++) {
    const d = uniqueXs[i] - uniqueXs[i - 1];
    if (d > 0) dx.push(Number(d.toFixed(6)));
  }

  for (let i = 1; i < uniqueYs.length; i++) {
    const d = uniqueYs[i] - uniqueYs[i - 1];
    if (d > 0) dy.push(Number(d.toFixed(6)));
  }

  const uniqueDx = new Set(dx);
  const uniqueDy = new Set(dy);

  const expectedPointCount = uniqueXs.length * uniqueYs.length;
  const actualPointCount = rawPositions.length / 3;

  const looksRegularGrid =
    uniqueDx.size === 1 &&
    uniqueDy.size === 1 &&
    actualPointCount === expectedPointCount;

  if (looksRegularGrid) {
    return "grid";
  }

  return "scatter";
}

export function computeGridInfo(rawPositions) {
  if (!rawPositions || rawPositions.length < 3) {
    return null;
  }

  const xs = [];
  const ys = [];

  for (let i = 0; i < rawPositions.length; i += 3) {
    xs.push(rawPositions[i]);
    ys.push(rawPositions[i + 1]);
  }

  const uniqueXs = Array.from(new Set(xs)).sort((a, b) => a - b);
  const uniqueYs = Array.from(new Set(ys)).sort((a, b) => a - b);

  let cellSizeX = null;
  let cellSizeY = null;

  if (uniqueXs.length >= 2) {
    cellSizeX = uniqueXs[1] - uniqueXs[0];
  }

  if (uniqueYs.length >= 2) {
    cellSizeY = uniqueYs[1] - uniqueYs[0];
  }

  return {
    uniqueXCount: uniqueXs.length,
    uniqueYCount: uniqueYs.length,
    width: uniqueXs.length,
    height: uniqueYs.length,
    cellSizeX,
    cellSizeY,
  };
}