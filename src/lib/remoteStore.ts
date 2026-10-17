import { supabase } from "./supabase";
import {
  deleteLocalCategory,
  getLocalCategories,
  getLocalContact,
  getLocalOrders,
  getLocalProducts,
  imageUrl,
  saveLocalCategories,
  saveLocalContact,
  saveLocalOrder,
  saveLocalProducts,
  updateLocalOrderStatus,
  deleteLocalOrder,
  type LocalOrder,
} from "./localData";
import type { Category, Product, SiteContact } from "../types/db";

export interface AccountDetails {
  fullName: string;
  phone: string;
  rut: string;
  address: {
    street: string;
    number: string;
    commune: string;
    region: string;
  };
}

const EMPTY_ACCOUNT_DETAILS: AccountDetails = {
  fullName: "",
  phone: "",
  rut: "",
  address: { street: "", number: "", commune: "", region: "" },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRemoteStoreEnabled(): boolean {
  return Boolean(supabase);
}

export async function ensureCheckoutSession(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  throwIfError(error);
  if (data.session) return data.session.user.id;

  const { data: guest, error: guestError } =
    await client.auth.signInAnonymously();
  if (guestError)
    throw new Error(
      "No se pudo iniciar el checkout como invitado. Habilita el acceso anónimo en Supabase e inténtalo nuevamente.",
    );
  if (!guest.user)
    throw new Error("Supabase no devolvió una sesión para el checkout.");
  return guest.user.id;
}

export async function getAccountDetails(
  userId: string,
): Promise<AccountDetails> {
  if (!supabase) {
    try {
      return {
        ...EMPTY_ACCOUNT_DETAILS,
        ...(JSON.parse(
          localStorage.getItem(`algase.account.${userId}`) ?? "{}",
        ) as Partial<AccountDetails>),
      };
    } catch {
      return EMPTY_ACCOUNT_DETAILS;
    }
  }

  const [
    { data: profile, error: profileError },
    { data: address, error: addressError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, rut")
      .eq("id", userId)
      .single(),
    supabase
      .from("addresses")
      .select("street, number, commune, region")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);
  throwIfError(profileError);
  throwIfError(addressError);
  if (!profile) throw new Error("No se encontró el perfil de esta cuenta.");
  return {
    fullName: profile.full_name ?? "",
    phone: profile.phone ?? "",
    rut: profile.rut ?? "",
    address: {
      street: address?.street ?? "",
      number: address?.number ?? "",
      commune: address?.commune ?? "",
      region: address?.region ?? "",
    },
  };
}

export async function saveAccountDetails(
  userId: string,
  details: AccountDetails,
): Promise<void> {
  if (!supabase) {
    try {
      localStorage.setItem(`algase.account.${userId}`, JSON.stringify(details));
      return;
    } catch {
      throw new Error("No se pudieron guardar tus datos en este navegador.");
    }
  }
  const hasAddress = Object.values(details.address).some((value) =>
    value.trim(),
  );
  const { error } = await supabase.rpc("save_my_account_details", {
    p_full_name: details.fullName,
    p_phone: details.phone,
    p_rut: details.rut,
    p_address: hasAddress ? details.address : null,
  });
  throwIfError(error);
}

function requireSupabase() {
  if (!supabase)
    throw new Error("Configura Supabase para guardar cambios en el servidor.");
  return supabase;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    base_price_clp: Number(row.base_price_clp),
    customizable: row.customizable,
    customization_fee_clp: Number(row.customization_fee_clp ?? 0),
    is_featured: row.is_featured,
    category: row.category
      ? { slug: row.category.slug, name: row.category.name }
      : null,
    images: (row.images ?? []).map((image: any) => ({
      path: imageUrl(image.path),
      alt: image.alt ?? null,
      sort_order: image.sort_order ?? 0,
    })),
    catalog_image_path: row.catalog_image_path ?? null,
    variants: (row.variants ?? []).map((variant: any) => ({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      price_clp: variant.price_clp == null ? null : Number(variant.price_clp),
      inventory: variant.inventory ?? null,
    })),
    colors: row.colors ?? [],
  };
}

function mapRequest(row: any): LocalOrder {
  return {
    id: row.id,
    order_number: Number(row.order_number),
    user_id: row.user_id ?? "guest",
    payment_method: row.payment_method ?? "quote",
    status: row.status,
    total_clp: Number(row.total_clp),
    created_at: row.created_at,
    contact: row.contact,
    fulfillment: row.fulfillment,
    address: row.address ?? undefined,
    items: row.items,
  };
}

function mapDatabaseOrder(row: any): LocalOrder {
  return {
    id: row.id,
    order_number: Number(row.order_number),
    user_id: row.user_id,
    isPaymentOrder: true,
    status: row.status,
    total_clp: Number(row.total_clp),
    created_at: row.created_at,
    contact: {
      name: row.contact_name,
      email: row.contact_email,
      phone: row.contact_phone,
      rut: row.contact_rut ?? undefined,
    },
    fulfillment: row.fulfillment,
    address: row.shipping_address
      ? {
          street: [row.shipping_address.street, row.shipping_address.number]
            .filter(Boolean)
            .join(" "),
          commune: row.shipping_address.commune ?? "",
          region: row.shipping_address.region ?? "",
        }
      : undefined,
    items: (row.order_items ?? []).map((item: any) => {
      const customization = Array.isArray(item.customization)
        ? item.customization[0]
        : item.customization;
      return {
        product_name: item.product_name,
        label: item.variant_label ?? "",
        quantity: item.quantity,
        unit_price_clp:
          Number(item.unit_price_clp) + Number(item.customization_fee_clp ?? 0),
        customization: customization
          ? {
              placement: customization.placement ?? undefined,
              text: customization.text_content ?? undefined,
              notes: customization.notes ?? undefined,
              file_path: customization.file_path ?? undefined,
            }
          : undefined,
      };
    }),
  };
}

export async function getCatalogCategories(): Promise<Category[]> {
  if (!supabase) return getLocalCategories();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order");
  throwIfError(error);
  return data ?? [];
}

export async function getCatalogProducts(): Promise<Product[]> {
  if (!supabase) return getLocalProducts();
  const { data, error } = await supabase
    .from("products")
    .select(
      "*, category:categories(slug,name), images:product_images(path,alt,sort_order), variants:product_variants(id,sku,size,color,price_clp,inventory(on_hand,reserved))",
    )
    .eq("is_active", true)
    .eq("category.is_active", true)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapProduct);
}

