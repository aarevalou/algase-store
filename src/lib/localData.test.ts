import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteLocalCategory,
  getLocalCategories,
  getLocalProducts,
  imageUrl,
  saveLocalProducts,
} from "./localData";
import type { Product } from "../types/db";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
}

describe("local catalog", () => {
  beforeEach(() => vi.stubGlobal("localStorage", createStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("initializes categories and the full starter catalog locally", () => {
    expect(getLocalCategories().map((category) => category.slug)).toEqual([
      "poleras",
      "polerones",
      "tazas",
    ]);
    expect(getLocalProducts()).toHaveLength(8);
  });

  it("keeps saved product edits and fills missing starter products on migration", () => {
    const products = getLocalProducts();
    const edited: Product = {
      ...products[0],
      name: "Nombre editado localmente",
    };
    saveLocalProducts([edited]);

    const migrated = getLocalProducts();
    expect(migrated.find((product) => product.id === edited.id)?.name).toBe(
      "Nombre editado localmente",
    );
    expect(migrated).toHaveLength(8);
  });

  it("reports whether products were saved and preserves uploaded image URLs", () => {
    const products = getLocalProducts();
    expect(saveLocalProducts(products)).toBe(true);
    expect(imageUrl("data:image/webp;base64,abc")).toBe(
      "data:image/webp;base64,abc",
    );
    expect(imageUrl("https://cdn.example.com/product.webp")).toBe(
      "https://cdn.example.com/product.webp",
    );
    expect(imageUrl("product.webp")).toBe("/images/product.webp");
  });

  it("deletes a category and its products without restoring starter data", () => {
    expect(deleteLocalCategory("polerones")).toBe(true);

    expect(
      getLocalCategories().some((category) => category.slug === "polerones"),
    ).toBe(false);
    expect(
      getLocalProducts().some(
        (product) => product.category?.slug === "polerones",
      ),
    ).toBe(false);
  });

  it("replaces saved blue and warm red/yellow swatches with graphite and pink", () => {
    const products = getLocalProducts();
    const edited: Product = {
      ...products[0],
      colors: [
        { name: "Azul marino", hex: "#1d2a44" },
        { name: "Amarillo", hex: "#f0be8c" },
        { name: "Rojo", hex: "#b82932" },
      ],
    };
    saveLocalProducts([edited]);

    const colors = getLocalProducts().find(
      (product) => product.id === edited.id,
    )?.colors;
    expect(colors).toEqual([
      { name: "Gris grafito", hex: "#414141" },
      { name: "Rosado", hex: "#e6007e" },
      { name: "Rosado", hex: "#e6007e" },
    ]);
  });
});
