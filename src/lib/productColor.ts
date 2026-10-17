export function tintFilterId(hex: string) {
  return `product-color-${hex.replace(/[^\da-f]/gi, "")}`;
}

export function fabricPigment(hex: string) {
  const match = /^#?([\da-f]{6})$/i.exec(hex);
  const value = match?.[1] ?? "f5f5f5";
  const channels = [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16),
  );
  const luminance =
    (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722) / 255;
  const highlightLift = Math.max(0, 0.3 - luminance) * 0.55;
  const liftedChannels = channels.map((channel) =>
    Math.round(channel * (1 - highlightLift) + 255 * highlightLift),
  );
  return `#${liftedChannels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
