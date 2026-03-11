import { Html } from "@react-three/drei";

export default function PickMarker({ pickedPoint }) {
  if (!pickedPoint) return null;

  const labelX = pickedPoint.x.toFixed(3);
  const labelY = pickedPoint.y.toFixed(3);
  const labelZ = pickedPoint.z.toFixed(3);

  return (
    <group
      position={[
        pickedPoint.renderPoint.x,
        pickedPoint.renderPoint.y,
        pickedPoint.renderPoint.z,
      ]}
    >
      <Html
        position={[0, 0, 0]}
        center
        transform={false}
        style={{ pointerEvents: "none", overflow: "visible" }}
      >
        <div className="pick-ui-root">
          <div className="pick-ui-cross" />
          <div className="pick-ui-dot" />
          <div className="pick-ui-line" />
          <div className="pick-ui-label">
            <div>X: {labelX}</div>
            <div>Y: {labelY}</div>
            <div>Z: {labelZ}</div>
          </div>
        </div>
      </Html>
    </group>
  );
}