// src/components/GrdPointCloud.jsx

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { loadAsciiGrd } from "../lib/grdLoader";

export default function GrdPointCloud({
  file,
  worldScale = 1,
  zScale = 1,
  pointSize = 2,
  sharedCenter = null,
  onMetadata,
  onPick,
  layerName = "GRD Layer",
  position = [0, 0, 0],
}) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    positions: null,
    metadata: null,
  });

  // 1) 只在真正影響資料的參數改變時重新載入
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!file) {
        setState({
          loading: false,
          error: null,
          positions: null,
          metadata: null,
        });
        return;
      }

      setState({
        loading: true,
        error: null,
        positions: null,
        metadata: null,
      });

      try {
        const result = await loadAsciiGrd(file, {
          worldScale,
          zScale,
          sharedCenter,
        });

        if (cancelled) return;

        setState({
          loading: false,
          error: null,
          positions: result.positions,
          metadata: result.metadata,
        });
      } catch (error) {
        if (cancelled) return;

        setState({
          loading: false,
          error:
            error instanceof Error ? error.message : "Unknown GRD load error",
          positions: null,
          metadata: null,
        });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [file, worldScale, zScale, sharedCenter]);

  // 2) metadata 另外通知父層，避免因 onMetadata 變動重新載入
  useEffect(() => {
    if (!state.metadata) return;
    onMetadata?.(state.metadata);
  }, [state.metadata, onMetadata]);

  const geometry = useMemo(() => {
    if (!state.positions) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(state.positions, 3));

    const count = state.positions.length / 3;
    const colors = new Float32Array(count * 3);

    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 2; i < state.positions.length; i += 3) {
      const z = state.positions[i];
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const range = maxZ - minZ || 1;

    for (let i = 0; i < count; i++) {
      const z = state.positions[i * 3 + 2];
      const t = (z - minZ) / range;
      const color = new THREE.Color();

      // 較穩定的 DEM 高程色帶
      if (t < 0.2) {
        color.setRGB(0, 0.3, 0.8); // deep blue
      } else if (t < 0.4) {
        color.setRGB(0.1, 0.7, 0.4); // green
      } else if (t < 0.6) {
        color.setRGB(0.85, 0.85, 0.25); // yellow
      } else if (t < 0.8) {
        color.setRGB(0.65, 0.42, 0.22); // brown
      } else {
        color.setRGB(0.95, 0.95, 0.95); // snow
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();

    return geo;
  }, [state.positions]);

  useEffect(() => {
    return () => {
      if (geometry) {
        geometry.dispose();
      }
    };
  }, [geometry]);

  if (state.error) {
    console.error("[GrdPointCloud]", state.error);
    return null;
  }

  if (!geometry) return null;

  return (
    <points
      position={position}
      onPointerDown={(event) => {
        if (!state.metadata) return;

        event.stopPropagation();

        const { point } = event;

        const localX = (point.x - position[0]) / worldScale;
        const localY = (point.y - position[1]) / worldScale;
        const localZ = point.z / (worldScale * zScale);

        const realX = state.metadata.center.x + localX;
        const realY = state.metadata.center.y + localY;
        const realZ = state.metadata.center.z + localZ;

        onPick?.({
          layerName,
          x: realX,
          y: realY,
          z: realZ,
          renderPoint: {
            x: point.x,
            y: point.y,
            z: point.z,
          },
          metadata: state.metadata,
        });
      }}
    >
      <primitive object={geometry} attach="geometry" />
      <pointsMaterial size={pointSize} sizeAttenuation vertexColors />
    </points>
  );
}