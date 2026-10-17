import { describe, expect, it } from "vitest";
import { fabricPigment, tintFilterId } from "./productColor";

describe("product color processing", () => {
  it("lifts highlights for dark pigments without changing the requested swatch", () => {
    expect(fabricPigment("#171717")).toBe("#323232");
  });

  it("keeps light pigments unchanged", () => {
    expect(fabricPigment("#f5f5f5")).toBe("#f5f5f5");
  });

  it("creates SVG-safe filter ids", () => {
    expect(tintFilterId("#1d2a44")).toBe("product-color-1d2a44");
  });
});
