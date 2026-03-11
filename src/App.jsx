import { useMemo, useState, useEffect, useCallback } from "react";
import ViewerCanvasArea from "./components/ViewerCanvasArea";
import { inspectGeoTiffSource } from "./lib/geotiffInspector";
import { checkLayerCompatibility } from "./lib/layerCompatibility";
import SidebarControls from "./components/SidebarControls";
import CompatibilityModal from "./components/CompatibilityModal";
import { inspectAsciiGrdBounds } from "./lib/grdLoader";
import { grdFileToRaster, mergeGrdFilesToRaster } from "./lib/grdToRaster";
import { exportRasterAsGeoTiff } from "./lib/exportGeoTiff";
import { parseHdrFile, resolveEpsgFromHdrMetadata } from "./lib/hdrParser";

const FILE_OPTIONS = [
  {
    id: "a05",
    label: "A05-filter-layer-diff.tiff",
    url: "/data/A05-filter-layer-diff.tiff",
  },
  {
    id: "g01",
    label: "G01_legA_as-built.tiff",
    url: "/data/G01_legA_as-built.tiff",
  },
];

const WORLD_SCALE = 0.02;

function getFileExtension(filename = "") {
  const lower = filename.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx);
}

function isGeoTiffFile(file) {
  const ext = getFileExtension(file?.name || "");
  return ext === ".tif" || ext === ".tiff";
}

function isGrdFile(file) {
  const ext = getFileExtension(file?.name || "");
  return ext === ".grd";
}

function isHdrFile(file) {
  const ext = getFileExtension(file?.name || "");
  return ext === ".hdr";
}

function createLocalImportItem(file) {
  return {
    id: `local-${crypto.randomUUID()}`,
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    extension: getFileExtension(file.name),
    source: URL.createObjectURL(file),
    sourceType: "local-file",
    status: "pending",
  };
}

function formatBool(value) {
  return value ? "true" : "false";
}

