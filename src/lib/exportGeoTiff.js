import { writeArrayBuffer } from "geotiff";

/**
 * 將單波段 Float32 raster 輸出為 GeoTIFF Blob
 *
 * 必要輸入：
 * - raster: Float32Array | number[]
 * - width: number
 * - height: number
 *
 * 地理資訊：
 * - originX: 左上角像素左上角的 X
 * - originY: 左上角像素左上角的 Y
 * - cellSizeX: 像素寬
 * - cellSizeY: 像素高（正值傳入即可，GeoTIFF metadata 內會處理成標準 north-up）
 *
 * CRS：
 * - epsg: 例如 3826 / 4326
 *
 * NoData：
 * - gd al 常見是 -9999；這裡同樣寫入 GDAL_NODATA tag
 */
export async function rasterToGeoTiffBlob({
  raster,
  width,
  height,
  originX,
  originY,
  cellSizeX,
  cellSizeY,
  epsg = null,
  noDataValue = -9999,
  fileDirectory = {},
}) {
  if (!raster) {
    throw new Error("raster is required.");
  }

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error("width must be a positive integer.");
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error("height must be a positive integer.");
  }

  if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
    throw new Error("originX and originY are required.");
  }

  if (!Number.isFinite(cellSizeX) || !Number.isFinite(cellSizeY)) {
    throw new Error("cellSizeX and cellSizeY are required.");
  }

  const values =
    raster instanceof Float32Array ? raster : Float32Array.from(raster);

  if (values.length !== width * height) {
    throw new Error(
      `Raster length mismatch: expected ${width * height}, got ${values.length}.`
    );
  }

  const metadata = {
    width,
    height,

    // 單波段 Float32 DEM
    BitsPerSample: [32],
    SampleFormat: [3], // 3 = IEEE floating point
    SamplesPerPixel: 1,

    // GeoTIFF georeferencing
    // north-up raster 通常用正 pixel scale，Y 方向由 tiepoint / reader 處理
    ModelPixelScale: [cellSizeX, cellSizeY, 0],
    ModelTiepoint: [0, 0, 0, originX, originY, 0],

    // GDAL 常見 nodata 存法
    GDAL_NODATA: String(noDataValue),

    ...fileDirectory,
  };

  if (epsg != null) {
    metadata.ProjectedCSTypeGeoKey = epsg;
    metadata.GTModelTypeGeoKey = 1; // Projected
    metadata.GTRasterTypeGeoKey = 1; // PixelIsArea
  }

  const arrayBuffer = await writeArrayBuffer(values, metadata);
  return new Blob([arrayBuffer], { type: "image/tiff" });
}

/**
 * 下載 Blob 成 .tif
 */
export function downloadBlob(blob, filename = "output.tif") {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // 稍微延後釋放，避免部分瀏覽器下載中被回收
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * 直接把 raster 寫成 GeoTIFF 並下載
 */
export async function exportRasterAsGeoTiff({
  raster,
  width,
  height,
  originX,
  originY,
  cellSizeX,
  cellSizeY,
  epsg = null,
  noDataValue = -9999,
  filename = "dem.tif",
  fileDirectory = {},
}) {
  const blob = await rasterToGeoTiffBlob({
    raster,
    width,
    height,
    originX,
    originY,
    cellSizeX,
    cellSizeY,
    epsg,
    noDataValue,
    fileDirectory,
  });

  downloadBlob(blob, filename);
  return blob;
}