import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { tintFilterId } from "../lib/productColor";

export interface ProductColor {
  name: string;
  hex: string;
}

export interface ProductDesign {
  image: string;
  color: ProductColor;
  x: number;
  y: number;
  scale: number;
}

interface ProductCustomizerProps {
  kind: "shirt" | "hoodie" | "mug";
  imageSrc: string;
  imageAlt: string;
  color: ProductColor;
  transitionFromColor: ProductColor | null;
  enabled: boolean;
  customizationFee: string;
  onEnabledChange: (enabled: boolean) => void;
  onApply: (design: ProductDesign | null) => void;
}

export default function ProductCustomizer({
  kind,
  imageSrc,
  imageAlt,
  color,
  transitionFromColor,
  enabled,
  customizationFee,
  onEnabledChange,
  onApply,
}: ProductCustomizerProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState("");
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const [imageError, setImageError] = useState("");
  const [position, setPosition] = useState({ x: 50, y: 43 });
  const [scale, setScale] = useState(22);
  const [dragging, setDragging] = useState(false);

  const commitDesign = (
    nextImage: string,
    nextPosition = position,
    nextScale = scale,
  ) => {
    setImage(nextImage);
    onApply(
      nextImage
        ? {
            image: nextImage,
            color,
            x: nextPosition.x,
            y: nextPosition.y,
            scale: nextScale,
          }
        : null,
    );
  };

  const upload = (file?: File) => {
    setImageError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setImageError("La imagen debe pesar menos de 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setImageError("No pudimos procesar la imagen.");
        return;
      }
      const source = new Image();
      source.onload = () => {
        const ratio = Math.min(
          1,
          1000 / Math.max(source.naturalWidth, source.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(source.naturalWidth * ratio);
        canvas.height = Math.round(source.naturalHeight * ratio);
        const context = canvas.getContext("2d");
        if (!context) {
          setImageError("Tu navegador no pudo preparar la imagen.");
          return;
        }
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/webp", 0.82);
        if (compressed.length > 700_000) {
          setImageError(
            "La imagen sigue siendo muy pesada. Prueba con una versión más pequeña.",
          );
          return;
        }
        setImageAspectRatio(canvas.height / canvas.width);
        commitDesign(compressed);
        onEnabledChange(true);
      };
      source.onerror = () =>
        setImageError("El archivo no es una imagen válida.");
      source.src = reader.result;
    };
    reader.onerror = () => setImageError("No pudimos leer la imagen.");
    reader.readAsDataURL(file);
  };

  const updatePosition = (nextPosition: { x: number; y: number }) => {
    setPosition(nextPosition);
    if (image) commitDesign(image, nextPosition);
  };

  const moveToPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !previewRef.current) return;
    const bounds = previewRef.current.getBoundingClientRect();
    updatePosition({
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100),
      ),
    });
  };

  const nudge = (event: ReactKeyboardEvent<HTMLImageElement>) => {
    const step = event.shiftKey ? 5 : 1;
    const offsets = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    } as const;
    const offset = offsets[event.key as keyof typeof offsets];
    if (!offset) return;
    event.preventDefault();
    updatePosition({
      x: Math.max(0, Math.min(100, position.x + offset[0])),
      y: Math.max(0, Math.min(100, position.y + offset[1])),
    });
  };

  const updateScale = (nextScale: number) => {
    setScale(nextScale);
    if (image) commitDesign(image, position, nextScale);
  };

  const transitionStyle = transitionFromColor ? "is-transitioning" : "";
  const artworkWidth = Math.min(scale, 90 / imageAspectRatio);
  const artworkHeight = artworkWidth * imageAspectRatio;
  const backgroundPosition = (center: number, size: number) =>
    `${((center - size / 2) / (100 - size)) * 100}%`;

  return (
    <section
      className="product-customizer"
      aria-label="Personalización del producto">
      <input
        ref={fileInputRef}
        id="design-file"
        type="file"
        accept="image/*"
        className="product-customizer__file-input"
        aria-label="Elegir imagen o logotipo"
        onChange={(event) => {
          upload(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {enabled ? (
        <>
          <div
            ref={previewRef}
            className="product-customizer__stage"
            onPointerMove={moveToPointer}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            aria-label="Vista del producto; arrastra el estampado para cambiar su posición">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="product-customizer__product"
            />
            {transitionFromColor && (
              <img
                key={`from-${transitionFromColor.hex}`}
                src={imageSrc}
                alt=""
                aria-hidden="true"
                className="product-customizer__product product-customizer__transition-out"
                style={{
                  filter: `url(#${tintFilterId(transitionFromColor.hex)})`,
                }}
              />
            )}
            <img
              key={color.hex}
              src={imageSrc}
              alt=""
              aria-hidden="true"
              className={`product-customizer__product product-customizer__product-tint ${transitionStyle}`}
              style={{ filter: `url(#${tintFilterId(color.hex)})` }}
            />
            {image && (
              <div
                className="product-customizer__art-mask"
                style={{
                  maskImage: `url("${imageSrc}")`,
                  WebkitMaskImage: `url("${imageSrc}")`,
                }}>
                <div
                  className="product-customizer__artwork-frame"
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${artworkWidth}%`,
                    aspectRatio: `${1 / imageAspectRatio}`,
                  }}>
                  <img
                    src={image}
                    alt="Diseño cargado, arrastrable"
                    draggable={false}
                    tabIndex={0}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDragging(true);
                    }}
                    onKeyDown={nudge}
                    className="product-customizer__artwork"
                  />
                  <div
                    className="product-customizer__fabric-occlusion"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url("${imageSrc}")`,
                      backgroundSize: `${10000 / artworkWidth}% ${10000 / artworkHeight}%`,
                      backgroundPosition: `${backgroundPosition(position.x, artworkWidth)} ${backgroundPosition(position.y, artworkHeight)}`,
                      maskImage: `url("${image}")`,
                      WebkitMaskImage: `url("${image}")`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="product-customizer__controls">
            {image && (
              <div className="product-customizer__adjustments">
                <label className="product-customizer__adjustment product-customizer__adjustment--scale">
                  <span>Tamaño</span>
                  <output htmlFor="design-scale">{scale}%</output>
                  <input
                    id="design-scale"
                    type="range"
                    min="8"
                    max="48"
                    value={scale}
                    onChange={(event) =>
                      updateScale(Number(event.target.value))
                    }
                    aria-label="Tamaño del estampado"
                  />
                </label>
                <label className="product-customizer__adjustment">
                  <span>Horizontal</span>
                  <output>{Math.round(position.x)}%</output>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(position.x)}
                    onChange={(event) =>
                      updatePosition({
                        ...position,
                        x: Number(event.target.value),
                      })
                    }
                    aria-label="Posición horizontal del estampado"
                  />
                </label>
                <label className="product-customizer__adjustment">
                  <span>Vertical</span>
                  <output>{Math.round(position.y)}%</output>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(position.y)}
                    onChange={(event) =>
                      updatePosition({
                        ...position,
                        y: Number(event.target.value),
                      })
                    }
                    aria-label="Posición vertical del estampado"
                  />
                </label>
              </div>
            )}
            <div className="product-customizer__action-row">
              <button
                type="button"
                className="product-customizer__change-image"
                onClick={() => fileInputRef.current?.click()}>
                <Upload size={17} aria-hidden="true" />
                Cambiar imagen
              </button>
              <button
                type="button"
                className="product-customizer__exit"
                onClick={() => {
                  setImage("");
                  onApply(null);
                  onEnabledChange(false);
                }}>
                <X size={16} aria-hidden="true" />
                Quitar personalización
              </button>
            </div>
            {imageError && (
              <p role="alert" className="alg-text-sm alg-text-brand">
                {imageError}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="product-customizer__launch-wrap">
          <button
            type="button"
            className="product-customizer__launch"
            onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={21} aria-hidden="true" />
            <span>
              <strong>Quiero personalizarlo</strong>
              <small>
                Adjunta una imagen para{" "}
                {kind === "mug" ? "la taza" : "la prenda"} · +{customizationFee}
              </small>
            </span>
            <Upload size={17} aria-hidden="true" />
          </button>
          {imageError && (
            <p role="alert" className="alg-mt-2 alg-text-sm alg-text-brand">
              {imageError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
