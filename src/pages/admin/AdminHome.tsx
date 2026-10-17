import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Eye,
  ImagePlus,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatCLP, formatDateCL, ORDER_STATUS_LABEL } from "../../lib/format";
import { imageUrl, type LocalOrder } from "../../lib/localData";
import {
  deleteCategory,
  deleteProduct,
  deleteStoreRequest,
  getManagedCatalog,
  getStoreContact,
  getStoreRequests,
  isRemoteStoreEnabled,
  saveCategory,
  saveProduct,
  saveStoreContact,
  updateStoreRequestStatus,
} from "../../lib/remoteStore";
import type { Category, Product } from "../../types/db";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const orderStatuses: LocalOrder["status"][] = [
  "pending_payment",
  "pending_confirmation",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
];
const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 380 * 1024;

async function compressProductImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Usa una imagen JPG, PNG o WebP.");
  if (file.size > MAX_PRODUCT_IMAGE_BYTES)
    throw new Error("La imagen debe pesar menos de 10 MB.");

  const bitmap = await createImageBitmap(file);
  try {
    for (const maxSide of [1200, 1000, 800]) {
      const scale = Math.min(
        1,
        maxSide / Math.max(bitmap.width, bitmap.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("No se pudo procesar la imagen en este navegador.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.68, 0.54]) {
        let dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl.startsWith("data:image/webp")) {
          context.fillStyle = "#fff";
          context.globalCompositeOperation = "destination-over";
          context.fillRect(0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length * 0.75 <= MAX_STORED_IMAGE_BYTES) return dataUrl;
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error(
    "La imagen sigue siendo muy pesada tras comprimirla. Prueba con otra de menor resolución.",
  );
}

function readImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("No se pudo previsualizar la imagen."));
    reader.readAsDataURL(file);
  });
}

