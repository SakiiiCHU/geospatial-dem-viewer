export default function CompatibilityModal({
  compatibility,
  showCompatibilityModal,
  handleChooseSameScene,
  handleChooseSplitScene,
}) {
  if (!showCompatibilityModal || !compatibility) return null;

  return (
    <div className="compatibility-modal-overlay">
      <div className="compatibility-modal">

        <h2>Dataset Compatibility Review</h2>

        <p>
          Multiple GeoTIFF datasets were detected.
          Please choose how you want to visualize them.
        </p>

        <div className="compatibility-actions">

          <button
            className="decision-btn"
            onClick={handleChooseSameScene}
          >
            Render in Same Scene
          </button>

          <button
            className="decision-btn"
            onClick={handleChooseSplitScene}
          >
            Open as Split Views
          </button>

        </div>

      </div>
    </div>
  );
}