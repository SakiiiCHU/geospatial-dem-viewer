import { detectGrdType, computeGridInfo } from "./grdAnalyzer";

function computeBounds(rawPositions) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < rawPositions.length; i += 3) {
    const x = rawPositions[i];
    const y = rawPositions[i + 1];
    const z = rawPositions[i + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
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

function resolveCenter(bounds, sharedCenter = null) {
  if (sharedCenter) {
    return {
      x: sharedCenter.x,
      y: sharedCenter.y,
      z: sharedCenter.z ?? 0,
    };
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
}

function centerAndScalePositions(rawPositions, options = {}) {
  const { worldScale = 1, zScale = 1, sharedCenter = null } = options;

  const bounds = computeBounds(rawPositions);
  const center = resolveCenter(bounds, sharedCenter);

  const positions = new Float32Array(rawPositions.length);

  for (let i = 0; i < rawPositions.length; i += 3) {
    positions[i] = (rawPositions[i] - center.x) * worldScale;
    positions[i + 1] = (rawPositions[i + 1] - center.y) * worldScale;
    positions[i + 2] = (rawPositions[i + 2] - center.z) * worldScale * zScale;
  }

  return {
    positions,
    bounds,
    center,
  };
}

/**
 * 解析 ASCII XYZ 格式的 .grd
 * 每行預期格式：
 * x y z
 *
 * 例如：
 * 281060 2762820 109.22
 */
export async function loadAsciiGrd(file, options = {}) {
  if (!file) {
    throw new Error("No GRD file provided.");
  }

  const {
    worldScale = 1,
    zScale = 1,
    sharedCenter = null,
    noDataValues = [-9999, -99999, -32767, -32768],
  } = options;

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const rawPositions = [];
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

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      skippedLines += 1;
      continue;
    }

    if (noDataValues.includes(z)) {
      continue;
    }

    rawPositions.push(x, y, z);
  }

  if (rawPositions.length === 0) {
    throw new Error("GRD file parsed, but no valid XYZ points were found.");
  }

  const grdType = detectGrdType(rawPositions);
  const gridInfo = computeGridInfo(rawPositions);

  const { positions, bounds, center } = centerAndScalePositions(rawPositions, {
    worldScale,
    zScale,
    sharedCenter,
  });

  const metadata = {
    fileName: file.name,
    pointCount: positions.length / 3,
    skippedLines,
    bounds,
    center,
    sourceType: "ASCII_GRD_XYZ",
    grdType,
    gridInfo,
  };

  return {
    positions,
    metadata,
    bounds,
    center,
    grdType,
    gridInfo,
  };
}

export async function inspectAsciiGrdBounds(file, options = {}) {
  if (!file) {
    throw new Error("No GRD file provided.");
  }

  const { noDataValues = [-9999, -99999, -32767, -32768] } = options;

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const rawPositions = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }

    if (noDataValues.includes(z)) {
      continue;
    }

    rawPositions.push(x, y, z);
  }

  if (rawPositions.length === 0) {
    throw new Error("GRD file parsed, but no valid XYZ points were found.");
  }

  const grdType = detectGrdType(rawPositions);
  const gridInfo = computeGridInfo(rawPositions);

  const bounds = computeBounds(rawPositions);

  return {
    bounds,
    center: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    },
    pointCount: rawPositions.length / 3,
    grdType,
    gridInfo,
  };
}
