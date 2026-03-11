import { fromUrl, fromArrayBuffer } from "geotiff";

function computeStats(values, noData) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (noData != null && v === noData) continue;

    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    count += 1;
  }

  return {
    min: count ? min : null,
    max: count ? max : null,
    mean: count ? sum / count : null,
    validCount: count,
  };
}

async function openGeoTiffFromSource(source) {
  if (source.type === "url") {
    return await fromUrl(source.value);
  }

  if (source.type === "file") {
    const buffer = await source.value.arrayBuffer();
    return await fromArrayBuffer(buffer);
  }

  throw new Error(`Unsupported source type: ${source.type}`);
}

function guessUnitHint(crsText = "", pixelSizeX, pixelSizeY) {
  const text = String(crsText).toLowerCase();

  if (
    text.includes("twd97") ||
    text.includes("tm2") ||
    text.includes("utm") ||
    text.includes("meter") ||
    text.includes("metre") ||
    text.includes("epsg:3826")
  ) {
    return "meter";
  }

  if (
    text.includes("wgs84") ||
    text.includes("wgs 84") ||
    text.includes("degree") ||
    text.includes("epsg:4326")
  ) {
    return "degree";
  }

  if (Math.abs(pixelSizeX) < 0.1 && Math.abs(pixelSizeY) < 0.1) {
    return "unknown";
  }

  return "unknown";
}

function formatGeoTiffCrs(geoKeys = {}) {
  const projected = geoKeys.ProjectedCSTypeGeoKey;
  const geographic = geoKeys.GeographicTypeGeoKey;

  if (projected != null) {
    if (Number(projected) === 3826) {
      return "TWD97 / TM2 (EPSG:3826)";
    }
    return `EPSG:${projected}`;
  }

  if (geographic != null) {
    if (Number(geographic) === 4326) {
      return "WGS84 (EPSG:4326)";
    }
    return `EPSG:${geographic}`;
  }

  return "Unknown CRS";
}

export async function inspectGeoTiffSource(source) {
  const tiff = await openGeoTiffFromSource(source);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const bandCount = image.getSamplesPerPixel();

  const noDataRaw = image.getGDALNoData();
  const noData = noDataRaw != null ? Number(noDataRaw) : null;

  const [left, bottom, right, top] = image.getBoundingBox();
  const resolution = image.getResolution();

  const pixelSizeX = Math.abs(resolution?.[0] ?? (right - left) / width);
  const pixelSizeY = Math.abs(resolution?.[1] ?? (top - bottom) / height);

  const rasters = await image.readRasters({ interleave: true });
  const stats = computeStats(rasters, noData);

  const geoKeys = image.getGeoKeys?.() ?? {};
  const crsText = formatGeoTiffCrs(geoKeys);

  return {
    width,
    height,
    bandCount,
    dtype: rasters?.constructor?.name ?? "Unknown",
    noData,
    bounds: { left, bottom, right, top },
    center: {
      x: (left + right) / 2,
      y: (bottom + top) / 2,
    },
    pixelSizeX,
    pixelSizeY,
    crs: crsText,
    crsRaw: geoKeys,
    unitHint: guessUnitHint(crsText, pixelSizeX, pixelSizeY),
    stats,
    data: rasters,
  };
}