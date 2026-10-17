import type { CartLine, Category, Product, SiteContact } from "../types/db";

export interface LocalOrder {
  id: string;
  order_number: number;
  user_id: string;
  isPaymentOrder?: boolean;
  payment_method?: "quote" | "transfer";
  status:
    | "pending_confirmation"
    | "pending_payment"
    | "confirmed"
    | "in_production"
    | "ready"
    | "shipped"
    | "delivered"
    | "cancelled";
  total_clp: number;
  created_at: string;
  contact: { name: string; email: string; phone: string; rut?: string };
  fulfillment: "shipping" | "pickup";
  address?: { street: string; commune: string; region: string };
  items: {
    product_name: string;
    label: string;
    quantity: number;
    unit_price_clp: number;
    customization?: CartLine["customization"];
  }[];
}

const KEYS = {
  categories: "algase.data.categories.v1",
  products: "algase.data.products.v1",
  contact: "algase.data.contact.v1",
  orders: "algase.data.orders.v1",
  deletedCategories: "algase.data.deleted-categories.v1",
};

const categories: Category[] = [
  { id: "category-poleras", slug: "poleras", name: "Poleras" },
  { id: "category-polerones", slug: "polerones", name: "Polerones" },
  { id: "category-tazas", slug: "tazas", name: "Tazas" },
];

function variants(
  prefix: string,
  prices: [string, number][],
): Product["variants"] {
  return prices.map(([size, price], index) => ({
    id: `${prefix}-variant-${index + 1}`,
    sku: `${prefix.toUpperCase()}-${size}`,
    size,
    color: null,
    color_hex: null,
    price_clp: price,
    inventory: null,
  }));
}

