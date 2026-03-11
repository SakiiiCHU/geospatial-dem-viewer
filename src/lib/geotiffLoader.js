import { fromUrl } from "geotiff";
import * as THREE from "three";

function computeStats(values, noData) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];

    if (!Number.isFinite(v)) continue;
    if (noData !== null && v === noData) continue;

    if (v < min) min = v;
    if (v > max) max = v;

    sum += v;
    count++;
  }

  return {
    min: count ? min : null,
    max: count ? max : null,
    mean: count ? sum / count : null,
    validCount: count,
  };
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

export async function loadGeoTiffAsSurface(url, zScale = 1) {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const bandCount = image.getSamplesPerPixel();

  const rasters = await image.readRasters({ interleave: true });

  const noDataRaw = image.getGDALNoData();
  const noData = noDataRaw !== null ? Number(noDataRaw) : null;

  const [left, bottom, right, top] = image.getBoundingBox();
  const resolution = image.getResolution();

  const pixelSizeX = Math.abs(resolution?.[0] ?? (right - left) / width);
  const pixelSizeY = Math.abs(resolution?.[1] ?? (top - bottom) / height);

  const geoKeys = image.getGeoKeys?.() ?? {};
  const crsText = formatGeoTiffCrs(geoKeys);

  const stats = computeStats(rasters, noData);

  const physicalWidth = (width - 1) * pixelSizeX;
  const physicalHeight = (height - 1) * pixelSizeY;

  const geometry = new THREE.PlaneGeometry(
    physicalWidth,
    physicalHeight,
    width - 1,
    height - 1
  );

  const positions = geometry.attributes.position;
  const colors = new Float32Array(width * height * 3);
  const color = new THREE.Color();

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const srcIndex = row * width + col;
      const meshRow = height - 1 - row;
      const vertexIndex = meshRow * width + col;

      const v = rasters[srcIndex];

      let z = 0;
      let t = 0;

      const valid = Number.isFinite(v) && !(noData !== null && v === noData);

      if (valid && stats.max !== stats.min) {
        z = v * zScale;
        t = (v - stats.min) / (stats.max - stats.min);
      }

      positions.setZ(vertexIndex, z);

      if (!valid) {
        color.setRGB(0.2, 0.2, 0.2);
      } else {
        color.setHSL((1 - t) * 0.7, 1.0, 0.5);
      }

      colors[vertexIndex * 3 + 0] = color.r;
      colors[vertexIndex * 3 + 1] = color.g;
      colors[vertexIndex * 3 + 2] = color.b;
    }
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const metadata = {
    width,
    height,
    bandCount,
    dtype: rasters?.constructor?.name ?? "Unknown",
    crs: crsText,
    crsRaw: geoKeys,
    noData,
    bounds: { left, bottom, right, top },
    center: {
      x: (left + right) / 2,
      y: (bottom + top) / 2,
    },
    pixelSizeX,
    pixelSizeY,
    unitHint: guessUnitHint(crsText, pixelSizeX, pixelSizeY),
    stats,
  };

  return {
    geometry,
    metadata,
  };
}