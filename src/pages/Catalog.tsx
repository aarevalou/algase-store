import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ProductCard from "../components/ProductCard";
import { fetchCategories, fetchProducts } from "../lib/api";
import type { Category, Product } from "../types/db";

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const category = params.get("categoria") ?? "";
  const search = params.get("q") ?? "";
  const sort = (params.get("orden") ?? "new") as
    | "new"
    | "price_asc"
    | "price_desc";

  useEffect(() => {
    fetchCategories()
      .then(setCats)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    setLoading(true);
    fetchProducts({
      category: category || undefined,
      search: search || undefined,
      sort,
    })
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [category, search, sort]);

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    v ? n.set(k, v) : n.delete(k);
    setParams(n);
  };
  const filters = (prefix: string) => (
    <>
      <div>
        <label className="alg-label" htmlFor={`${prefix}-q`}>
          Buscar
        </label>
        <input
          id={`${prefix}-q`}
          className="alg-field"
          value={search}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Polera, taza…"
        />
      </div>
      <div>
        <h2 className="alg-mb-2 alg-mt-6 alg-text-base">Categorías</h2>
        <div
          className="alg-grid alg-gap-1"
          role="group"
          aria-label="Filtrar por categoría">
          <button
            type="button"
            aria-pressed={!category}
            onClick={() => set("categoria", "")}
            className={`alg-px-2 alg-py-2 alg-text-left alg-text-sm alg-font-bold alg-uppercase alg-transition-colors alg-hover-3a-text-brand ${!category ? "alg-text-brand" : "alg-text-white-2f-75"}`}>
            Todas
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.slug}
              onClick={() => set("categoria", c.slug)}
              className={`alg-px-2 alg-py-2 alg-text-left alg-text-sm alg-font-bold alg-uppercase alg-transition-colors alg-hover-3a-text-brand ${category === c.slug ? "alg-text-brand" : "alg-text-white-2f-75"}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="alg-mt-6">
        <label className="alg-label" htmlFor={`${prefix}-ord`}>
          Ordenar por
        </label>
        <select
          id={`${prefix}-ord`}
          className="alg-field"
          value={sort}
          onChange={(e) => set("orden", e.target.value)}>
          <option value="new">Más nuevos</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
        </select>
      </div>
      {(search || category || sort !== "new") && (
        <button
          type="button"
          className="alg-mt-4 alg-px-2 alg-py-2 alg-text-sm alg-underline alg-underline-offset-4 alg-hover-3a-text-brand"
          onClick={() => setParams({})}>
          Limpiar filtros
        </button>
      )}
    </>
  );

  return (
    <>
      <Helmet>
        <title>Catálogo | Algase</title>
      </Helmet>
      <div className="alg-mb-6 alg-border-b alg-border-white-2f-15 alg-pb-5">
        <h1 className="alg-text-5xl">Catálogo</h1>
        <p className="alg-mt-3-6d742d33 alg-max-w-2xl alg-text-white-2f-70">
          Artículos listos para llevar tu diseño, elige una opción para ver en
          detalle.
        </p>
      </div>
      <details className="alg-mb-6 alg-border-y alg-border-white-2f-15 alg-py-3 alg-lg-3a-hidden">
        <summary className="alg-cursor-pointer alg-font-bold alg-uppercase">
          Filtrar productos
        </summary>
        <div className="alg-grid alg-gap-2 alg-pt-4">{filters("mobile")}</div>
      </details>
      <div className="alg-grid alg-gap-8 alg-lg-3a-grid-cols--5b-220px_minmax-28-0-2c-1fr-29-5d">
        <aside className="alg-hidden alg-border-r alg-border-white-2f-10 alg-pr-6 alg-lg-3a-block">
          <div className="alg-sticky alg-top-28">
            <h2 className="alg-mb-5 alg-text-2xl">Filtrar</h2>
            {filters("desktop")}
          </div>
        </aside>
        <section aria-label="Productos del catálogo">
          {loading ? (
            <p role="status">Cargando productos…</p>
          ) : products.length === 0 ? (
            <div className="alg-border-y alg-border-white-2f-15 alg-py-8">
              <p>
                {search || category
                  ? "No encontramos productos con esos filtros."
                  : "Aún no hay productos disponibles."}
              </p>
              {(search || category) && (
                <button
                  className="alg-mt-4 alg-underline alg-underline-offset-4"
                  onClick={() => setParams({})}>
                  Quitar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="alg-mb-4 alg-flex alg-min-h-10 alg-items-center alg-justify-between alg-border-b alg-border-white-2f-10 alg-pb-3">
                <p className="alg-text-sm alg-text-white-2f-65">
                  {products.length}{" "}
                  {products.length === 1 ? "producto" : "productos"}
                </p>
                {category && (
                  <p className="alg-text-sm alg-font-bold alg-uppercase alg-text-brand">
                    {cats.find((c) => c.slug === category)?.name}
                  </p>
                )}
              </div>
              <div className="alg-grid alg-grid-cols-2 alg-gap-4 alg-xl-3a-grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