function getBaseName(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

export default function App() {
  const [selectedUrl, setSelectedUrl] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [zScale, setZScale] = useState(5);

  const [pickedPointsByLayer, setPickedPointsByLayer] = useState({});

  const [inspectResult, setInspectResult] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState("");
  const [viewMode, setViewMode] = useState("single");

  const [layers, setLayers] = useState([]);
  const [projectionMode, setProjectionMode] = useState("3d");

  const [pendingImports, setPendingImports] = useState([]);
  const [dropErrors, setDropErrors] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [renderMode, setRenderMode] = useState("surface");

  // GRD workflow states
  const [grdLayers, setGrdLayers] = useState([]);
  const [terrainMode, setTerrainMode] = useState("points");
  const [grdGlobalCenter, setGrdGlobalCenter] = useState(null);
  const [legendByLayer, setLegendByLayer] = useState({});

  const activeGrdLayer = grdLayers[0] ?? null;
  const activeGrdEpsg = resolveExportEpsg(grdLayers);

  function handleCollapseSidebar() {
    setSidebarCollapsed(true);
  }

  function handleExpandSidebar() {
    setSidebarCollapsed(false);
  }

  const selectedPendingImport = useMemo(() => {
    return pendingImports.find((item) => item.source === selectedUrl) ?? null;
  }, [pendingImports, selectedUrl]);

  const selectedLabel = useMemo(() => {
    return (
      FILE_OPTIONS.find((f) => f.url === selectedUrl)?.label ??
      selectedPendingImport?.name ??
      ""
    );
  }, [selectedUrl, selectedPendingImport]);

  const selectedLayerId = useMemo(() => {
    return (
      FILE_OPTIONS.find((f) => f.url === selectedUrl)?.id ??
      selectedPendingImport?.id ??
      null
    );
  }, [selectedUrl, selectedPendingImport]);

  const activePickedPoint = pickedPointsByLayer[selectedLayerId] ?? null;

  const compatibility = inspectResult?.compatibility ?? null;
  const compatibilityDetails = compatibility?.details ?? null;
  const compatibilityMessages = compatibility?.messages ?? [];
  const inspectedLayers = inspectResult?.inspected ?? [];

  const globalCenter = useMemo(() => {
    if (!layers.length) return { x: 0, y: 0 };

    const sum = layers.reduce(
      (acc, layer) => {
        acc.x += layer.center.x;
        acc.y += layer.center.y;
        return acc;
      },
      { x: 0, y: 0 },
    );

    return {
      x: sum.x / layers.length,
      y: sum.y / layers.length,
    };
  }, [layers]);

  const visibleLayers = useMemo(() => {
    return layers.filter((layer) => layer.visible);
  }, [layers]);

  useEffect(() => {
    if (!selectedUrl) {
      setMetadata(null);
    }
  }, [selectedUrl]);

  useEffect(() => {
    function handleResponsiveSidebar() {
      if (window.innerWidth <= 1100) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    }

    handleResponsiveSidebar();
    window.addEventListener("resize", handleResponsiveSidebar);

    return () => {
      window.removeEventListener("resize", handleResponsiveSidebar);
    };
  }, []);

  // ===== general reset for TIFF workflow =====
  function resetViewerState({
    keepDropErrors = false,
    keepPendingImports = false,
  } = {}) {
    setInspectResult(null);
    setLayers([]);
    setPickedPointsByLayer({});
    setMetadata(null);
    setShowCompatibilityModal(false);

    if (!keepPendingImports) {
      setPendingImports([]);
    }

    if (!keepDropErrors) {
      setDropErrors([]);
    }
  }

  // ===== legend helpers =====
  const updateLegendFromMetadata = useCallback((layerKey, metadata) => {
    const minZ =
      metadata?.bounds?.minZ ??
      metadata?.min ??
      metadata?.stats?.min ??
      metadata?.minZ ??
      metadata?.valueRange?.min;

    const maxZ =
      metadata?.bounds?.maxZ ??
      metadata?.max ??
      metadata?.stats?.max ??
      metadata?.maxZ ??
      metadata?.valueRange?.max;

    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      console.log("[legend] cannot extract range from metadata:", metadata);
      return;
    }

    setLegendByLayer((prev) => {
      const old = prev[layerKey];
      if (old && old.minZ === minZ && old.maxZ === maxZ) {
        return prev;
      }

      return {
        ...prev,
        [layerKey]: { minZ, maxZ },
      };
    });
  }, []);

  const handleMetadataUpdate = useCallback(
    (layerKey, newMetadata) => {
      setMetadata(newMetadata);
      updateLegendFromMetadata(layerKey, newMetadata);
    },
    [updateLegendFromMetadata],
  );

  // ===== GRD + .tiff reset =====
function resetViewerStateForGrd() {
  // GRD
  setGrdLayers([]);
  setGrdGlobalCenter(null);
  setTerrainMode("points");

  // shared / viewer
  setLegendByLayer({});
  setPickedPointsByLayer({});
  setMetadata(null);

  // TIFF / inspect / current session
  setSelectedUrl("");
  setInspectError("");
  setInspectResult(null);
  setLayers([]);
  setPendingImports([]);
  setDropErrors([]);
  setViewMode("single");
}

  // 新增統一匯入檔案邏輯

  async function handleTiffFilesImported(files) {
    const accepted = files.map(createLocalImportItem);

    try {
      setInspectLoading(true);
      setInspectError("");
      resetViewerState();
      resetViewerStateForGrd();

      setPendingImports(accepted);
      setSelectedUrl(accepted[0]?.source ?? "");

      const inspected = await inspectDroppedImports(accepted);
      const compatibility = checkLayerCompatibility(inspected);

      setInspectResult({
        inspected,
        compatibility,
      });

      setLayers(
        inspected.map((layer) => ({
          id: layer.id,
          name: layer.name,
          source: layer.source,
          center: layer.center,
          visible: true,
        })),
      );

      if (compatibility.mode === "same-scene") {
        setViewMode("same-scene");
        setShowCompatibilityModal(false);
      } else if (compatibility.mode === "split-scene") {
        setViewMode("split-scene");
        setShowCompatibilityModal(false);
      } else {
        setViewMode("review");
        setShowCompatibilityModal(true);
      }
    } catch (error) {
      console.error("TIFF IMPORT ERROR:", error);
      setInspectError(error?.message || "Failed to inspect TIFF files.");
    } finally {
      setInspectLoading(false);
    }
  }

  //匯入sample用的 handler
  //一次測兩組tiff
  async function handleLoadSampleTiffPair() {
  try {
    const samplePaths = [
      "samples/sample-dem-1.tiff",
      "samples/sample-dem-2.tiff",
    ];

    const files = await Promise.all(
      samplePaths.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load ${url}`);
        }

        const blob = await response.blob();
        const name = url.split("/").pop() || "sample-file";

        return new File([blob], name, {
          type: blob.type || "image/tiff",
        });
      })
    );

    await handleImportedFiles(files);
  } catch (err) {
    console.error("[Sample GeoTIFF pair load failed]", err);
    alert("Failed to load sample GeoTIFF pair.");
  }
}
  //一次測五組grd
  async function handleLoadSampleGrdSet() {
  try {
    const samplePaths = [
      "samples/sample-dem-1.grd",
      "samples/sample-dem-1.hdr",
      "samples/sample-dem-2.grd",
      "samples/sample-dem-2.hdr",
      "samples/sample-dem-3.grd",
      "samples/sample-dem-3.hdr",
      "samples/sample-dem-4.grd",
      "samples/sample-dem-4.hdr",
      "samples/sample-dem-5.grd",
      "samples/sample-dem-5.hdr",
    ];

    const files = await Promise.all(
      samplePaths.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load ${url}`);
        }

        const blob = await response.blob();
        const name = url.split("/").pop() || "sample-file";

        return new File([blob], name, {
          type: blob.type || "application/octet-stream",
        });
      })
    );

    await handleImportedFiles(files);
  } catch (err) {
    console.error("[Sample GRD set load failed]", err);
    alert("Failed to load sample GRD/HDR dataset set.");
  }
}




  // 原本 handleGrdFilesSelected 的核心邏輯抽出來
  async function handleGrdHdrFilesImported(files) {
    resetViewerState();
    resetViewerStateForGrd();

    const pairingMap = new Map();

    for (const file of files) {
      const lower = file.name.toLowerCase();

      if (!lower.endsWith(".grd") && !lower.endsWith(".hdr")) {
        continue;
      }

      const baseName = getBaseName(file.name);

      if (!pairingMap.has(baseName)) {
        pairingMap.set(baseName, {
          id: baseName,
          name: baseName,
          grdFile: null,
          hdrFile: null,
        });
      }

      const item = pairingMap.get(baseName);

      if (lower.endsWith(".grd")) {
        item.grdFile = file;
      }

      if (lower.endsWith(".hdr")) {
        item.hdrFile = file;
      }
    }

    const pairedItems = Array.from(pairingMap.values()).filter(
      (item) => item.grdFile,
    );

    if (pairedItems.length === 0) {
      return;
    }

    const nextGrdLayers = [];

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const item of pairedItems) {
      const info = await inspectAsciiGrdBounds(item.grdFile);

      let hdrMeta = null;
      if (item.hdrFile) {
        hdrMeta = await parseHdrFile(item.hdrFile);
      }

      const layer = {
        ...item,
        name: item.grdFile.name,

        bounds: info.bounds,
        center: info.center,
        pointCount: info.pointCount,

        grdType: info.grdType,
        gridInfo: info.gridInfo,

        hdrMeta,
      };

      nextGrdLayers.push(layer);

      const b = info.bounds;
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    setGrdLayers(nextGrdLayers);

    const center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    };

    setGrdGlobalCenter(center);

    updateLegendFromMetadata("__grd__", {
      bounds: { minZ, maxZ },
    });

    setViewMode("single");
  }
  //新增真正的統一入口 handleImportedFiles
  async function handleImportedFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const tiffFiles = files.filter(isGeoTiffFile);
    const grdHdrFiles = files.filter(
      (file) => isGrdFile(file) || isHdrFile(file),
    );
    const unsupportedFiles = files.filter(
      (file) => !isGeoTiffFile(file) && !isGrdFile(file) && !isHdrFile(file),
    );

    if (unsupportedFiles.length) {
      setDropErrors((prev) => [
        ...unsupportedFiles.map((file) => ({
          name: file.name,
          reason: "Only .tif, .tiff, .grd, and .hdr files are supported.",
        })),
        ...prev,
      ]);
    }

    if (tiffFiles.length && grdHdrFiles.length) {
      setInspectError(
        "Please import GeoTIFF files and GRD/HDR files separately in different batches.",
      );
      return;
    }

    if (tiffFiles.length) {
      await handleTiffFilesImported(tiffFiles);
      return;
    }

    if (grdHdrFiles.length) {
      await handleGrdHdrFilesImported(grdHdrFiles);
    }
  }

  //新增 input 專用 wrapper：handleImportFilesSelected
  async function handleImportFilesSelected(event) {
    const input = event.target;
    const files = Array.from(input.files || []);

    await handleImportedFiles(files);

    input.value = "";
  }

  // ===== GRD file input =====

  async function handleGrdFilesSelected(event) {
    await handleImportFilesSelected(event);
  }

