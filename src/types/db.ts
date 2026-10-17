export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface Variant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  color_hex?: string | null;
  price_clp: number | null;
  inventory:
    | { on_hand: number; reserved: number }
    | { on_hand: number; reserved: number }[]
    | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price_clp: number;
  customizable: boolean;
  customization_fee_clp: number;
  is_featured: boolean;
  category: { slug: string; name: string } | null;
  images: { path: string; alt: string | null; sort_order: number }[];
  catalog_image_path?: string | null;
  variants: Variant[];
  colors?: { name: string; hex: string }[];
}

export interface SiteContact {
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
}

export interface CartLine {
  lineId?: string;
  variantId: string;
  productName: string;
  label: string;
  unitPrice: number; // solo informativo: el servidor recalcula el precio real al crear el pedido
  fee: number;
  quantity: number;
  customization?: {
    placement?: string;
    text?: string;
    notes?: string;
    file_path?: string;
    color?: string;
    color_hex?: string;
    design_data_url?: string;
    design_x?: number;
    design_y?: number;
    design_scale?: number;
  };
}

/** Existencias disponibles de una variante (la relación 1:1 puede llegar como objeto o arreglo). */
export function available(v: Variant): number {
  const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
  return inv ? Math.max(inv.on_hand - inv.reserved, 0) : 0;
}
export const variantPrice = (p: Product, v: Variant): number =>
  Number(v.price_clp ?? p.base_price_clp);
