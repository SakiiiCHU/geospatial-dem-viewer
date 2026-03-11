export default function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[80, 120, 100]} intensity={1.2} />
      <directionalLight position={[-50, -30, 60]} intensity={0.5} />
    </>
  );
}