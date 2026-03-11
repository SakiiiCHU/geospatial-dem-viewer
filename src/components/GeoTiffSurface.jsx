import { useEffect, useMemo, useState, useCallback } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { loadGeoTiffAsSurface } from "../lib/geotiffLoader";

/*
  Create reduced point cloud from mesh geometry
  step = sampling stride
*/
function createPointGeometry(originalGeometry, step = 4) {
  const pos = originalGeometry.attributes.position.array;
  const col = originalGeometry.attributes.color?.array;

  const points = [];
  const colors = [];

  for (let i = 0; i < pos.length; i += 3 * step) {
    points.push(pos[i], pos[i + 1], pos[i + 2]);

    if (col) {
      colors.push(col[i], col[i + 1], col[i + 2]);
    }
  }

  const g = new THREE.BufferGeometry();

  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

  if (colors.length) {
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }

  return g;
}

export default function GeoTiffSurface({
  url,
  zScale,
  position = [0, 0, 0],
  worldScale = 1,
  layerName = "",
  onMetadata,
  onPick,
  renderMode = "surface",
}) {
  const [state, setState] = useState({
    geometry: null,
    metadata: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let oldGeometry = null;

    async function run() {
      try {
        setState((prev) => {
          oldGeometry = prev.geometry;
          return {
            geometry: null,
            metadata: null,
            loading: true,
            error: null,
          };
        });

        if (oldGeometry) oldGeometry.dispose();

        const result = await loadGeoTiffAsSurface(url, zScale);

        if (cancelled) {
          result.geometry.dispose();
          return;
        }

        setState({
          geometry: result.geometry,
          metadata: result.metadata,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            geometry: null,
            metadata: null,
            loading: false,
            error: error.message || "Failed to load GeoTIFF",
          });
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [url, zScale]);

  useEffect(() => {
    if (!state.metadata) return;
    onMetadata?.(state.metadata);
  }, [state.metadata, onMetadata]);

  useEffect(() => {
    return () => {
      if (state.geometry) state.geometry.dispose();
    };
  }, [state.geometry]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      metalness: 0.05,
      roughness: 0.85,
    });
  }, []);

  const pointMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.009, //點雲尺寸
      vertexColors: true,
      sizeAttenuation: true,
      depthWrite: false,
    });
  }, []);

  /*
    ⭐ create reduced point cloud
    only when geometry changes
  */
  const pointGeometry = useMemo(() => {
    if (!state.geometry) return null;

    // step = sampling stride
    return createPointGeometry(state.geometry, 1); //降採樣比例
  }, [state.geometry]);

  const handlePointerDown = useCallback(
    (event) => {
      if (!state.metadata) return;

      event.stopPropagation();

      const { point } = event;

      const safeZScale = zScale === 0 ? 1 : zScale;

      const localX = (point.x - position[0]) / worldScale;
      const localY = (point.y - position[1]) / worldScale;
      const localZ = point.z / (worldScale * safeZScale);

      const realX = state.metadata.center.x + localX;
      const realY = state.metadata.center.y + localY;
      const realZ = localZ;

      onPick?.({
        layerName,
        url,
        x: realX,
        y: realY,
        z: realZ,
        renderPoint: {
          x: point.x,
          y: point.y,
          z: point.z,
        },
      });
    },
    [state.metadata, position, worldScale, zScale, onPick, layerName, url],
  );

  if (state.loading) {
    return (
      <Html center>
        <div className="canvas-loading">Loading GeoTIFF...</div>
      </Html>
    );
  }

  if (state.error) {
    return (
      <Html center>
        <div className="canvas-error">{state.error}</div>
      </Html>
    );
  }

  if (!state.geometry) return null;

  /*
    POINT CLOUD MODE
  */
  if (renderMode === "points") {
    return (
      <points
        geometry={pointGeometry}
        material={pointMaterial}
        position={position}
        scale={[worldScale, worldScale, worldScale]}
        // onPointerDown={handlePointerDown} 導致點雲跑得很檔的元兇～
      />
    );
  }

  /*
    SURFACE MODE (original DEM)
  */
  return (
    <mesh
      geometry={state.geometry}
      material={material}
      position={position}
      scale={[worldScale, worldScale, worldScale]}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "crosshair";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
      onPointerDown={handlePointerDown}
    />
  );
}
