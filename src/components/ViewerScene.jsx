import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Stats,
} from "@react-three/drei";
import SceneLights from "./SceneLights";

function ZUpCameraSetup({ cameraPosition, projectionMode, controlsRef }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(
      cameraPosition[0],
      cameraPosition[1],
      cameraPosition[2]
    );

    // 永遠維持測量 / 地理資料的 Z-up 世界
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    // 很重要：切換 2D / 3D 時重設 controls 狀態
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, cameraPosition, projectionMode, controlsRef]);

  return null;
}

export default function ViewerScene({
  children,
  showStats = true,
  gizmoMargin = [70, 70],
  cameraPosition = [0, -7, 5],
  projectionMode = "3d",
}) {
  const controlsRef = useRef(null);

  return (
    <Canvas
      camera={{
        position: cameraPosition,
        fov: 45,
        near: 0.01,
        far: 3000,
      }}
    >
      <color attach="background" args={["#0b0f14"]} />

      <ZUpCameraSetup
        cameraPosition={cameraPosition}
        projectionMode={projectionMode}
        controlsRef={controlsRef}
      />

      <SceneLights />

      {children}

      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        sectionSize={5}
        sectionThickness={1}
        fadeDistance={80}
        fadeStrength={1}
        infiniteGrid
        rotation={[Math.PI / 2, 0, 0]}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={projectionMode === "2d" ? 0 : 0.8}
        zoomSpeed={0.9}
        panSpeed={0.9}
        screenSpacePanning={projectionMode === "2d"}
        enableRotate={projectionMode !== "2d"}
        minDistance={0.5}
        maxDistance={400}
        minPolarAngle={projectionMode === "2d" ? 0 : 0}
        maxPolarAngle={projectionMode === "2d" ? 0 : Math.PI}
        zoomToCursor
      />

      {projectionMode !== "2d" ? <axesHelper args={[6]} /> : null}

      {projectionMode !== "2d" ? (
        <GizmoHelper alignment="bottom-right" margin={gizmoMargin}>
          <GizmoViewport
            axisColors={["#ff4d4f", "#52c41a", "#40a9ff"]}
            labelColor="white"
          />
        </GizmoHelper>
      ) : null}

      {showStats ? <Stats className="r3f-stats-top-right" /> : null}
    </Canvas>
  );
}