function resolveExportEpsg(grdLayers) {
  for (const layer of grdLayers) {
    if (!layer.hdrMeta) continue;

    console.log("[HDR META]", layer.hdrMeta);

    const detected = resolveEpsgFromHdrMetadata(layer.hdrMeta);
    console.log("[DETECTED EPSG]", detected);

    if (detected) {
      return detected;
    }
  }

  return null;
}

  // ===== GRD export =====
  async function handleExportGeoTiff() {
    if (grdLayers.length === 0) {
      alert("No GRD loaded.");
      return;
    }

    try {
      // ================================
      // 先檢查是否為散點 XYZ
      // ================================
      for (const layer of grdLayers) {
        if (layer.grdType === "scatter") {
          alert("XYZ point cloud cannot export GeoTIFF directly.");
          return;
        }
      }

      // ================================
      // 解析 CRS（從 layer.hdrMeta 取）
      // ================================
      const epsg = resolveExportEpsg(grdLayers);
      console.log("[CRS] detected EPSG:", epsg ?? "unknown");

      // ================================
      // 單一 GRD export
      // ================================
      if (grdLayers.length === 1) {
        const layer = grdLayers[0];
        const grdFile = layer.grdFile;

        const result = await grdFileToRaster(grdFile);

        await exportRasterAsGeoTiff({
          raster: result.raster,
          width: result.width,
          height: result.height,
          originX: result.origin.x,
          originY: result.origin.y,
          cellSizeX: result.cellSizeX,
          cellSizeY: result.cellSizeY,
          epsg: epsg,
          noDataValue: result.noDataValue,
          filename: grdFile.name.replace(/\.grd$/i, ".tif"),
        });

        console.log("[GeoTIFF] single export done");
        return;
      }

      // ================================
      // 多 GRD merge export
      // ================================
      const grdFiles = grdLayers.map((layer) => layer.grdFile).filter(Boolean);

      const merged = await mergeGrdFilesToRaster(grdFiles);

      await exportRasterAsGeoTiff({
        raster: merged.raster,
        width: merged.width,
        height: merged.height,
        originX: merged.origin.x,
        originY: merged.origin.y,
        cellSizeX: merged.cellSizeX,
        cellSizeY: merged.cellSizeY,
        epsg: epsg,
        noDataValue: merged.noDataValue,
        filename: "merged-dem.tif",
      });

      console.log("[GeoTIFF] merged export done");
    } catch (err) {
      console.error("[Export GeoTIFF failed]", err);
      alert(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  // ===== TIFF sample inspect =====
  async function handleInspectSamples() {
    try {
      setInspectLoading(true);
      setInspectError("");
      resetViewerState();
      resetViewerStateForGrd();
      setSelectedUrl(FILE_OPTIONS[0]?.url ?? "");

      const sources = FILE_OPTIONS.map((file) => ({
        id: file.id,
        name: file.label,
        type: "url",
        value: file.url,
      }));

      const inspected = await Promise.all(
        sources.map(async (source) => {
          const meta = await inspectGeoTiffSource(source);
          return {
            id: source.id,
            name: source.name,
            source: source.value,
            ...meta,
          };
        }),
      );

      const compatibility = checkLayerCompatibility(inspected);

      setInspectResult({
        inspected,
        compatibility,
      });

      setLayers(
        inspected.map((layer) => ({
          id: layer.id,
          name: layer.name,
          source: layer.source,
          center: layer.center,
          visible: true,
        })),
      );

      if (compatibility.mode === "same-scene") {
        setViewMode("same-scene");
        setShowCompatibilityModal(false);
      } else if (compatibility.mode === "split-scene") {
        setViewMode("split-scene");
        setShowCompatibilityModal(false);
      } else {
        setViewMode("review");
        setShowCompatibilityModal(true);
      }
    } catch (error) {
      console.error("INSPECT ERROR:", error);
      setInspectError(error?.message || "Failed to inspect sample TIFF files.");
    } finally {
      setInspectLoading(false);
    }
  }

  function handleChooseSameScene() {
    setViewMode("same-scene");
    setShowCompatibilityModal(false);
  }

  function handleChooseSplitScene() {
    setViewMode("split-scene");
    setShowCompatibilityModal(false);
  }

  function handleToggleLayer(layerId) {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }

  async function inspectDroppedImports(importItems) {
    const sources = importItems.map((item) => ({
      id: item.id,
      name: item.name,
      type: "url",
      value: item.source,
    }));

    const inspected = await Promise.all(
      sources.map(async (source) => {
        const meta = await inspectGeoTiffSource(source);
        return {
          id: source.id,
          name: source.name,
          source: source.value,
          ...meta,
        };
      }),
    );

    return inspected;
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;

    await handleImportedFiles(files);
  }

  return (
    <div className="app-shell">
      <CompatibilityModal
        compatibility={compatibility}
        showCompatibilityModal={showCompatibilityModal}
        handleChooseSameScene={handleChooseSameScene}
        handleChooseSplitScene={handleChooseSplitScene}
      />

      <SidebarControls
        zScale={zScale}
        setZScale={setZScale}
        handleInspectSamples={handleInspectSamples}
        inspectLoading={inspectLoading}
        inspectError={inspectError}
        compatibility={compatibility}
        compatibilityDetails={compatibilityDetails}
        compatibilityMessages={compatibilityMessages}
        viewMode={viewMode}
        inspectedLayers={inspectedLayers}
        formatBool={formatBool}
        pendingImports={pendingImports}
        dropErrors={dropErrors}
        layers={layers}
        handleToggleLayer={handleToggleLayer}
        activePickedPoint={activePickedPoint}
        metadata={metadata}
        selectedLabel={selectedLabel}
        sidebarCollapsed={sidebarCollapsed}
        onCollapseSidebar={handleCollapseSidebar}
        onExpandSidebar={handleExpandSidebar}
        projectionMode={projectionMode}
        setProjectionMode={setProjectionMode}
        renderMode={renderMode}
        setRenderMode={setRenderMode}
        grdLayers={grdLayers}
        terrainMode={terrainMode}
        onGrdFilesSelected={handleGrdFilesSelected}
        onExportGeoTiff={handleExportGeoTiff}
        onClearGrdViewer={resetViewerStateForGrd}
        onTerrainModeChange={setTerrainMode}
        activeGrdLayer={activeGrdLayer}
        activeGrdEpsg={activeGrdEpsg}
        onLoadSampleGrdSet={handleLoadSampleGrdSet}
        onLoadSampleTiffPair={handleLoadSampleTiffPair}
      />

      <ViewerCanvasArea
        isDragging={isDragging}
        handleDragEnter={handleDragEnter}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        viewMode={viewMode}
        projectionMode={projectionMode}
        selectedUrl={selectedUrl}
        selectedLayerId={selectedLayerId}
        selectedLabel={selectedLabel}
        zScale={zScale}
        setMetadata={setMetadata}
        setPickedPointsByLayer={setPickedPointsByLayer}
        pickedPointsByLayer={pickedPointsByLayer}
        visibleLayers={visibleLayers}
        globalCenter={globalCenter}
        WORLD_SCALE={WORLD_SCALE}
        renderMode={renderMode}
        grdLayers={grdLayers}
        terrainMode={terrainMode}
        grdGlobalCenter={grdGlobalCenter}
        legendByLayer={legendByLayer}
        handleMetadataUpdate={handleMetadataUpdate}
      />
    </div>
  );
}