const products: Product[] = [
  {
    id: "product-poleron-algodon",
    slug: "poleron-algodon",
    name: "Polerón de algodón",
    description:
      "Polerón de algodón de fabricación propia, listo para personalizar con estampados, frases o diseños. Consulta por colores disponibles y envíanos tu idea.",
    base_price_clp: 10000,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "polerones", name: "Polerones" },
    colors: [
      { name: "Negro", hex: "#171717" },
      { name: "Gris", hex: "#7b7b7b" },
      { name: "Gris grafito", hex: "#414141" },
      { name: "Blanco", hex: "#f5f5f5" },
    ],
    images: [
      {
        path: "/images/placeholder-image.png",
        alt: "Imagen referencial no disponible",
        sort_order: 0,
      },
    ],
    variants: variants("poleron-algodon", [
      ["2", 10000],
      ["4", 10000],
      ["6", 10000],
      ["8", 12000],
      ["10", 12000],
      ["12", 13000],
      ["14", 14000],
      ["16", 15000],
      ["S", 17000],
      ["M", 17000],
      ["L", 17000],
      ["XL", 18000],
      ["2XL", 18000],
      ["3XL", 19000],
      ["4XL", 19000],
      ["5XL", 20000],
    ]),
  },
  {
    id: "product-polera-algodon",
    slug: "polera-algodon",
    name: "Polera de algodón",
    description:
      "Polera de algodón de fabricación propia, ideal para estampados personalizados, frases, ilustraciones o identidad de marca. Consulta por colores disponibles y envíanos tu idea.",
    base_price_clp: 6000,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "poleras", name: "Poleras" },
    colors: [
      { name: "Blanco", hex: "#f5f5f5" },
      { name: "Negro", hex: "#171717" },
      { name: "Rosado", hex: "#e6007e" },
      { name: "Gris grafito", hex: "#414141" },
    ],
    images: [
      {
        path: "/images/background-polera-2.png",
        alt: "Polera de algodón con marca Algase personalizada",
        sort_order: 0,
      },
    ],
    variants: variants("polera-algodon", [
      ["2", 6000],
      ["4", 6000],
      ["6", 6000],
      ["8", 6000],
      ["10", 7000],
      ["12", 7000],
      ["14", 8000],
      ["16", 8000],
      ["S", 10000],
      ["M", 10000],
      ["L", 10000],
      ["XL", 10000],
      ["2XL", 12000],
      ["3XL", 12000],
      ["4XL", 13000],
      ["5XL", 13000],
    ]),
  },
  {
    id: "product-polera-manga-corta",
    slug: "polera-manga-corta",
    name: "Polera manga corta",
    description:
      "Polera unisex de algodón, cómoda para uso diario y personalización con estampado frontal, espalda o mangas.",
    base_price_clp: 5990,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "poleras", name: "Poleras" },
    colors: [
      { name: "Negro", hex: "#171717" },
      { name: "Blanco", hex: "#f5f5f5" },
      { name: "Rosado", hex: "#e6007e" },
      { name: "Gris grafito", hex: "#414141" },
    ],
    images: [
      {
        path: "/images/background-polera.png",
        alt: "Polera manga corta con estampado Algase",
        sort_order: 0,
      },
    ],
    variants: variants("polera-manga-corta", [
      ["S", 5990],
      ["M", 5990],
      ["L", 5990],
      ["XL", 6990],
    ]),
  },
  {
    id: "product-polera-manga-larga",
    slug: "polera-manga-larga",
    name: "Polera manga larga",
    description:
      "Polera de algodón de manga larga, ideal para estampar diseños personalizados y vestir durante todo el año.",
    base_price_clp: 7990,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "poleras", name: "Poleras" },
    colors: [
      { name: "Negro", hex: "#171717" },
      { name: "Blanco", hex: "#f5f5f5" },
      { name: "Gris grafito", hex: "#414141" },
      { name: "Rosado", hex: "#e6007e" },
    ],
    images: [
      {
        path: "/images/background-polera-2.png",
        alt: "Prenda Algase con estampado personalizado",
        sort_order: 0,
      },
    ],
    variants: variants("polera-manga-larga", [
      ["S", 7990],
      ["M", 7990],
      ["L", 7990],
      ["XL", 8990],
    ]),
  },
  {
    id: "product-polera-oversize",
    slug: "polera-oversize",
    name: "Polera oversize",
    description:
      "Polera oversize de algodón con calce amplio, preparada para personalización mediante estampado.",
    base_price_clp: 11990,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "poleras", name: "Poleras" },
    colors: [
      { name: "Gris grafito", hex: "#414141" },
      { name: "Negro", hex: "#171717" },
      { name: "Blanco", hex: "#f5f5f5" },
    ],
    images: [
      {
        path: "/images/placeholder-image.png",
        alt: "Polera oversize referencial",
        sort_order: 0,
      },
    ],
    variants: variants("polera-oversize", [
      ["S", 11990],
      ["M", 11990],
      ["L", 11990],
      ["XL", 12990],
    ]),
  },
  {
    id: "product-poleron-canguro",
    slug: "poleron-canguro",
    name: "Polerón canguro",
    description:
      "Polerón con capucha y bolsillo canguro, ideal para personalizar con un estampado propio.",
    base_price_clp: 12990,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "polerones", name: "Polerones" },
    colors: [
      { name: "Negro", hex: "#171717" },
      { name: "Gris", hex: "#7b7b7b" },
      { name: "Gris grafito", hex: "#414141" },
    ],
    images: [
      {
        path: "/images/placeholder-image.png",
        alt: "Polerón canguro referencial",
        sort_order: 0,
      },
    ],
    variants: variants("poleron-canguro", [
      ["S", 12990],
      ["M", 12990],
      ["L", 12990],
      ["XL", 13990],
    ]),
  },
  {
    id: "product-taza-ceramica",
    slug: "taza-ceramica-personalizada",
    name: "Taza de cerámica personalizada",
    description:
      "Taza de cerámica para personalizar con fotografías, ilustraciones, frases o diseños propios.",
    base_price_clp: 6990,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "tazas", name: "Tazas" },
    colors: [
      { name: "Blanco", hex: "#f5f5f5" },
      { name: "Interior negro", hex: "#242424" },
      { name: "Interior rosado", hex: "#e6007e" },
      { name: "Interior grafito", hex: "#414141" },
    ],
    images: [
      {
        path: "/images/background-taza.png",
        alt: "Taza personalizada Algase",
        sort_order: 0,
      },
    ],
    variants: variants("taza-ceramica", [["330 ml", 6990]]),
  },
  {
    id: "product-taza-magica",
    slug: "taza-magica",
    name: "Taza mágica",
    description:
      "Taza de acabado térmico para revelar tu diseño con el calor. Personalizable con imagen o frase.",
    base_price_clp: 9990,
    customizable: true,
    customization_fee_clp: 0,
    is_featured: true,
    category: { slug: "tazas", name: "Tazas" },
    colors: [{ name: "Negro", hex: "#242424" }],
    images: [
      {
        path: "/images/placeholder-image.png",
        alt: "Taza mágica referencial",
        sort_order: 0,
      },
    ],
    variants: variants("taza-magica", [["330 ml", 9990]]),
  },
];

const contact: SiteContact = {
  whatsapp: "+56950782244",
  email: "confeccionesalgase@gmail.com",
  instagram: "",
  facebook: "",
};

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function initialize<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return read(key, fallback);
  } catch {
    return fallback;
  }
  write(key, fallback);
  return fallback;
}

