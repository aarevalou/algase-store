import { Link } from "react-router-dom";
import { formatCLP } from "../lib/format";
import { imageUrl } from "../lib/api";
import type { Product } from "../types/db";

export default function ProductCard({ product }: { product: Product }) {
  const img = [...product.images].sort(
    (a, b) => a.sort_order - b.sort_order,
  )[0];
  const catalogImage = product.catalog_image_path ?? img?.path;
  const price = product.variants.length
    ? Math.min(
        ...product.variants.map((variant) =>
          Number(variant.price_clp ?? product.base_price_clp),
        ),
      )
    : Number(product.base_price_clp);
  return (
    <Link to={`/producto/${product.slug}`} className="product-card">
      <div className="product-card__media">
        <img
          src={
            catalogImage
              ? imageUrl(catalogImage)
              : "/images/placeholder-image.png"
          }
          alt={product.name}
          loading="lazy"
          className="product-card__image"
        />
      </div>
      <div className="product-card__body">
        <h3 className="product-card__title">{product.name}</h3>
        <p className="product-card__price">Desde {formatCLP(price)}</p>
        <p className="product-card__meta">
          {product.category?.slug === "tazas"
            ? "Taza personalizable"
            : "Prenda personalizable"}
        </p>
      </div>
    </Link>
  );
}
