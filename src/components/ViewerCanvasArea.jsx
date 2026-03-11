import { useMemo } from "react";
import { Html } from "@react-three/drei";
import GeoTiffSurface from "./GeoTiffSurface";
import ViewerScene from "./ViewerScene";
import PickMarker from "./PickMarker";
import GrdPointCloud from "./GrdPointCloud";
import GrdTerrainMesh from "./GrdTerrainMesh";
import ElevationLegend from "./ElevationLegend";

export default function ViewerCanvasArea({
  isDragging,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  viewMode,
  selectedUrl,
  selectedLayerId,
  selectedLabel,
  zScale,
  setMetadata,
  setPickedPointsByLayer,
  pickedPointsByLayer,
  visibleLayers,
  globalCenter,
  WORLD_SCALE,
  projectionMode,
  renderMode,
  grdLayers,
  terrainMode,
  grdGlobalCenter,
  legendByLayer,
  handleMetadataUpdate,
}) {
  const visibleCount = visibleLayers.length;

  const singleCameraPosition = useMemo(
    () => (projectionMode === "2d" ? [0, 0, 58] : [0, -68, 72]),
    [projectionMode]
  );

  const sameSceneCameraPosition = useMemo(
    () => (projectionMode === "2d" ? [0, 0, 32] : [0, -18, 12]),
    [projectionMode]
  );

  const splitCameraPosition = useMemo(
    () => (projectionMode === "2d" ? [0, 0, 12] : [0, -7, 5]),
    [projectionMode]
  );

  return (
    <main
      className={`viewer-area ${isDragging ? "is-dragging" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <div>Drop terrain files here</div>
            <div className="drop-overlay-sub">
              Supports .tif / .tiff / .grd / .hdr
            </div>
          </div>
        </div>
      )}

      {viewMode === "single" && (
        <div className="viewer-single">
          <div className="viewer-frame">
            <ViewerScene
              projectionMode={projectionMode}
              cameraPosition={singleCameraPosition}
            >
              {grdLayers.length > 0 ? (
                <>
                  {grdLayers.map((layer, index) =>
                    terrainMode === "points" ? (
                      <GrdPointCloud
                        key={layer.id}
                        file={layer.grdFile}
                        worldScale={0.02}
                        zScale={projectionMode === "2d" ? 0 : zScale}
                        pointSize={0.2}
                        sharedCenter={grdGlobalCenter}
                        onMetadata={
                          index === 0
                            ? (metadata) =>
                                handleMetadataUpdate("__grd__", metadata)
                            : undefined
                        }
                        onPick={(point) => {
                          setPickedPointsByLayer((prev) => ({
                            ...prev,
                            [layer.id]: point,
                          }));
                        }}
                        layerName={layer.name}
                        position={[0, 0, 0]}
                      />
                    ) : (
                      <GrdTerrainMesh
                        key={layer.id}
                        file={layer.grdFile}
                        worldScale={0.02}
                        zScale={projectionMode === "2d" ? 0 : zScale}
                        sharedCenter={grdGlobalCenter}
                        onMetadata={
                          index === 0
                            ? (metadata) =>
                                handleMetadataUpdate("__grd__", metadata)
                            : undefined
                        }
                        onPick={(point) => {
                          setPickedPointsByLayer((prev) => ({
                            ...prev,
                            [layer.id]: point,
                          }));
                        }}
                        layerName={layer.name}
                        position={[0, 0, 0]}
                      />
                    )
                  )}

                  {Object.entries(pickedPointsByLayer).map(
                    ([layerId, point]) => (
                      <PickMarker key={layerId} pickedPoint={point} />
                    )
                  )}
                </>
              ) : selectedUrl ? (
                <>
                  <GeoTiffSurface
                    url={selectedUrl}
                    zScale={projectionMode === "2d" ? 0 : zScale}
                    onMetadata={(metadata) =>
                      handleMetadataUpdate(
                        selectedLayerId || "__single__",
                        metadata
                      )
                    }
                    onPick={(point) => {
                      setPickedPointsByLayer((prev) => ({
                        ...prev,
                        [selectedLayerId]: point,
                      }));
                    }}
                    layerName={selectedLabel}
                    position={[0, 0, 0]}
                    worldScale={WORLD_SCALE}
                    renderMode={renderMode}
                  />

                  <PickMarker
                    pickedPoint={pickedPointsByLayer[selectedLayerId] ?? null}
                  />
                </>
              ) : (
                <Html center>
                  <div className="empty-drop-hint">
                    Drag and drop a .tif / .tiff file here
                    <br />
                    or use the sidebar input to load .grd / .hdr files
                  </div>
                </Html>
              )}
            </ViewerScene>
          </div>
        </div>
      )}

      {viewMode === "same-scene" && (
        <div className="viewer-single">
          <div className="viewer-frame">
            <ViewerScene
              projectionMode={projectionMode}
              cameraPosition={sameSceneCameraPosition}
            >
              {visibleLayers.map((layer) => {
                const offsetX = (layer.center.x - globalCenter.x) * WORLD_SCALE;
                const offsetY = (layer.center.y - globalCenter.y) * WORLD_SCALE;

                return (
                  <GeoTiffSurface
                    key={layer.id}
                    url={layer.source}
                    zScale={projectionMode === "2d" ? 0 : zScale}
                    worldScale={WORLD_SCALE}
                    onMetadata={(metadata) => {
                      if (layer.id === selectedLayerId) {
                        setMetadata(metadata);
                      }
                      handleMetadataUpdate(layer.id, metadata);
                    }}
                    onPick={(point) => {
                      setPickedPointsByLayer((prev) => ({
                        ...prev,
                        [layer.id]: point,
                      }));
                    }}
                    layerName={layer.name}
                    position={[offsetX, offsetY, 0]}
                    renderMode={renderMode}
                  />
                );
              })}

              {Object.entries(pickedPointsByLayer).map(([layerId, point]) => (
                <PickMarker key={layerId} pickedPoint={point} />
              ))}
            </ViewerScene>
          </div>
        </div>
      )}

      {viewMode === "review" && (
        <div className="viewer-single">
          <div className="viewer-frame review-placeholder">
            <div className="review-placeholder-card">
              <div>Multiple datasets detected.</div>
              <div style={{ marginTop: 6 }}>
                Choose Same Scene or Split Views.
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === "split-scene" && (
        <div
          className={`viewer-split ${
            visibleCount === 1
              ? "split-count-1"
              : visibleCount === 2
                ? "split-count-2"
                : visibleCount >= 3
                  ? "split-count-many"
                  : ""
          }`}
        >
          {visibleLayers.map((layer) => (
            <div key={layer.id} className="split-pane">
              <div className="split-pane-title">{layer.name}</div>

              <ViewerScene
                projectionMode={projectionMode}
                gizmoMargin={[55, 55]}
                cameraPosition={splitCameraPosition}
              >
                <GeoTiffSurface
                  url={layer.source}
                  zScale={projectionMode === "2d" ? 0 : zScale}
                  worldScale={WORLD_SCALE}
                  onMetadata={(metadata) => {
                    if (layer.id === selectedLayerId) {
                      setMetadata(metadata);
                    }
                    handleMetadataUpdate(layer.id, metadata);
                  }}
                  onPick={(point) => {
                    setPickedPointsByLayer((prev) => ({
                      ...prev,
                      [layer.id]: point,
                    }));
                  }}
                  layerName={layer.name}
                  position={[0, 0, 0]}
                  renderMode={renderMode}
                />

                <PickMarker
                  pickedPoint={pickedPointsByLayer[layer.id] ?? null}
                />
              </ViewerScene>

              {legendByLayer[layer.id] && (
                <div className="split-legend-anchor">
                  <ElevationLegend
                    minZ={legendByLayer[layer.id].minZ}
                    maxZ={legendByLayer[layer.id].maxZ}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {grdLayers.length > 0 && legendByLayer.__grd__ && (
        <div className="legend-anchor">
          <ElevationLegend
            minZ={legendByLayer.__grd__.minZ}
            maxZ={legendByLayer.__grd__.maxZ}
          />
        </div>
      )}

      {grdLayers.length === 0 &&
        viewMode !== "split-scene" &&
        selectedLayerId &&
        legendByLayer[selectedLayerId] && (
          <div className="legend-anchor">
            <ElevationLegend
              minZ={legendByLayer[selectedLayerId].minZ}
              maxZ={legendByLayer[selectedLayerId].maxZ}
            />
          </div>
        )}
    </main>
  );
}