function normalizeCatalogColor(
  color: NonNullable<Product["colors"]>[number],
): NonNullable<Product["colors"]>[number] {
  const hex = color.hex.replace("#", "");
  const fullHex =
    hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  const channels = fullHex
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16));
  if (
    !channels ||
    channels.length !== 3 ||
    channels.some((channel) => Number.isNaN(channel))
  )
    return color;

  const [red, green, blue] = channels.map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  if (/rojo/i.test(color.name) || (hue >= 25 && hue <= 65))
    return { ...color, name: "Rosado", hex: "#e6007e" };
  if ((hue >= 185 && hue <= 255) || /azul/i.test(color.name))
    return { ...color, name: "Gris grafito", hex: "#414141" };
  return color;
}

export function getLocalCategories(): Category[] {
  const deletedSlugs = read<string[]>(KEYS.deletedCategories, []);
  const saved = initialize(KEYS.categories, categories).filter(
    (category) => !deletedSlugs.includes(category.slug),
  );
  const merged = [...saved];
  for (const category of categories) {
    if (
      !deletedSlugs.includes(category.slug) &&
      !merged.some((item) => item.slug === category.slug)
    )
      merged.push(category);
  }
  if (merged.length !== saved.length) write(KEYS.categories, merged);
  return merged;
}

export function getLocalProducts(): Product[] {
  const saved = initialize(KEYS.products, products);
  const deletedSlugs = read<string[]>(KEYS.deletedCategories, []);
  const merged = [...saved];
  let changed = false;
  for (const product of merged) {
    if (product.colors?.length) {
      const normalized = product.colors.map(normalizeCatalogColor);
      if (
        normalized.some(
          (color, index) =>
            color.name !== product.colors?.[index].name ||
            color.hex !== product.colors?.[index].hex,
        )
      ) {
        product.colors = normalized;
        changed = true;
      }
    }
  }
  for (const product of products) {
    if (deletedSlugs.includes(product.category?.slug ?? "")) continue;
    const existing = merged.find((item) => item.slug === product.slug);
    if (!existing) {
      merged.push(product);
      changed = true;
    } else {
      if (!existing.colors && product.colors) {
        existing.colors = product.colors;
        changed = true;
      }
      if (
        existing.images.every(
          (image) => image.path === "/images/placeholder-image.png",
        ) &&
        product.images.some(
          (image) => image.path !== "/images/placeholder-image.png",
        )
      ) {
        existing.images = product.images;
        changed = true;
      }
    }
  }
  const availableProducts = merged.filter(
    (product) => !deletedSlugs.includes(product.category?.slug ?? ""),
  );
  if (availableProducts.length !== merged.length) {
    merged.splice(0, merged.length, ...availableProducts);
    changed = true;
  }
  if (changed) write(KEYS.products, merged);
  return merged;
}

export function deleteLocalCategory(slug: string): boolean {
  const deletedSlugs = read<string[]>(KEYS.deletedCategories, []);
  if (!deletedSlugs.includes(slug)) {
    if (!write(KEYS.deletedCategories, [...deletedSlugs, slug])) return false;
  }

  const categoriesSaved = write(
    KEYS.categories,
    getLocalCategories().filter((category) => category.slug !== slug),
  );
  const productsSaved = write(
    KEYS.products,
    getLocalProducts().filter((product) => product.category?.slug !== slug),
  );
  return categoriesSaved && productsSaved;
}

export function saveLocalProducts(value: Product[]): boolean {
  return write(KEYS.products, value);
}

export function saveLocalCategories(value: Category[]): void {
  write(KEYS.categories, value);
}

export function getLocalContact(): SiteContact {
  return initialize(KEYS.contact, contact);
}

export function saveLocalContact(value: SiteContact): void {
  write(KEYS.contact, value);
}

export function getLocalOrders(): LocalOrder[] {
  return initialize(KEYS.orders, [] as LocalOrder[]);
}

export function saveLocalOrder(order: LocalOrder): boolean {
  return write(KEYS.orders, [order, ...getLocalOrders()]);
}

export function getOrdersForUser(userId: string): LocalOrder[] {
  return getLocalOrders().filter((order) => order.user_id === userId);
}

export function deleteLocalOrdersForUser(userId: string): void {
  write(
    KEYS.orders,
    getLocalOrders().filter((order) => order.user_id !== userId),
  );
}

export function updateLocalOrderStatus(
  id: string,
  status: LocalOrder["status"],
): void {
  const orders = getLocalOrders().map((order) =>
    order.id === id ? { ...order, status } : order,
  );
  write(KEYS.orders, orders);
}

export function deleteLocalOrder(id: string): void {
  write(
    KEYS.orders,
    getLocalOrders().filter((order) => order.id !== id),
  );
}

export function imageUrl(path: string): string {
  return path.startsWith("/") || /^(data:|blob:|https?:\/\/)/i.test(path)
    ? path
    : `/images/${path}`;
}
