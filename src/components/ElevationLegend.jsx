export default function ElevationLegend({ minZ = 0, maxZ = 800 }) {
  const steps = 5;
  const values = [];

  for (let i = 0; i <= steps; i += 1) {
    const v = minZ + (maxZ - minZ) * (i / steps);
    values.push(Math.round(v));
  }

  const reversed = values.slice().reverse();
  const barHeight = 150;

  return (
    <div
      style={{
        padding: "10px 0px 20px 10px",
        background: "rgba(8, 12, 18, 0.62)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        color: "white",
        fontSize: 11,
        width: 92,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          marginBottom: 8,
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: "0.01em",
          opacity: 0.92,
        }}
      >
        Elevation
      </div>

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "16px 1fr",
          columnGap: 8,
          height: barHeight,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            width: 10,
            height: "100%",
            background:
              "linear-gradient(to top, #1d4fff 0%, #00a651 30%, #e6f000 58%, #b87a3c 80%, #f2f2f2 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            height: "100%",
          }}
        >
          {reversed.map((v, i) => {
            const top = (i / steps) * barHeight;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top,
                  left: 0,
                  transform: "translateY(-50%)",
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                  fontSize: 10,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.92)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {v} m
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}