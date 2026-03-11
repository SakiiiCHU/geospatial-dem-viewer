function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function checkLayerCompatibility(layers) {
  if (!layers.length) {
    return { mode: "empty", messages: [], groups: [] };
  }

  if (layers.length === 1) {
    return {
      mode: "same-scene",
      messages: [],
      groups: [{ id: "group-1", layerIds: [layers[0].id] }],
    };
  }

  const first = layers[0];

  let sameCrs = true;
  let centersReasonablyClose = true;

  for (let i = 1; i < layers.length; i++) {
    const layer = layers[i];

    if (normalize(layer.crs) !== normalize(first.crs)) {
      sameCrs = false;
    }

    if (distance(layer.center, first.center) > 1000) {
      centersReasonablyClose = false;
    }
  }

  if (!sameCrs) {
    return {
      mode: "split-scene",
      messages: [
        {
          level: "error",
          text: "Different CRS detected. Layers should not be rendered in the same scene.",
        },
      ],
      groups: layers.map((l) => ({
        id: `group-${l.id}`,
        layerIds: [l.id],
      })),
    };
  }

  if (!centersReasonablyClose) {
    return {
      mode: "review",
      messages: [
        {
          level: "warning",
          text: "Layers are far apart. Split view may be easier.",
        },
      ],
      details: {
        sameCrs: true,
        centersReasonablyClose: false,
      },
      groups: [{ id: "group-1", layerIds: layers.map((l) => l.id) }],
    };
  }

  return {
    mode: "same-scene",
    messages: [],
    details: {
      sameCrs: true,
      centersReasonablyClose: true,
    },
    groups: [{ id: "group-1", layerIds: layers.map((l) => l.id) }],
  };
}