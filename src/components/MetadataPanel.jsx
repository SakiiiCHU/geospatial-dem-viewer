function formatNumber(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

export default function MetadataPanel({ metadata, selectedLabel }) {
  return (
    <div className="metadata-panel">
      <h2>Metadata</h2>

      {!metadata ? (
        <p>Loading metadata...</p>
      ) : (
        <div className="meta-list">
          <div><strong>File:</strong> {selectedLabel}</div>
          <div><strong>Width × Height:</strong> {metadata.width} × {metadata.height}</div>
          <div><strong>Band Count:</strong> {metadata.bandCount}</div>
          <div><strong>Dtype:</strong> {metadata.dtype}</div>
          <div><strong>CRS:</strong> {metadata.crs}</div>
          <div><strong>NoData:</strong> {metadata.noData}</div>
          <div><strong>Pixel Size:</strong> {metadata.pixelSizeX} m × {metadata.pixelSizeY} m</div>
          <div><strong>Min:</strong> {formatNumber(metadata.min, 6)}</div>
          <div><strong>Max:</strong> {formatNumber(metadata.max, 6)}</div>
          <div><strong>Mean:</strong> {formatNumber(metadata.mean, 6)}</div>
          <div><strong>Bounds Left:</strong> {formatNumber(metadata.bounds.left, 2)}</div>
          <div><strong>Bounds Right:</strong> {formatNumber(metadata.bounds.right, 2)}</div>
          <div><strong>Bounds Bottom:</strong> {formatNumber(metadata.bounds.bottom, 2)}</div>
          <div><strong>Bounds Top:</strong> {formatNumber(metadata.bounds.top, 2)}</div>
        </div>
      )}
    </div>
  );
}