export default function AdminHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [contact, setContact] = useState({
    whatsapp: "",
    email: "",
    instagram: "",
    facebook: "",
  });
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"orders" | "products" | "settings">("orders");
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>(
    {},
  );
  const [catalogImagePreviews, setCatalogImagePreviews] = useState<
    Record<string, string>
  >({});
  const [newProductPreview, setNewProductPreview] = useState<string | null>(
    null,
  );
  const [newCatalogProductPreview, setNewCatalogProductPreview] = useState<
    string | null
  >(null);
  const [workingProduct, setWorkingProduct] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      getManagedCatalog(),
      getStoreRequests(),
      getStoreContact(),
    ]).then(([catalogResult, requestsResult, contactResult]) => {
      if (!active) return;

      const errors: string[] = [];
      if (catalogResult.status === "fulfilled") {
        setProducts(catalogResult.value.products);
        setCategories(catalogResult.value.categories);
      } else {
        errors.push(
          `Catálogo: ${catalogResult.reason instanceof Error ? catalogResult.reason.message : "no se pudo cargar."}`,
        );
      }

      if (requestsResult.status === "fulfilled") {
        setOrders(requestsResult.value);
      } else {
        errors.push(
          `Solicitudes: ${requestsResult.reason instanceof Error ? requestsResult.reason.message : "no se pudieron cargar."}`,
        );
      }

      if (contactResult.status === "fulfilled") {
        setContact(contactResult.value);
      } else {
        errors.push(
          `Contacto: ${contactResult.reason instanceof Error ? contactResult.reason.message : "no se pudo cargar."}`,
        );
      }

      setMessage(errors.join(" "));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!productToDelete) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProductToDelete(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [productToDelete]);

  useEffect(() => {
    if (!selectedOrder) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedOrder(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedOrder]);

  const refreshCatalog = async () => {
    const catalog = await getManagedCatalog();
    setProducts(catalog.products);
    setCategories(catalog.categories);
  };

  const removeSelectedProduct = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct(productToDelete);
      await refreshCatalog();
      setProductToDelete(null);
      setMessage("Producto eliminado del catálogo compartido.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el producto.",
      );
    }
  };

  const editProduct = async (
    event: FormEvent<HTMLFormElement>,
    product: Product,
  ) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const category = categories.find(
      (item) => item.slug === form.get("category"),
    );
    const name = String(form.get("name") ?? product.name).trim();
    const imageFile = form.get("image");
    const catalogImageFile = form.get("catalogImage");
    setWorkingProduct(true);
    try {
      const imagePath =
        imageFile instanceof File && imageFile.size > 0
          ? await compressProductImage(imageFile)
          : (product.images[0]?.path ?? "/images/placeholder-image.png");
      const catalogImagePath =
        catalogImageFile instanceof File && catalogImageFile.size > 0
          ? await compressProductImage(catalogImageFile)
          : (product.catalog_image_path ?? imagePath);
      const images = product.images.length
        ? product.images.map((image, index) =>
            index === 0 ? { ...image, path: imagePath, alt: name } : image,
          )
        : [{ path: imagePath, alt: name, sort_order: 0 }];
      const next = products.map((item) =>
        item.id !== product.id
          ? item
          : {
              ...item,
              name,
              description: String(form.get("description") ?? "").trim(),
              category: category
                ? { slug: category.slug, name: category.name }
                : item.category,
              images,
              catalog_image_path: catalogImagePath,
              variants: item.variants.map((variant, index) => ({
                ...variant,
                price_clp: Number(form.get(`variant-${index}`)) || 0,
              })),
            },
      );
      const updatedProduct = next.find((item) => item.id === product.id);
      if (!updatedProduct) return;
      await saveProduct(updatedProduct);
      await refreshCatalog();
      setMessage("Producto actualizado en el catálogo compartido.");
      if (imageFile instanceof File && imageFile.size > 0) {
        setImagePreviews((current) => ({
          ...current,
          [product.id]: imagePath,
        }));
      }
      if (catalogImageFile instanceof File && catalogImageFile.size > 0) {
        setCatalogImagePreviews((current) => ({
          ...current,
          [product.id]: catalogImagePath,
        }));
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo procesar la imagen.",
      );
    } finally {
      setWorkingProduct(false);
    }
  };

  const previewImage = async (
    event: ChangeEvent<HTMLInputElement>,
    productId?: string,
    imageKind: "detail" | "catalog" = "detail",
  ) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const preview = await readImagePreview(file);
      if (productId && imageKind === "catalog")
        setCatalogImagePreviews((current) => ({
          ...current,
          [productId]: preview,
        }));
      else if (productId)
        setImagePreviews((current) => ({ ...current, [productId]: preview }));
      else if (imageKind === "catalog") setNewCatalogProductPreview(preview);
      else setNewProductPreview(preview);
      setMessage(
        "Vista previa lista. Guarda el producto para aplicar la imagen.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo previsualizar la imagen.",
      );
    }
  };

  const addProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const basePrice = Number(form.get("price"));
    const category = categories.find(
      (item) => item.slug === form.get("category"),
    );
    if (!name || !category || !Number.isFinite(basePrice) || basePrice < 0)
      return;
    const imageFile = form.get("image");
    const catalogImageFile = form.get("catalogImage");
    setWorkingProduct(true);
    try {
      const imagePath =
        imageFile instanceof File && imageFile.size > 0
          ? await compressProductImage(imageFile)
          : "/images/placeholder-image.png";
      const catalogImagePath =
        catalogImageFile instanceof File && catalogImageFile.size > 0
          ? await compressProductImage(catalogImageFile)
          : imagePath;
      const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 5)}`;
      const sizes = String(form.get("sizes") ?? "Unico")
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean);
      const product: Product = {
        id: crypto.randomUUID(),
        slug,
        name,
        description: String(form.get("description") ?? "").trim(),
        base_price_clp: basePrice,
        customizable: true,
        customization_fee_clp: 0,
        is_featured: true,
        category: { slug: category.slug, name: category.name },
        colors: [
          { name: "Blanco", hex: "#f5f5f5" },
          { name: "Negro", hex: "#171717" },
        ],
        images: [{ path: imagePath, alt: `Imagen de ${name}`, sort_order: 0 }],
        catalog_image_path: catalogImagePath,
        variants: sizes.map((size, index) => ({
          id: `${slug}-${index}`,
          sku: `${slug}-${index}`,
          size,
          color: null,
          price_clp: basePrice,
          inventory: null,
        })),
      };
      await saveProduct(product);
      await refreshCatalog();
      setMessage("Producto agregado al catálogo compartido.");
      formElement.reset();
      setNewProductPreview(null);
      setNewCatalogProductPreview(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo procesar la imagen.",
      );
    } finally {
      setWorkingProduct(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(productSearch.trim().toLowerCase());
    const matchesCategory =
      !categoryFilter || product.category?.slug === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    const slug = slugify(name);
    if (!name || !slug || categories.some((category) => category.slug === slug))
      return setMessage("Ingresa un nombre de categoría nuevo.");
    try {
      await saveCategory({ id: crypto.randomUUID(), name, slug });
      await refreshCatalog();
      setMessage("Categoría agregada al catálogo compartido.");
      form.reset();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la categoría.",
      );
    }
  };

  const removeCategory = async (category: Category) => {
    if (
      !window.confirm(
        `¿Eliminar la categoría "${category.name}"? También se eliminarán todos sus productos del catálogo compartido. Esta acción no se puede deshacer.`,
      )
    )
      return;

    try {
      await deleteCategory(category);
      await refreshCatalog();
      if (categoryFilter === category.slug) setCategoryFilter("");
      setMessage(
        `Se eliminó la categoría "${category.name}" junto con sus productos compartidos.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la categoría.",
      );
    }
  };

  const updateStatus = async (id: string, status: LocalOrder["status"]) => {
    try {
      await updateStoreRequestStatus(id, status);
      setOrders(await getStoreRequests());
      setMessage("Estado de solicitud actualizado en el servidor.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la solicitud.",
      );
    }
  };

  const saveContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      whatsapp: String(form.get("whatsapp") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      instagram: String(form.get("instagram") ?? "").trim(),
      facebook: String(form.get("facebook") ?? "").trim(),
    };
    try {
      await saveStoreContact(next);
      setContact(next);
      setMessage("Datos de contacto guardados en el servidor.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los datos de contacto.",
      );
    }
  };

  return (
    <div>
      <Helmet>
        <title>Gestión de tienda | Algase</title>
      </Helmet>
      <div className="alg-mb-6 alg-flex alg-flex-wrap alg-items-end alg-justify-between alg-gap-4 alg-border-b alg-border-white-2f-15 alg-pb-5">
        <div>
          <p className="alg-text-sm alg-font-bold alg-uppercase alg-text-brand">
            Administración
          </p>
          <h1 className="alg-mt-2 alg-text-5xl">Gestión de tienda</h1>
        </div>
        <p className="alg-max-w-md alg-text-sm alg-text-white-2f-60">
          {isRemoteStoreEnabled()
            ? "Catálogo, solicitudes y datos de contacto sincronizados con la tienda."
            : "Modo local de desarrollo: los cambios quedan en este navegador."}
        </p>
      </div>
      <div
        className="alg-mb-6 alg-flex alg-flex-wrap alg-gap-2"
        role="tablist"
        aria-label="Secciones de administración">
        {(
          [
            ["orders", "Solicitudes"],
            ["products", "Catálogo"],
            ["settings", "Contacto"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "alg-btn-primary" : "alg-btn-ghost"}
            onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {message && (
        <p
          role="status"
          className="alg-mb-5 alg-border alg-border-brand-2f-50 alg-p-3 alg-text-sm">
          {message}
        </p>
      )}

      {tab === "orders" && (
        <section className="admin-orders" aria-label="Solicitudes de la tienda">
          <div className="admin-orders__heading">
            <h2 className="alg-text-3xl">Solicitudes</h2>
            <span className="admin-orders__count">
              {orders.length} registradas
            </span>
          </div>
          {orders.length === 0 ? (
            <p className="alg-border-y alg-border-white-2f-15 alg-py-8 alg-text-white-2f-70">
              Aún no hay solicitudes registradas.
            </p>
          ) : (
            <div className="admin-orders__table-wrap">
              <table className="admin-orders__table alg-text-left alg-text-sm">
                <thead>
                  <tr>
                    <th scope="col">Solicitud</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Detalle</th>
                    <th scope="col">Total ref.</th>
                    <th scope="col">Estado y acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="admin-orders__row"
                      data-status={order.status}>
                      <td>
                        <div className="admin-orders__request">
                          <span className="admin-orders__request-number">
                            #{order.order_number}
                          </span>
                          <time dateTime={order.created_at}>
                            {formatDateCL(order.created_at)}
                          </time>
                        </div>
                      </td>
                      <td>
                        <div className="admin-orders__customer">
                          <strong>{order.contact.name}</strong>
                          <a href={`mailto:${order.contact.email}`}>
                            <Mail size={14} aria-hidden="true" />
                            {order.contact.email}
                          </a>
                          <a
                            href={`tel:${order.contact.phone.replace(/[^+\d]/g, "")}`}>
                            <Phone size={14} aria-hidden="true" />
                            {order.contact.phone}
                          </a>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-orders__detail-button"
                          onClick={() => setSelectedOrder(order)}
                          aria-label={`Ver detalle de la solicitud #${order.order_number}`}>
                          <Eye size={16} aria-hidden="true" />
                          Ver detalle ({order.items.length})
                        </button>
                      </td>
                      <td>
                        <div className="admin-orders__total">
                          <span className="admin-orders__meta-label">
                            Total de referencia
                          </span>
                          <strong>{formatCLP(order.total_clp)}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="admin-orders__controls">
                          <label
                            className="alg-sr-only"
                            htmlFor={`status-${order.id}`}>
                            Cambiar estado de solicitud #{order.order_number}
                          </label>
                          <select
                            id={`status-${order.id}`}
                            className="alg-field"
                            value={order.status}
                            onChange={(event) =>
                              updateStatus(
                                order.id,
                                event.target.value as LocalOrder["status"],
                              )
                            }>
                            {orderStatuses
                              .filter((status) =>
                                order.isPaymentOrder
                                  ? status !== "pending_confirmation"
                                  : status !== "pending_payment",
                              )
                              .map((status) => (
                                <option key={status} value={status}>
                                  {ORDER_STATUS_LABEL[status]}
                                </option>
                              ))}
                          </select>
                          {!order.isPaymentOrder && (
                            <button
                              type="button"
                              className="admin-orders__delete"
                              aria-label={`Eliminar solicitud #${order.order_number}`}
                              title={`Eliminar solicitud #${order.order_number}`}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `¿Eliminar la solicitud #${order.order_number}?`,
                                  )
                                )
                                  return;
                                try {
                                  await deleteStoreRequest(order.id);
                                  setOrders(await getStoreRequests());
                                  setMessage(
                                    "Solicitud eliminada del servidor.",
                                  );
                                } catch (error) {
                                  setMessage(
                                    error instanceof Error
                                      ? error.message
                                      : "No se pudo eliminar la solicitud.",
                                  );
                                }
                              }}>
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "products" && (
        <section className="admin-catalog" aria-label="Gestión del catálogo">
          <div className="admin-catalog__main">
            <div className="admin-catalog__heading">
              <div>
                <p className="alg-text-sm alg-font-bold alg-uppercase alg-text-brand">
                  Inventario
                </p>
                <h2 className="alg-mt-1 alg-text-3xl">Catálogo</h2>
              </div>
              <span className="admin-catalog__count">
                {products.length}{" "}
                {products.length === 1 ? "producto" : "productos"}
              </span>
            </div>
            <div className="admin-catalog__filters">
              <label className="admin-catalog__search">
                <Search size={18} aria-hidden="true" />
                <span className="alg-sr-only">Buscar producto</span>
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar producto"
                />
              </label>
              <label className="admin-catalog__category">
                <span className="alg-sr-only">Filtrar por categoría</span>
                <select
                  className="alg-field"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {filteredProducts.length ? (
              <ul className="admin-product-list">
                {filteredProducts.map((product) => {
                  const firstImage = product.images[0];
                  const price = product.variants.length
                    ? Math.min(
                        ...product.variants.map((variant) =>
                          Number(variant.price_clp ?? product.base_price_clp),
                        ),
                      )
                    : product.base_price_clp;
                  return (
                    <li key={product.id} className="admin-product">
                      <div className="admin-product__summary">
                        <img
                          className="admin-product__thumbnail"
                          src={imageUrl(
                            imagePreviews[product.id] ??
                              firstImage?.path ??
                              "/images/placeholder-image.png",
                          )}
                          alt={firstImage?.alt ?? product.name}
                        />
                        <div className="admin-product__details">
                          <strong>{product.name}</strong>
                          <span>
                            {product.category?.name ?? "Sin categoría"} ·{" "}
                            {product.variants.length}{" "}
                            {product.variants.length === 1
                              ? "variante"
                              : "variantes"}
                          </span>
                          <b>Desde {formatCLP(price)}</b>
                        </div>
                        <button
                          type="button"
                          className="admin-product__remove"
                          aria-label={`Quitar ${product.name}`}
                          title="Quitar producto"
                          onClick={() => setProductToDelete(product)}>
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                      <details className="admin-product__editor">
                        <summary>
                          <Plus size={16} aria-hidden="true" />
                          Editar producto
                        </summary>
                        <form
                          onSubmit={(event) => editProduct(event, product)}
                          className="admin-product__form">
                          <div className="admin-image-picker">
                            <span className="alg-label">Imagen de detalle</span>
                            <div className="admin-image-picker__content">
                              <img
                                src={imageUrl(
                                  imagePreviews[product.id] ??
                                    firstImage?.path ??
                                    "/images/placeholder-image.png",
                                )}
                                alt={`Vista previa de ${product.name}`}
                              />
                              <div>
                                <input
                                  id={`edit-image-${product.id}`}
                                  className="admin-image-picker__input"
                                  name="image"
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  onChange={(event) =>
                                    previewImage(event, product.id)
                                  }
                                />
                                <label
                                  className="admin-image-picker__button"
                                  htmlFor={`edit-image-${product.id}`}>
                                  <ImagePlus size={17} aria-hidden="true" />
                                  Cambiar imagen
                                </label>
                                <p>JPG, PNG o WebP · máximo 10 MB</p>
                              </div>
                            </div>
                          </div>
                          <div className="admin-image-picker">
                            <span className="alg-label">
                              Imagen de catálogo
                            </span>
                            <div className="admin-image-picker__content">
                              <img
                                src={imageUrl(
                                  catalogImagePreviews[product.id] ??
                                    product.catalog_image_path ??
                                    firstImage?.path ??
                                    "/images/placeholder-image.png",
                                )}
                                alt={`Vista previa de catálogo de ${product.name}`}
                              />
                              <div>
                                <input
                                  id={`edit-catalog-image-${product.id}`}
                                  className="admin-image-picker__input"
                                  name="catalogImage"
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  onChange={(event) =>
                                    previewImage(event, product.id, "catalog")
                                  }
                                />
                                <label
                                  className="admin-image-picker__button"
                                  htmlFor={`edit-catalog-image-${product.id}`}>
                                  <ImagePlus size={17} aria-hidden="true" />
                                  Cambiar imagen
                                </label>
                                <p>Se usa solo en portada y catálogo</p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label
                              className="alg-label"
                              htmlFor={`edit-name-${product.id}`}>
                              Nombre
                            </label>
                            <input
                              id={`edit-name-${product.id}`}
                              name="name"
                              className="alg-field"
                              defaultValue={product.name}
                              required
                            />
                          </div>
                          <div>
                            <label
                              className="alg-label"
                              htmlFor={`edit-category-${product.id}`}>
                              Categoría
                            </label>
                            <select
                              id={`edit-category-${product.id}`}
                              name="category"
                              className="alg-field"
                              defaultValue={product.category?.slug}>
                              {categories.map((category) => (
                                <option key={category.id} value={category.slug}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              className="alg-label"
                              htmlFor={`edit-description-${product.id}`}>
                              Descripción
                            </label>
                            <textarea
                              id={`edit-description-${product.id}`}
                              name="description"
                              className="alg-field"
                              defaultValue={product.description ?? ""}
                              rows={3}
                            />
                          </div>
                          <fieldset className="alg-grid alg-gap-2">
                            <legend className="alg-label">
                              Precio por talla o formato
                            </legend>
                            {product.variants.map((variant, index) => (
                              <div
                                key={variant.id}
                                className="alg-grid alg-grid-cols--5b-1fr_2fr-5d alg-items-center alg-gap-3">
                                <span>{variant.size}</span>
                                <input
                                  aria-label={`Precio ${variant.size}`}
                                  name={`variant-${index}`}
                                  type="number"
                                  min="0"
                                  className="alg-field alg-py-2"
                                  defaultValue={
                                    variant.price_clp ?? product.base_price_clp
                                  }
                                />
                              </div>
                            ))}
                          </fieldset>
                          <button
                            className="alg-btn-ghost alg-justify-self-start"
                            disabled={workingProduct}>
                            {workingProduct ? "Procesando…" : "Guardar cambios"}
                          </button>
                        </form>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="admin-catalog__empty">
                <Search size={22} aria-hidden="true" />
                <p>
                  {products.length
                    ? "No hay productos que coincidan con estos filtros."
                    : "Aún no hay productos en el catálogo."}
                </p>
              </div>
            )}
          </div>
          <div className="admin-catalog__sidebar">
            <form onSubmit={addProduct} className="admin-product-form">
              <div className="admin-product-form__heading">
                <span>
                  <Plus size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3>Agregar producto</h3>
                </div>
              </div>
              <div className="admin-image-picker">
                <span className="alg-label">Imagen de detalle</span>
                <div className="admin-image-picker__content">
                  <img
                    src={newProductPreview ?? "/images/placeholder-image.png"}
                    alt="Vista previa del nuevo producto"
                  />
                  <div>
                    <input
                      id="new-image"
                      className="admin-image-picker__input"
                      name="image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => previewImage(event)}
                    />
                    <label
                      className="admin-image-picker__button"
                      htmlFor="new-image">
                      <ImagePlus size={17} aria-hidden="true" />
                      Elegir imagen
                    </label>
                    <p>JPG, PNG o WebP · máximo 10 MB</p>
                  </div>
                </div>
              </div>
              <div className="admin-image-picker">
                <span className="alg-label">Imagen de catálogo</span>
                <div className="admin-image-picker__content">
                  <img
                    src={
                      newCatalogProductPreview ??
                      newProductPreview ??
                      "/images/placeholder-image.png"
                    }
                    alt="Vista previa de imagen de catálogo"
                  />
                  <div>
                    <input
                      id="new-catalog-image"
                      className="admin-image-picker__input"
                      name="catalogImage"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        previewImage(event, undefined, "catalog")
                      }
                    />
                    <label
                      className="admin-image-picker__button"
                      htmlFor="new-catalog-image">
                      <ImagePlus size={17} aria-hidden="true" />
                      Elegir imagen
                    </label>
                    <p>Se usa solo en portada y catálogo</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="alg-label" htmlFor="new-name">
                  Nombre
                </label>
                <input
                  id="new-name"
                  name="name"
                  className="alg-field"
                  required
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="new-category">
                  Categoría
                </label>
                <select id="new-category" name="category" className="alg-field">
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="alg-label" htmlFor="new-price">
                  Precio base CLP
                </label>
                <input
                  id="new-price"
                  name="price"
                  type="number"
                  min="0"
                  step="1"
                  className="alg-field"
                  required
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="new-sizes">
                  Tallas o formato, separados por coma
                </label>
                <input
                  id="new-sizes"
                  name="sizes"
                  className="alg-field"
                  placeholder="S, M, L, XL"
                  defaultValue="Unico"
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="new-description">
                  Descripción
                </label>
                <textarea
                  id="new-description"
                  name="description"
                  className="alg-field"
                  rows={3}
                />
              </div>
              <button className="alg-btn-primary" disabled={workingProduct}>
                {workingProduct ? "Procesando…" : "Guardar producto"}
              </button>
            </form>
            <div className="admin-category-tools">
              <form onSubmit={addCategory} className="alg-grid alg-gap-3">
                <h3 className="alg-text-2xl">Nueva categoría</h3>
                <div>
                  <label className="alg-label" htmlFor="new-category-name">
                    Nombre
                  </label>
                  <input
                    id="new-category-name"
                    name="name"
                    className="alg-field"
                    required
                  />
                </div>
                <button className="alg-btn-ghost">Agregar categoría</button>
              </form>
              <div>
                <h3 className="alg-mb-2 alg-text-lg">Categorías activas</h3>
                <ul className="alg-divide-y alg-divide-white-2f-10 admin-category-tools__list">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="admin-category-tools__item alg-py-2 alg-text-sm">
                      <span>{category.name}</span>
                      <button
                        type="button"
                        className="admin-category-tools__remove"
                        aria-label={`Eliminar categoría ${category.name} y sus productos`}
                        title="Eliminar categoría y sus productos"
                        onClick={() => removeCategory(category)}>
                        <X size={15} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="alg-max-w-2xl">
          <h2 className="alg-mb-4 alg-text-3xl">Contacto de la tienda</h2>
          <form onSubmit={saveContact} className="alg-grid alg-gap-4">
            <div>
              <label className="alg-label" htmlFor="contact-whatsapp">
                WhatsApp con código de país
              </label>
              <input
                id="contact-whatsapp"
                name="whatsapp"
                className="alg-field"
                defaultValue={contact.whatsapp}
                placeholder="+56912345678"
              />
            </div>
            <div>
              <label className="alg-label" htmlFor="contact-email">
                Correo
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                className="alg-field"
                defaultValue={contact.email}
              />
            </div>
            <div>
              <label className="alg-label" htmlFor="contact-instagram">
                Enlace de Instagram
              </label>
              <input
                id="contact-instagram"
                name="instagram"
                type="url"
                className="alg-field"
                defaultValue={contact.instagram}
                placeholder="https://instagram.com/…"
              />
            </div>
            <div>
              <label className="alg-label" htmlFor="contact-facebook">
                Enlace de Facebook
              </label>
              <input
                id="contact-facebook"
                name="facebook"
                type="url"
                className="alg-field"
                defaultValue={contact.facebook}
                placeholder="https://facebook.com/…"
              />
            </div>
            <button className="alg-btn-primary alg-justify-self-start">
              Guardar contacto
            </button>
          </form>
        </section>
      )}
      {selectedOrder && (
        <div className="admin-order-modal" role="presentation">
          <button
            type="button"
            className="admin-order-modal__backdrop"
            aria-label="Cerrar detalle de solicitud"
            onClick={() => setSelectedOrder(null)}
          />
          <section
            className="admin-order-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title">
            <header className="admin-order-modal__header">
              <div>
                <p className="admin-order-modal__eyebrow">
                  Detalle de solicitud
                </p>
                <h2 id="order-detail-title">#{selectedOrder.order_number}</h2>
                <time dateTime={selectedOrder.created_at}>
                  {formatDateCL(selectedOrder.created_at)}
                </time>
              </div>
              <button
                type="button"
                className="admin-confirm-modal__close"
                aria-label="Cerrar"
                autoFocus
                onClick={() => setSelectedOrder(null)}>
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className="admin-order-modal__content">
              <section className="admin-order-modal__section">
                <h3>Cliente</h3>
                <strong>{selectedOrder.contact.name}</strong>
                <a href={`mailto:${selectedOrder.contact.email}`}>
                  <Mail size={15} aria-hidden="true" />
                  {selectedOrder.contact.email}
                </a>
                <a
                  href={`tel:${selectedOrder.contact.phone.replace(/[^+\d]/g, "")}`}>
                  <Phone size={15} aria-hidden="true" />
                  {selectedOrder.contact.phone}
                </a>
                {selectedOrder.contact.rut && (
                  <p>RUT: {selectedOrder.contact.rut}</p>
                )}
              </section>
              <section className="admin-order-modal__section">
                <h3>Entrega y estado</h3>
                <p>
                  {selectedOrder.fulfillment === "pickup" ? (
                    <MapPin size={15} aria-hidden="true" />
                  ) : (
                    <Package size={15} aria-hidden="true" />
                  )}
                  {selectedOrder.fulfillment === "pickup"
                    ? "Retiro en tienda"
                    : "Despacho por coordinar"}
                </p>
                {selectedOrder.address && (
                  <p>
                    {selectedOrder.address.street},{" "}
                    {selectedOrder.address.commune},{" "}
                    {selectedOrder.address.region}
                  </p>
                )}
                <span
                  className={`admin-orders__status admin-orders__status--${selectedOrder.status}`}>
                  {ORDER_STATUS_LABEL[selectedOrder.status]}
                </span>
              </section>
              <section className="admin-order-modal__section">
                <h3>Método de pago</h3>
                <p>
                  {selectedOrder.payment_method === "transfer"
                    ? "Transferencia electrónica"
                    : "Cotización por coordinar"}
                </p>
              </section>
              <section className="admin-order-modal__section admin-order-modal__items">
                <h3>Artículos ({selectedOrder.items.length})</h3>
                <ul>
                  {selectedOrder.items.map((item, index) => (
                    <li key={`${selectedOrder.id}-${index}`}>
                      <div className="admin-order-modal__item-heading">
                        <span className="admin-orders__item-quantity">
                          {item.quantity}×
                        </span>
                        <div>
                          <strong>{item.product_name}</strong>
                          <span>{item.label}</span>
                        </div>
                        <strong>
                          {formatCLP(item.unit_price_clp * item.quantity)}
                        </strong>
                      </div>
                      {item.customization && (
                        <dl>
                          {item.customization.placement && (
                            <div>
                              <dt>Ubicación</dt>
                              <dd>{item.customization.placement}</dd>
                            </div>
                          )}
                          {item.customization.text && (
                            <div>
                              <dt>Texto</dt>
                              <dd>{item.customization.text}</dd>
                            </div>
                          )}
                          {item.customization.color && (
                            <div>
                              <dt>Color</dt>
                              <dd>{item.customization.color}</dd>
                            </div>
                          )}
                          {item.customization.notes && (
                            <div>
                              <dt>Notas</dt>
                              <dd>{item.customization.notes}</dd>
                            </div>
                          )}
                          {item.customization.file_path && (
                            <div>
                              <dt>Archivo</dt>
                              <dd>{item.customization.file_path}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              <div className="admin-order-modal__total">
                <span>Total de referencia</span>
                <strong>{formatCLP(selectedOrder.total_clp)}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
      {productToDelete && (
        <div className="admin-confirm-modal" role="presentation">
          <button
            type="button"
            className="admin-confirm-modal__backdrop"
            aria-label="Cancelar eliminación"
            onClick={() => setProductToDelete(null)}
          />
          <section
            className="admin-confirm-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            aria-describedby="delete-product-description">
            <div className="admin-confirm-modal__icon">
              <Trash2 size={21} aria-hidden="true" />
            </div>
            <button
              type="button"
              className="admin-confirm-modal__close"
              aria-label="Cerrar"
              onClick={() => setProductToDelete(null)}>
              <X size={19} aria-hidden="true" />
            </button>
            <p className="admin-confirm-modal__eyebrow">Eliminar producto</p>
            <h2 id="delete-product-title">
              ¿Quitar {productToDelete.name} del catálogo compartido?
            </h2>
            <p id="delete-product-description">
              Esta acción no se puede deshacer. El producto dejará de aparecer
              en el catálogo de la tienda.
            </p>
            <div className="admin-confirm-modal__actions">
              <button
                type="button"
                className="alg-btn-ghost"
                autoFocus
                onClick={() => setProductToDelete(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="admin-confirm-modal__confirm"
                onClick={removeSelectedProduct}>
                <Trash2 size={16} aria-hidden="true" />
                Quitar producto
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