export async function getManagedCatalog(): Promise<{
  categories: Category[];
  products: Product[];
}> {
  if (!supabase)
    return { categories: getLocalCategories(), products: getLocalProducts() };
  const client = requireSupabase();
  const [
    { data: categories, error: categoryError },
    { data: products, error: productError },
  ] = await Promise.all([
    client
      .from("categories")
      .select("id, slug, name")
      .eq("is_active", true)
      .order("sort_order"),
    client
      .from("products")
      .select(
        "*, category:categories(slug,name), images:product_images(path,alt,sort_order), variants:product_variants(id,sku,size,color,price_clp,inventory(on_hand,reserved))",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);
  throwIfError(categoryError);
  throwIfError(productError);
  return {
    categories: categories ?? [],
    products: (products ?? []).map(mapProduct),
  };
}

export async function saveCategory(category: Category): Promise<void> {
  if (!supabase) {
    saveLocalCategories([
      ...getLocalCategories().filter((item) => item.slug !== category.slug),
      category,
    ]);
    return;
  }
  const { error } = await supabase
    .from("categories")
    .upsert(
      { slug: category.slug, name: category.name },
      { onConflict: "slug" },
    );
  throwIfError(error);
}

export async function deleteCategory(category: Category): Promise<void> {
  if (!supabase) {
    if (!deleteLocalCategory(category.slug))
      throw new Error("No se pudo guardar la eliminación local.");
    return;
  }
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", category.id);
  throwIfError(error);
}

export async function saveProduct(product: Product): Promise<void> {
  if (!supabase) {
    const products = getLocalProducts();
    saveLocalProducts([
      product,
      ...products.filter((item) => item.id !== product.id),
    ]);
    return;
  }
  const client = requireSupabase();
  const productId = UUID_PATTERN.test(product.id)
    ? product.id
    : crypto.randomUUID();
  const images = await Promise.all(
    product.images.map(async (image, index) => {
      if (!image.path.startsWith("data:")) return image;
      const response = await fetch(image.path);
      const file = await response.blob();
      const extension = file.type === "image/webp" ? "webp" : "jpg";
      const path = `${productId}/${index}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type, upsert: true });
      throwIfError(uploadError);
      const { data } = client.storage.from("product-images").getPublicUrl(path);
      return { ...image, path: data.publicUrl };
    }),
  );
  let catalogImagePath = product.catalog_image_path ?? null;
  if (catalogImagePath?.startsWith("data:")) {
    const response = await fetch(catalogImagePath);
    const file = await response.blob();
    const extension = file.type === "image/webp" ? "webp" : "jpg";
    const path = `${productId}/catalog-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: true });
    throwIfError(uploadError);
    const { data } = client.storage.from("product-images").getPublicUrl(path);
    catalogImagePath = data.publicUrl;
  }
  const payload = {
    ...product,
    id: productId,
    images,
    catalog_image_path: catalogImagePath,
    variants: product.variants.map((variant) => ({
      ...variant,
      id: UUID_PATTERN.test(variant.id) ? variant.id : crypto.randomUUID(),
    })),
  };
  const { error } = await client.rpc("admin_save_product", {
    p_product: payload,
  });
  throwIfError(error);
  const { error: catalogImageError } = await client.rpc(
    "admin_set_product_catalog_image",
    { p_product_id: productId, p_path: catalogImagePath },
  );
  throwIfError(catalogImageError);
}

export async function deleteProduct(product: Product): Promise<void> {
  if (!supabase) {
    saveLocalProducts(
      getLocalProducts().filter((item) => item.id !== product.id),
    );
    return;
  }
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", product.id);
  throwIfError(error);
}

export async function getStoreContact(): Promise<SiteContact> {
  if (!supabase) return getLocalContact();
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "contact")
    .maybeSingle();
  throwIfError(error);
  return (data?.value as SiteContact | undefined) ?? getLocalContact();
}

export async function saveStoreContact(contact: SiteContact): Promise<void> {
  if (!supabase) {
    saveLocalContact(contact);
    return;
  }
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "contact", value: contact });
  throwIfError(error);
}

