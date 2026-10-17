import { imageUrl } from "./localData";
import type { Category, Product, SiteContact } from "../types/db";
import {
  getCatalogCategories,
  getCatalogProducts,
  getStoreContact,
} from "./remoteStore";

export async function fetchCategories(): Promise<Category[]> {
  return getCatalogCategories();
}

export async function fetchProducts(
  opts: {
    category?: string;
    search?: string;
    featured?: boolean;
    sort?: "price_asc" | "price_desc" | "new";
  } = {},
): Promise<Product[]> {
  let rows = await getCatalogProducts();
  if (opts.featured) rows = rows.filter((product) => product.is_featured);
  if (opts.category)
    rows = rows.filter((product) => product.category?.slug === opts.category);
  if (opts.search)
    rows = rows.filter((product) =>
      product.name.toLowerCase().includes(opts.search!.toLowerCase()),
    );
  if (opts.sort === "price_asc")
    rows.sort((a, b) => a.base_price_clp - b.base_price_clp);
  else if (opts.sort === "price_desc")
    rows.sort((a, b) => b.base_price_clp - a.base_price_clp);
  return rows;
}

export async function fetchProduct(slug: string): Promise<Product | null> {
  return (
    (await getCatalogProducts()).find((product) => product.slug === slug) ??
    null
  );
}

export async function fetchContact(): Promise<SiteContact> {
  return getStoreContact();
}

export { imageUrl };
