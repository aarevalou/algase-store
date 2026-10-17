import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { fetchProduct, imageUrl } from "../lib/api";
import { formatCLP } from "../lib/format";
import { useCart } from "../context/CartContext";
import { variantPrice, type Product } from "../types/db";
import { fabricPigment, tintFilterId } from "../lib/productColor";
import ProductCustomizer, {
  type ProductColor,
  type ProductDesign,
} from "../components/ProductCustomizer";

const whiteColor: ProductColor = { name: "Blanco", hex: "#f5f5f5" };

export default function ProductDetail() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const { add, open } = useCart();
  const [p, setP] = useState<Product | null | undefined>(undefined);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");
  const [placement, setPlacement] = useState("front");
  const [notes, setNotes] = useState("");
  const [selectedColor, setSelectedColor] = useState<ProductColor>({
    name: "Blanco",
    hex: "#f5f5f5",
  });
  const [transitionFromColor, setTransitionFromColor] =
    useState<ProductColor | null>(null);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [design, setDesign] = useState<ProductDesign | null>(null);

  const selectColor = (color: ProductColor) => {
    if (color.hex.toLowerCase() === selectedColor.hex.toLowerCase()) return;
    setTransitionFromColor(selectedColor);
    setSelectedColor(color);
  };

  useEffect(() => {
    fetchProduct(slug)
      .then((x) => {
        setP(x);
        setVariantId(x?.variants[0]?.id ?? "");
        setSelectedColor(whiteColor);
        setDesign(null);
        setCustom(false);
      })
      .catch(() => setP(null));
  }, [slug]);

  useEffect(() => {
    if (!transitionFromColor) return;
    const timeout = window.setTimeout(() => setTransitionFromColor(null), 380);
    return () => window.clearTimeout(timeout);
  }, [transitionFromColor]);

  useEffect(() => {
    if (!isColorModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsColorModalOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isColorModalOpen]);

  if (p === undefined) return <p>Cargando…</p>;
  if (p === null) return <p>Producto no encontrado.</p>;

  const v = p.variants.find((x) => x.id === variantId);
  const colors = [
    whiteColor,
    ...(p.colors ?? []).filter(
      (color) =>
        color.name.trim().toLowerCase() !== "blanco" &&
        !["#fff", "#ffffff", "#f5f5f5"].includes(color.hex.toLowerCase()),
    ),
  ];
  const visibleColors = colors.slice(0, 4);
  const kind =
    p.category?.slug === "tazas"
      ? "mug"
      : p.category?.slug === "polerones"
        ? "hoodie"
        : "shirt";
  const fee = custom ? Number(p.customization_fee_clp) : 0;
  const unit = v ? variantPrice(p, v) : Number(p.base_price_clp);

  const addToCart = (buyNow = false) => {
    if (!v) return;
    add({
      lineId: custom ? crypto.randomUUID() : undefined,
      variantId: v.id,
      productName: p.name,
      quantity: qty,
      unitPrice: unit,
      fee,
      label: [v.size, selectedColor.name].filter(Boolean).join(" / "),
      customization: custom
        ? {
            placement,
            text: text.slice(0, 300),
            notes: notes.slice(0, 500),
            color: selectedColor.name,
            color_hex: selectedColor.hex,
            design_data_url: design?.image,
            design_x: design?.x,
            design_y: design?.y,
            design_scale: design?.scale,
          }
        : { color: selectedColor.name, color_hex: selectedColor.hex },
    });
    if (buyNow) nav("/checkout");
    else open();
  };

  return (
    <div className="product-detail alg-grid alg-gap-8 alg-md-3a-grid-cols-2">
      <Helmet>
        <title>{p.name} | Algase</title>
        <meta name="description" content={p.description ?? p.name} />
      </Helmet>
      <div className="product-detail__gallery alg-grid alg-gap-2">
        <svg
          className="product-detail__filters"
          aria-hidden="true"
          focusable="false">
          <defs>
            {[selectedColor, transitionFromColor]
              .filter((color): color is ProductColor => color !== null)
              .filter(
                (color, index, colors) =>
                  colors.findIndex(
                    (candidate) => candidate.hex === color.hex,
                  ) === index,
              )
              .map((color) => (
                <filter
                  key={color.hex}
                  id={tintFilterId(color.hex)}
                  colorInterpolationFilters="sRGB">
                  <feFlood
                    floodColor={fabricPigment(color.hex)}
                    result="fabricPigment"
                  />
                  <feComposite
                    in="fabricPigment"
                    in2="SourceAlpha"
                    operator="in"
                    result="maskedPigment"
                  />
                  <feBlend
                    in="SourceGraphic"
                    in2="maskedPigment"
                    mode="multiply"
                  />
                </filter>
              ))}
            <filter
              id="product-fabric-occlusion"
              colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="saturate"
                values="0"
                result="fabricLuminance"
              />
              <feComponentTransfer in="fabricLuminance">
                <feFuncR type="linear" slope="3" intercept="-2" />
                <feFuncG type="linear" slope="3" intercept="-2" />
                <feFuncB type="linear" slope="3" intercept="-2" />
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>
        {!custom && p.images.length ? (
          p.images.map((i) => (
            <div key={i.path} className="product-detail__image">
              <img
                src={imageUrl(i.path)}
                alt={i.alt ?? p.name}
                className="product-detail__image-layer alg-object-cover"
              />
              {transitionFromColor && (
                <img
                  key={`from-${transitionFromColor.hex}`}
                  src={imageUrl(i.path)}
                  alt=""
                  aria-hidden="true"
                  className="product-detail__image-layer product-detail__image-transition-out"
                  style={{
                    filter: `url(#${tintFilterId(transitionFromColor.hex)})`,
                  }}
                />
              )}
              <img
                key={selectedColor.hex}
                src={imageUrl(i.path)}
                alt=""
                aria-hidden="true"
                className={`product-detail__image-layer product-detail__image-tint ${transitionFromColor ? "is-transitioning" : ""}`}
                style={{ filter: `url(#${tintFilterId(selectedColor.hex)})` }}
              />
            </div>
          ))
        ) : !p.images.length ? (
          <img
            src="/images/placeholder-image.png"
            alt={`Imagen no disponible de ${p.name}`}
            className="alg-aspect-square alg-w-full alg-object-cover"
          />
        ) : null}
        {p.customizable && p.images[0] && (
          <ProductCustomizer
            kind={kind}
            imageSrc={imageUrl(p.images[0].path)}
            imageAlt={p.images[0].alt ?? p.name}
            color={selectedColor}
            transitionFromColor={transitionFromColor}
            enabled={custom}
            customizationFee={formatCLP(Number(p.customization_fee_clp))}
            onEnabledChange={(enabled) => {
              setCustom(enabled);
              if (!enabled) setDesign(null);
            }}
            onApply={setDesign}
          />
        )}
      </div>
      <div>
        <h1 className="alg-text-5xl">{p.name}</h1>
        <p className="alg-mt-3-6d742d33 alg-text-3xl alg-font-bold alg-text-brand">
          {formatCLP(unit + fee)}
        </p>
        <p className="alg-mt-4 alg-text-white-2f-80">{p.description}</p>

        <div className="product-size-selector__header">
          <label className="product-size-selector__label" htmlFor="var">
            {kind === "mug" ? "Formato:" : "Talla:"}
          </label>
          {kind !== "mug" && (
            <a
              className="product-color-picker__size-guide"
              href="https://www.jayson.cl/media/b2b/GUIA_DE_EQUIVALENCIA.pdf?srsltid=AU7gw4XQOBdfiJUbNbm0eLAxvqy2bmnNskGGP6Zp-uuOLc5OW5wHO4Tb"
              target="_blank"
              rel="noopener noreferrer">
              Guía de tallas
            </a>
          )}
        </div>
        <select
          id="var"
          className="alg-field"
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}>
          {p.variants.map((x) => (
            <option key={x.id} value={x.id}>
              {[x.size, x.color].filter(Boolean).join(" / ")} ·{" "}
              {formatCLP(variantPrice(p, x))}
            </option>
          ))}
        </select>
        <div className="alg-mt-4">
          <h2 className="alg-text-lg">
            Color:{" "}
            <span className="alg-font-sans alg-text-sm alg-font-normal alg-normal-case alg-text-white-2f-70">
              {selectedColor.name}
            </span>
          </h2>
          <div
            className="product-color-picker__options"
            role="group"
            aria-label="Colores disponibles">
            {visibleColors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => selectColor(color)}
                aria-label={`Elegir color ${color.name}`}
                aria-pressed={selectedColor.name === color.name}
                title={color.name}
                className={`product-customizer__swatch ${selectedColor.name === color.name ? "is-selected" : ""}`}
                style={{ ["--swatch-color" as any]: color.hex }}
              />
            ))}
            <button
              type="button"
              className="product-color-picker__more"
              aria-label="Ver todos los colores"
              aria-haspopup="dialog"
              onClick={() => setIsColorModalOpen(true)}>
              +
            </button>
          </div>
        </div>
        {p.customizable && custom && (
          <fieldset className="alg-mt-6 alg-border alg-border-white-2f-20 alg-p-4">
            <legend className="alg-px-2 alg-font-bold">Diseño</legend>
            <div className="alg-mt-4 alg-grid alg-gap-3">
              {kind !== "mug" && (
                <div>
                  <label className="alg-label" htmlFor="pl">
                    Ubicación
                  </label>
                  <select
                    id="pl"
                    className="alg-field"
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}>
                    <option value="front">Frente</option>
                    <option value="back">Espalda</option>
                    <option value="sleeve">Manga</option>
                  </select>
                </div>
              )}
              <div>
                <label className="alg-label" htmlFor="tx">
                  Texto o frase (opcional)
                </label>
                <input
                  id="tx"
                  className="alg-field"
                  maxLength={300}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="nt">
                  Indicaciones
                </label>
                <textarea
                  id="nt"
                  className="alg-field"
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </fieldset>
        )}

        <div className="alg-mt-6 alg-grid alg-gap-3">
          <div className="alg-flex alg-items-center alg-gap-4">
            <label className="alg-sr-only" htmlFor="qty">
              Cantidad
            </label>
            <input
              id="qty"
              type="number"
              min={1}
              max={50}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Math.min(Number(e.target.value) || 1, 50)))
              }
              className="alg-field alg-w-24"
            />
            <button
              className="alg-btn-primary alg-flex-1"
              disabled={!v}
              onClick={() => addToCart()}>
              Agregar al carrito
            </button>
          </div>
          <button
            className="alg-btn-ghost alg-w-full"
            disabled={!v}
            onClick={() => addToCart(true)}>
            Comprar ahora
          </button>
        </div>
      </div>
      {isColorModalOpen && (
        <div className="color-modal" role="presentation">
          <button
            type="button"
            className="color-modal__backdrop"
            aria-label="Cerrar lista de colores"
            onClick={() => setIsColorModalOpen(false)}
          />
          <section
            className="color-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="color-modal-title">
            <div className="color-modal__header">
              <div>
                <h2 id="color-modal-title" className="color-modal__title">
                  Colores disponibles
                </h2>
                <p className="color-modal__selected">
                  Seleccionado: {selectedColor.name}
                </p>
              </div>
              <button
                type="button"
                className="color-modal__close"
                aria-label="Cerrar"
                onClick={() => setIsColorModalOpen(false)}>
                ×
              </button>
            </div>
            <div
              className="color-modal__list"
              role="group"
              aria-label="Seleccionar color">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className={`color-modal__option ${selectedColor.name === color.name ? "is-selected" : ""}`}
                  aria-pressed={selectedColor.name === color.name}
                  onClick={() => {
                    selectColor(color);
                    setIsColorModalOpen(false);
                  }}>
                  <span
                    className="product-customizer__swatch"
                    style={{ ["--swatch-color" as any]: color.hex }}
                    aria-hidden="true"
                  />
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
