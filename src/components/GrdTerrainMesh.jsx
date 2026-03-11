// src/components/GrdTerrainMesh.jsx

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { loadAsciiGrd } from "../lib/grdLoader";


function buildGridMeshFromPositions(positions) {
  const count = positions.length / 3;
  if (count < 4) {
    throw new Error("Not enough points to build terrain mesh.");
  }

  const xSet = new Set();
  const ySet = new Set();

  for (let i = 0; i < positions.length; i += 3) {
    xSet.add(positions[i]);
    ySet.add(positions[i + 1]);
  }

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => b - a);

  const ncols = xs.length;
  const nrows = ys.length;

  if (ncols < 2 || nrows < 2) {
    throw new Error("Grid dimensions are too small to build terrain mesh.");
  }

  const xIndexMap = new Map(xs.map((x, i) => [x, i]));
  const yIndexMap = new Map(ys.map((y, i) => [y, i]));

  const vertexCount = ncols * nrows;
  const gridPositions = new Float32Array(vertexCount * 3);
  const gridColors = new Float32Array(vertexCount * 3);
  const filled = new Uint8Array(vertexCount);

  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 2; i < positions.length; i += 3) {
    const z = positions[i];
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const zRange = maxZ - minZ || 1;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    const col = xIndexMap.get(x);
    const row = yIndexMap.get(y);

    if (col == null || row == null) continue;

    const idx = row * ncols + col;
    const base = idx * 3;

    gridPositions[base] = x;
    gridPositions[base + 1] = y;
    gridPositions[base + 2] = z;

    const t = (z - minZ) / zRange;
    const color = new THREE.Color();

    if (t < 0.2) {
      color.setRGB(0.0, 0.35, 0.95); // blue
    } else if (t < 0.45) {
      color.setRGB(0.1, 0.75, 0.35); // green
    } else if (t < 0.7) {
      color.setRGB(0.85, 0.75, 0.2); // yellow
    } else {
      color.setRGB(0.75, 0.35, 0.15); // brown-red
    }

    gridColors[base] = color.r;
    gridColors[base + 1] = color.g;
    gridColors[base + 2] = color.b;

    filled[idx] = 1;
  }

  const indices = [];

  for (let row = 0; row < nrows - 1; row += 1) {
    for (let col = 0; col < ncols - 1; col += 1) {
      const a = row * ncols + col;
      const b = a + 1;
      const c = a + ncols;
      const d = c + 1;

      if (!filled[a] || !filled[b] || !filled[c] || !filled[d]) {
        continue;
      }

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  if (indices.length === 0) {
    throw new Error("No valid terrain triangles could be built from this GRD.");
  }

  return {
    gridPositions,
    gridColors,
    indices,
    ncols,
    nrows,
    minZ,
    maxZ,
  };
}

export default function GrdTerrainMesh({
  file,
  worldScale = 1,
  zScale = 1,
  sharedCenter = null,
  onMetadata,
  onPick,
  layerName = "GRD Terrain",
  position = [0, 0, 0],
}) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    positions: null,
    metadata: null,
  });

  // 1) 載入 effect：只依賴真正會影響資料的參數
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
            error instanceof Error
              ? error.message
              : "Unknown GRD terrain load error",
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

  // 2) metadata callback 分離，避免 onMetadata 造成重新載入
  useEffect(() => {
    if (!state.metadata) return;
    onMetadata?.(state.metadata);
  }, [state.metadata, onMetadata]);

  const geometry = useMemo(() => {
    if (!state.positions) return null;

    const { gridPositions, gridColors, indices } = buildGridMeshFromPositions(
      state.positions
    );

    const geo = new THREE.BufferGeometry();

    geo.setAttribute("position", new THREE.BufferAttribute(gridPositions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(gridColors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    return geo;
  }, [state.positions]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  if (state.error) {
    console.error("[GrdTerrainMesh]", state.error);
    return null;
  }

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
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
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.9}
        metalness={0.05}
      />
    </mesh>
  );
}