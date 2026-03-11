const DEFAULT_NODATA = -9999;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function sortNumericAsc(a, b) {
  return a - b;
}

function sortNumericDesc(a, b) {
  return b - a;
}

function computeBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  return {
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
  };
}

function inferCellSize(sortedValues) {
  if (!sortedValues || sortedValues.length < 2) return null;

  let minStep = Infinity;

  for (let i = 1; i < sortedValues.length; i += 1) {
    const step = Math.abs(sortedValues[i] - sortedValues[i - 1]);
    if (step > 0 && step < minStep) {
      minStep = step;
    }
  }

  return Number.isFinite(minStep) ? minStep : null;
}

function roundKey(value, decimals = 6) {
  return Number(value).toFixed(decimals);
}

export function parseAsciiGrdText(text, options = {}) {
  const {
    noDataValues = [DEFAULT_NODATA, -99999, -32767, -32768],
  } = options;

  const lines = text.split(/\r?\n/);
  const points = [];
  let skippedLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      skippedLines += 1;
      continue;
    }

    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);

    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
      skippedLines += 1;
      continue;
    }

    if (noDataValues.includes(z)) {
      continue;
    }

    points.push({ x, y, z });
  }

  if (points.length === 0) {
    throw new Error("No valid XYZ records found in GRD text.");
  }

  return {
    points,
    skippedLines,
  };
}

export function buildRasterFromPoints(points, options = {}) {
  const {
    noDataValue = DEFAULT_NODATA,
    yOrder = "desc", // "desc" = top to bottom, 比較符合 raster row 習慣
    keyDecimals = 6,
  } = options;

  if (!Array.isArray(points) || points.length === 0) {
    throw new Error("No points provided.");
  }

  const xSet = new Set();
  const ySet = new Set();

  for (const p of points) {
    xSet.add(roundKey(p.x, keyDecimals));
    ySet.add(roundKey(p.y, keyDecimals));
  }

  const xs = Array.from(xSet, Number).sort(sortNumericAsc);
  const ys =
    yOrder === "asc"
      ? Array.from(ySet, Number).sort(sortNumericAsc)
      : Array.from(ySet, Number).sort(sortNumericDesc);

  const width = xs.length;
  const height = ys.length;

  if (width < 1 || height < 1) {
    throw new Error("Invalid raster dimensions derived from GRD.");
  }

  const xIndexMap = new Map(xs.map((x, i) => [roundKey(x, keyDecimals), i]));
  const yIndexMap = new Map(ys.map((y, i) => [roundKey(y, keyDecimals), i]));

  const raster = new Float32Array(width * height);
  raster.fill(noDataValue);

  let writtenCount = 0;

  for (const p of points) {
    const col = xIndexMap.get(roundKey(p.x, keyDecimals));
    const row = yIndexMap.get(roundKey(p.y, keyDecimals));

    if (col == null || row == null) continue;

    raster[row * width + col] = p.z;
    writtenCount += 1;
  }

  const bounds = computeBounds(points);
  const cellSizeX = inferCellSize(xs);
  const cellSizeY = inferCellSize(
    [...ys].sort(sortNumericAsc) // cellsize 用升序計算較直覺
  );

  return {
    raster,
    width,
    height,
    xCoords: xs,
    yCoords: ys,
    bounds,
    cellSizeX,
    cellSizeY,
    origin: {
      x: xs[0],
      y: yOrder === "asc" ? ys[0] : ys[0], // desc 時這會是 top-left 的 y
    },
    noDataValue,
    writtenCount,
    pointCount: points.length,
    yOrder,
  };
}

export function rasterInfoFromPoints(points, options = {}) {
  const result = buildRasterFromPoints(points, options);

  return {
    width: result.width,
    height: result.height,
    bounds: result.bounds,
    cellSizeX: result.cellSizeX,
    cellSizeY: result.cellSizeY,
    noDataValue: result.noDataValue,
    origin: result.origin,
    pointCount: result.pointCount,
    writtenCount: result.writtenCount,
    yOrder: result.yOrder,
  };
}

export async function grdFileToRaster(file, options = {}) {
  if (!file) {
    throw new Error("No GRD file provided.");
  }

  const text = await file.text();
  const { points, skippedLines } = parseAsciiGrdText(text, options);
  const rasterResult = buildRasterFromPoints(points, options);

  return {
    ...rasterResult,
    skippedLines,
    fileName: file.name,
  };
}

export async function grdTextToRaster(text, options = {}) {
  const { points, skippedLines } = parseAsciiGrdText(text, options);
  const rasterResult = buildRasterFromPoints(points, options);

  return {
    ...rasterResult,
    skippedLines,
  };
}

/**
 * 多張 GRD tile 合併成單一 raster
 *
 * 前提：
 * - 所有 tile 的 cell size 一致
 * - 座標系一致
 * - 規則 grid
 */
export async function mergeGrdFilesToRaster(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("No GRD files provided for merge.");
  }

  const {
    noDataValue = DEFAULT_NODATA,
    keyDecimals = 6,
    yOrder = "desc",
  } = options;

  const allPoints = [];
  let totalSkippedLines = 0;

  for (const file of files) {
    const text = await file.text();
    const { points, skippedLines } = parseAsciiGrdText(text, options);
    allPoints.push(...points);
    totalSkippedLines += skippedLines;
  }

  const merged = buildRasterFromPoints(allPoints, {
    noDataValue,
    keyDecimals,
    yOrder,
  });

  return {
    ...merged,
    skippedLines: totalSkippedLines,
    mergedFileCount: files.length,
  };
}