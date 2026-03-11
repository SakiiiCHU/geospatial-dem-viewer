import { useId } from "react";
import MetadataPanel from "./MetadataPanel";

export default function SidebarControls({
  sidebarCollapsed,
  onCollapseSidebar,
  onExpandSidebar,
  zScale,
  setZScale,
  inspectError,
  compatibility,
  compatibilityDetails,
  compatibilityMessages,
  viewMode,
  inspectedLayers,
  formatBool,
  pendingImports,
  dropErrors,
  layers,
  handleToggleLayer,
  activePickedPoint,
  metadata,
  selectedLabel,
  projectionMode,
  setProjectionMode,
  renderMode,
  setRenderMode,
  grdLayers,
  terrainMode,
  onGrdFilesSelected,
  onExportGeoTiff,
  onClearGrdViewer,
  onTerrainModeChange,
  activeGrdLayer,
  activeGrdEpsg,
  onLoadSampleGrdSet,
  onLoadSampleTiffPair,
}) {
  const hasAnyTerrain =
    grdLayers.length > 0 || layers.length > 0 || pendingImports.length > 0;

  const showLegacyMetadataPanel = grdLayers.length === 0 && !!metadata;

  const fileInputId = useId();

  return (
    <div className={`sidebar-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <button
        className="sidebar-toggle"
        onClick={sidebarCollapsed ? onExpandSidebar : onCollapseSidebar}
      >
        <span className="toggle-grip">
          <span />
          <span />
        </span>
      </button>

      <aside className="sidebar">
        <h1>Terrain Data Viewer</h1>
        <p className="sidebar-desc">
          Import, inspect, and visualize GeoTIFF / GRD terrain datasets in 2D or
          3D.
        </p>

        <div className="inspect-status inspect-layers">
          <div className="decision-title">Import Terrain Files</div>

          <div className="control-block">
            <span>Choose files</span>

            <input
              id={fileInputId}
              type="file"
              accept=".tif,.tiff,.grd,.hdr"
              multiple
              onChange={onGrdFilesSelected}
              style={{ display: "none" }}
            />

            <label
  htmlFor={fileInputId}
  className="decision-btn"
  style={{ marginTop: 8 }}
>
  Load Local Files
</label>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                opacity: 0.72,
                lineHeight: 1.5,
              }}
            >
              Supports GeoTIFF (.tif, .tiff) and ASCII GRD (.grd). Optional
              matching HDR metadata can also be included.
            </div>
          </div>

          {/* 測試demo區*/}
          <div className="control-block">
            <span>Quick actions</span>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                className="decision-btn"
                type="button"
                onClick={onLoadSampleTiffPair}
                style={{ width: "100%" }}
              >
                Sample TIFF
              </button>

              <button
                className="decision-btn"
                type="button"
                onClick={onLoadSampleGrdSet}
                style={{ width: "100%" }}
              >
                Sample GRD
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 10,
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.72 }}>
                Try built-in sample datasets
              </div>

              <button
                className="decision-btn"
                type="button"
                onClick={onClearGrdViewer}
                style={{
                  width: "auto",
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="control-block">
            <span>Loaded datasets</span>
            <strong>{grdLayers.length || layers.length || 0}</strong>
          </div>
        </div>

        <div className="inspect-status inspect-layers">
          <div className="decision-title">Display</div>

          <div className="control-block">
            <span>Projection</span>

            <div className="segmented-control">
              <div
                className={`segmented-pill ${
                  projectionMode === "2d" ? "is-right" : ""
                }`}
              />

              <button
                className="segmented-option"
                onClick={() => setProjectionMode("3d")}
              >
                3D
              </button>

              <button
                className="segmented-option"
                onClick={() => setProjectionMode("2d")}
              >
                2D
              </button>
            </div>
          </div>

          <div className="control-block">
            <span>GeoTIFF Display</span>

            <div className="segmented-control">
              <div
                className={`segmented-pill ${
                  renderMode === "points" ? "is-right" : ""
                }`}
              />

              <button
                className="segmented-option"
                onClick={() => setRenderMode("surface")}
              >
                Surface
              </button>

              <button
                className="segmented-option"
                onClick={() => setRenderMode("points")}
              >
                Points
              </button>
            </div>
          </div>

          <div className="control-block">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span>Vertical Exaggeration</span>
              <div className="control-value-badge">{zScale}×</div>
            </div>

            <input
              className="viewer-range"
              type="range"
              min="1"
              max="10"
              step="1"
              value={zScale}
              onChange={(e) => setZScale(Number(e.target.value))}
              disabled={!hasAnyTerrain || projectionMode === "2d"}
            />

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                opacity: 0.72,
                lineHeight: 1.5,
              }}
            >
              {projectionMode === "2d"
                ? "Disabled in 2D mode."
                : "Adjust vertical exaggeration for terrain rendering."}
            </div>
          </div>
        </div>

{grdLayers.length > 0 ? (
  <div className="inspect-status inspect-layers">
    <div className="decision-title">Terrain Tools</div>

    <div className="control-block">
      <span>GRD Geometry</span>

      <div className="segmented-control">
        <div
          className={`segmented-pill ${
            terrainMode === "mesh" ? "is-right" : ""
          }`}
        />

        <button
          type="button"
          className="segmented-option"
          onClick={() => onTerrainModeChange("points")}
        >
          Points
        </button>

        <button
          type="button"
          className="segmented-option"
          onClick={() => onTerrainModeChange("mesh")}
        >
          Mesh
        </button>
      </div>
    </div>

    <div className="control-block">
      <span>Actions</span>
      <button className="decision-btn" onClick={onExportGeoTiff}>
        Export GeoTIFF
      </button>
    </div>
  </div>
) : null}

        {activeGrdLayer ? (
          <div className="inspect-status inspect-layers">
            <div className="decision-title">GRD Dataset Info</div>

            <div className="layer-summary">
              <div>
                <strong>Type:</strong> {activeGrdLayer.grdType ?? "unknown"}
              </div>

              <div>
                <strong>Point Count:</strong> {activeGrdLayer.pointCount ?? "-"}
              </div>

              <div>
                <strong>Grid Size:</strong>{" "}
                {activeGrdLayer.gridInfo
                  ? `${activeGrdLayer.gridInfo.width} × ${activeGrdLayer.gridInfo.height}`
                  : "-"}
              </div>

              <div>
                <strong>Cell Size:</strong>{" "}
                {activeGrdLayer.gridInfo?.cellSizeX != null &&
                activeGrdLayer.gridInfo?.cellSizeY != null
                  ? `${activeGrdLayer.gridInfo.cellSizeX} × ${activeGrdLayer.gridInfo.cellSizeY}`
                  : "-"}
              </div>

              <div>
                <strong>CRS:</strong>{" "}
                {activeGrdEpsg ? `EPSG:${activeGrdEpsg}` : "Unknown"}
              </div>

              <div>
                <strong>HDR:</strong>{" "}
                {activeGrdLayer.hdrFile ? "Loaded" : "None"}
              </div>
            </div>
          </div>
        ) : null}

        {layers.length ? (
          <div className="inspect-status inspect-layers">
            <div className="decision-title">Layer List</div>
            {layers.map((layer) => (
              <label key={layer.id} className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() => handleToggleLayer(layer.id)}
                />
                <span>{layer.name}</span>
              </label>
            ))}
          </div>
        ) : null}

        {inspectError ? (
          <div className="inspect-status inspect-error">{inspectError}</div>
        ) : null}

        {compatibility ? (
          <div className="inspect-status inspect-result">
            <div className="decision-title">Compatibility</div>

            <div>
              <strong>Mode:</strong> {compatibility.mode}
            </div>
            <div>
              <strong>Current view:</strong> {viewMode}
            </div>
            <div>
              <strong>Layer count:</strong> {inspectedLayers.length}
            </div>

            {compatibilityMessages.length ? (
              <div className="inspect-messages">
                {compatibilityMessages.map((msg, idx) => (
                  <div key={idx}>
                    <strong>{msg.level}:</strong> {msg.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="inspect-messages">
                <div>No compatibility warnings.</div>
              </div>
            )}

            {compatibilityDetails ? (
              <div className="inspect-details">
                <div>
                  <strong>sameCrs:</strong>{" "}
                  {formatBool(compatibilityDetails.sameCrs)}
                </div>
                <div>
                  <strong>sameUnit:</strong>{" "}
                  {formatBool(compatibilityDetails.sameUnit)}
                </div>
                <div>
                  <strong>resolutionComparable:</strong>{" "}
                  {formatBool(compatibilityDetails.resolutionComparable)}
                </div>
                <div>
                  <strong>centersReasonablyClose:</strong>{" "}
                  {formatBool(compatibilityDetails.centersReasonablyClose)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {pendingImports.length ? (
          <div className="inspect-status inspect-layers">
            <div className="decision-title">Pending Imports</div>

            {pendingImports.map((item) => (
              <div key={item.id} className="layer-summary">
                <div>
                  <strong>{item.name}</strong>
                </div>
                <div>Ext: {item.extension}</div>
                <div>Size: {(item.size / 1024 / 1024).toFixed(2)} MB</div>
                <div>Status: {item.status}</div>
                <div>Source Type: {item.sourceType}</div>
              </div>
            ))}
          </div>
        ) : null}

        {dropErrors.length ? (
          <div className="inspect-status inspect-error">
            <div className="decision-title">Rejected Files</div>

            {dropErrors.map((err, idx) => (
              <div key={`${err.name}-${idx}`}>
                <strong>{err.name}</strong>: {err.reason}
              </div>
            ))}
          </div>
        ) : null}

        {inspectedLayers.length ? (
          <div className="inspect-status inspect-layers">
            <div className="decision-title">Inspected Layers</div>
            {inspectedLayers.map((layer) => (
              <div key={layer.id} className="layer-summary">
                <div>
                  <strong>{layer.name}</strong>
                </div>
                <div>
                  {layer.width} × {layer.height}
                </div>
                <div>CRS: {layer.crs}</div>
                <div>
                  Pixel: {layer.pixelSizeX} × {layer.pixelSizeY}
                </div>
                <div>
                  Center: {layer.center.x.toFixed(2)},{" "}
                  {layer.center.y.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activePickedPoint ? (
          <div className="inspect-status inspect-pick">
            <div className="decision-title">Terrain Query</div>

            <div>
              <strong>Layer:</strong> {activePickedPoint.layerName || "-"}
            </div>

            <div>
              <strong>X:</strong> {activePickedPoint.x.toFixed(3)}
            </div>

            <div>
              <strong>Y:</strong> {activePickedPoint.y.toFixed(3)}
            </div>

            <div>
              <strong>Elevation:</strong> {activePickedPoint.z.toFixed(3)} m
            </div>
          </div>
        ) : null}

        {showLegacyMetadataPanel ? (
          <div className="inspect-status inspect-layers">
            <div className="decision-title">Layer Statistics</div>
            <MetadataPanel metadata={metadata} selectedLabel={selectedLabel} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
