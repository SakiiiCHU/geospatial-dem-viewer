/**
 * HDR Metadata Parser
 * ------------------------------------------------------------
 * This module parses accompanying .hdr files for DEM / grid datasets.
 *
 * Supported HDR formats:
 *
 * 1. Key–Value style (common in ESRI ASCII Grid / GDAL outputs)
 *
 *    Example:
 *      ncols 130
 *      nrows 143
 *      xllcorner 281060
 *      yllcorner 2762820
 *      cellsize 20
 *      nodata_value -9999
 *
 *    Also supports variations:
 *      key=value
 *      key: value
 *
 * 2. Positional / Line-ordered header
 *
 *    Example:
 *      96221003
 *      TWD97
 *      TWWD2001
 *      5000
 *      m
 *      20
 *      20
 *      130
 *      143
 *      ...
 *
 *    In this format metadata fields are inferred by line index
 *    (projection, datum, cell size, grid size, bounds, etc.).
 *
 * Parsing Strategy:
 *
 *    Step 1
 *      Attempt key–value parsing.
 *
 *    Step 2
 *      If insufficient metadata is detected,
 *      fallback to positional header interpretation.
 *
 * CRS Detection:
 *
 *    resolveEpsgFromHdrMetadata() attempts to infer the coordinate
 *    reference system by scanning metadata text for common CRS tokens.
 *
 *    Currently supported:
 *      - TWD97 / TM2 → EPSG:3826
 *      - WGS84 → EPSG:4326
 *
 * Notes:
 *
 *    - HDR files do not have a universal standard.
 *    - Many datasets omit CRS entirely.
 *    - In such cases the viewer will report CRS as "Unknown".
 *
 * Intended use:
 *
 *    Web-based DEM / terrain viewers where HDR files accompany
 *    ASCII grid (.grd / .xyz) elevation datasets.
 */

/**
 * 安全轉數字；轉不了就保留原值
 */
function toNumberOrValue(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const n = Number(trimmed);
  return Number.isFinite(n) ? n : trimmed;
}

/**
 * 判斷是否像 key-value header
 * 例如：
 *   ncols 130
 *   nrows=143
 *   projection: TWD97
 */
function parseKeyValueLines(lines) {
  const result = {};
  let matchedCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let key = null;
    let value = null;

    if (trimmed.includes("=")) {
      const parts = trimmed.split("=");
      key = parts[0]?.trim().toLowerCase();
      value = parts.slice(1).join("=").trim();
    } else if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      key = parts[0]?.trim().toLowerCase();
      value = parts.slice(1).join(":").trim();
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        key = parts[0]?.trim().toLowerCase();
        value = parts.slice(1).join(" ").trim();
      }
    }

    if (!key || value == null || value === "") continue;

    result[key] = toNumberOrValue(value);
    matchedCount += 1;
  }

  return {
    result,
    matchedCount,
  };
}

/**
 * 解析固定行序型 HDR
 * 針對你目前那種：
 * line 0  datasetId
 * line 1  projectionName   (例如 TWD97)
 * line 2  datumName        (例如 TWWD2001)
 * line 3  scaleFactor
 * line 4  unit             (例如 m)
 * line 5  cellSizeX
 * line 6  cellSizeY
 * line 7  width
 * line 8  height
 * line 9  pointCount
 * line 10 pointCount2
 * line 11 minX / originX
 * line 12 minY / originY
 * line 13 maxX
 * line 14 maxY
 */
function parsePositionalLines(lines) {
  return {
    rawLines: lines,

    datasetId: lines[0] ?? null,
    projectionName: lines[1] ?? null,
    datumName: lines[2] ?? null,
    scaleFactor: toNumberOrValue(lines[3]),
    unit: lines[4] ?? null,

    cellSizeX: toNumberOrValue(lines[5]),
    cellSizeY: toNumberOrValue(lines[6]),

    width: toNumberOrValue(lines[7]),
    height: toNumberOrValue(lines[8]),

    pointCount: toNumberOrValue(lines[9]),
    pointCount2: toNumberOrValue(lines[10]),

    minX: toNumberOrValue(lines[11]),
    minY: toNumberOrValue(lines[12]),
    maxX: toNumberOrValue(lines[13]),
    maxY: toNumberOrValue(lines[14]),
  };
}

/**
 * 統一 HDR metadata 欄位名稱
 */
function normalizeHdrMetadata(meta) {
  if (!meta) return null;

  const normalized = { ...meta };

  // 常見 nodata key
  if (meta.nodata_value !== undefined) {
    normalized.nodata = meta.nodata_value;
  }

  if (meta.nodata !== undefined) {
    normalized.nodata = meta.nodata;
  }

  // grid size
  if (meta.ncols !== undefined && normalized.width === undefined) {
    normalized.width = meta.ncols;
  }

  if (meta.nrows !== undefined && normalized.height === undefined) {
    normalized.height = meta.nrows;
  }

  // cell size
  if (meta.cellsize !== undefined) {
    if (normalized.cellSizeX === undefined) normalized.cellSizeX = meta.cellsize;
    if (normalized.cellSizeY === undefined) normalized.cellSizeY = meta.cellsize;
  }

  return normalized;
}

/**
 * 解析 HDR 檔案
 * 會先嘗試 key-value 格式；
 * 若幾乎解析不到，再退回固定行序格式。
 */
export async function parseHdrFile(file) {
  if (!file) return null;

  const text = await file.text();
  console.log("[HDR RAW TEXT]", text);

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  console.log("[HDR LINES]", lines);

  if (!lines.length) {
    return null;
  }

  // 先試 key-value 解析
  const { result: kvMeta, matchedCount } = parseKeyValueLines(lines);

  let parsed = null;

  if (matchedCount >= 2) {
    parsed = normalizeHdrMetadata(kvMeta);
  } else {
    // 否則改用固定行序格式
    parsed = normalizeHdrMetadata(parsePositionalLines(lines));
  }

  console.log("[HDR PARSED RESULT]", parsed);
  return parsed;
}

/**
 * 從 HDR metadata 嘗試推斷 EPSG
 */
export function resolveEpsgFromHdrMetadata(meta) {
  if (!meta) return null;

  const joined = [
    ...Object.entries(meta).map(([k, v]) => `${k} ${v}`),
    ...(Array.isArray(meta.rawLines) ? meta.rawLines : []),
  ]
    .join(" ")
    .toLowerCase();

  // ===== 台灣 TWD97 / TM2 =====
  if (
    joined.includes("3826") ||
    joined.includes("twd97") ||
    joined.includes("tm2") ||
    joined.includes("taiwan") ||
    joined.includes("twwd2001")
  ) {
    return 3826;
  }

  // ===== WGS84 =====
  if (
    joined.includes("4326") ||
    joined.includes("wgs84") ||
    joined.includes("wgs 84")
  ) {
    return 4326;
  }

  return null;
}