export async function getStoreRequests(): Promise<LocalOrder[]> {
  if (!supabase) return getLocalOrders();
  const [
    { data: requests, error: requestError },
    { data: orders, error: orderError },
  ] = await Promise.all([
    supabase
      .from("store_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select(
        "id,order_number,user_id,status,total_clp,created_at,contact_name,contact_email,contact_phone,contact_rut,fulfillment,shipping_address,order_items(id,product_name,variant_label,unit_price_clp,customization_fee_clp,quantity,customization:order_item_customizations(placement,text_content,file_path,notes))",
      )
      .order("created_at", { ascending: false }),
  ]);
  throwIfError(requestError);
  throwIfError(orderError);
  return [
    ...(requests ?? []).map(mapRequest),
    ...(orders ?? []).map(mapDatabaseOrder),
  ].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
}

export async function createStoreRequest(
  order: LocalOrder,
): Promise<LocalOrder> {
  if (!supabase) {
    if (!saveLocalOrder(order))
      throw new Error("No se pudo guardar la solicitud en este navegador.");
    return order;
  }
  const { data, error } = await supabase.rpc("submit_store_request", {
    p_request: {
      total_clp: order.total_clp,
      contact: order.contact,
      fulfillment: order.fulfillment,
      address: order.address ?? null,
      items: order.items,
      payment_method: order.payment_method ?? "quote",
    },
  });
  throwIfError(error);
  if (!data) throw new Error("El servidor no devolvió la solicitud creada.");
  return mapRequest(data);
}

export async function createPaidOrder(input: {
  items: {
    variant_id: string;
    quantity: number;
    customization?: Record<string, unknown> | null;
  }[];
  fulfillment: "shipping" | "pickup";
  address: Record<string, unknown> | null;
  contact: { name: string; email: string; phone: string; rut: string };
  idempotencyKey: string;
  userId: string;
}): Promise<string> {
  const client = requireSupabase();
  const items = await Promise.all(
    input.items.map(async (item) => {
      const customization = item.customization
        ? { ...item.customization }
        : null;
      const designDataUrl = customization?.design_data_url;
      if (
        typeof designDataUrl === "string" &&
        designDataUrl.startsWith("data:")
      ) {
        const response = await fetch(designDataUrl);
        const image = await response.blob();
        const extension = image.type === "image/webp" ? "webp" : "png";
        const path = `${input.userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage
          .from("customer-designs")
          .upload(path, image, { contentType: image.type, upsert: false });
        throwIfError(uploadError);
        customization!.file_path = path;
        delete customization!.design_data_url;
      }
      return { ...item, customization };
    }),
  );
  const { data, error } = await client.rpc("create_checkout_order", {
    p_items: items,
    p_fulfillment: input.fulfillment,
    p_address: input.address,
    p_contact: input.contact,
    p_idempotency_key: input.idempotencyKey,
  });
  throwIfError(error);
  if (typeof data !== "string")
    throw new Error("El servidor no devolvió el pedido creado.");
  return data;
}

export async function startOnlinePayment(
  provider: "webpay" | "mercadopago",
  orderId: string,
): Promise<{ url: string; token?: string }> {
  const client = requireSupabase();
  const functionName =
    provider === "webpay" ? "webpay-create" : "mercadopago-create";
  const { data, error } = await client.functions.invoke(functionName, {
    body: { order_id: orderId },
  });
  if (error) throw new Error(error.message || "No se pudo iniciar el pago.");
  if (typeof data?.url !== "string")
    throw new Error(
      data?.error ?? "El proveedor no devolvió una dirección de pago.",
    );
  if (provider === "webpay" && typeof data.token !== "string")
    throw new Error("Webpay no devolvió el token de la transacción.");
  return { url: data.url, token: data.token };
}

export async function updateStoreRequestStatus(
  id: string,
  status: LocalOrder["status"],
): Promise<void> {
  if (!supabase) {
    updateLocalOrderStatus(id, status);
    return;
  }
  if (status === "pending_confirmation")
    throw new Error(
      "Los pedidos pagables no admiten el estado de cotización pendiente.",
    );
  const { data: order, error: lookupError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);
  const { error } = order
    ? await supabase.from("orders").update({ status }).eq("id", id)
    : await supabase.from("store_requests").update({ status }).eq("id", id);
  throwIfError(error);
}

export async function deleteStoreRequest(id: string): Promise<void> {
  if (!supabase) {
    deleteLocalOrder(id);
    return;
  }
  const { data: order, error: lookupError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);
  if (order)
    throw new Error(
      "Los pedidos con historial de pago no se eliminan; actualiza su estado en su lugar.",
    );
  const { error } = await supabase.from("store_requests").delete().eq("id", id);
  throwIfError(error);
}
