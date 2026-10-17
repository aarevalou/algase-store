// Inicia Webpay Plus para un pedido autenticado. El monto solo se obtiene de la BD.
import { adminClient, cors, json, userClient } from "../_shared/clients.ts";

const HOST =
  Deno.env.get("WEBPAY_ENV") === "production"
    ? "https://webpay3g.transbank.cl"
    : "https://webpay3gint.transbank.cl";
const BASE = `${HOST}/rswebpaytransaction/api/webpay/v1.2`; // verifica la ruta vigente en transbankdevelopers.cl

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const auth = userClient(req);
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser();
    if (authError) return json({ error: "No se pudo validar la sesión" }, 401);
    if (!user) return json({ error: "No autenticado" }, 401);
    const { order_id } = await req.json();
    if (typeof order_id !== "string")
      return json({ error: "Pedido inválido" }, 400);

    const db = adminClient();
    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id,user_id,status,total_clp,order_number,contact_email")
      .eq("id", order_id)
      .single();
    if (orderError) throw orderError;
    if (!order || order.user_id !== user.id)
      return json({ error: "Pedido no encontrado" }, 404);
    if (order.status !== "pending_payment")
      return json({ error: "El pedido no admite pago" }, 409);
    const commerceCode = Deno.env.get("WEBPAY_COMMERCE_CODE");
    const apiKey = Deno.env.get("WEBPAY_API_KEY");
    const siteUrl = Deno.env.get("SITE_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!commerceCode || !apiKey || !siteUrl || !supabaseUrl)
      return json({ error: "Falta configurar Webpay en el servidor" }, 503);

    const { data: payment, error: pErr } = await db
      .from("payments")
      .insert({
        order_id: order.id,
        provider: "webpay",
        amount_clp: order.total_clp,
        buy_order: `A${order.order_number}-${Date.now().toString(36)}`.slice(
          0,
          26,
        ),
      })
      .select()
      .single();
    if (pErr) throw pErr;

    try {
      const res = await fetch(`${BASE}/transactions`, {
        method: "POST",
        headers: {
          "Tbk-Api-Key-Id": commerceCode,
          "Tbk-Api-Key-Secret": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buy_order: payment.buy_order,
          session_id: payment.id,
          amount: Number(order.total_clp),
          return_url: `${supabaseUrl.replace(/\/$/, "")}/functions/v1/webpay-commit`,
        }),
      });
      const tx = await res.json();
      if (!res.ok || !tx.token || !tx.url) {
        await db.rpc("apply_payment_result", {
          p_payment_id: payment.id,
          p_status: "failed",
          p_external_id: null,
          p_amount_clp: null,
          p_raw: tx,
        });
        return json(
          { error: "Webpay rechazó la creación de la transacción" },
          502,
        );
      }
      const { error: updateError } = await db
        .from("payments")
        .update({ external_id: tx.token })
        .eq("id", payment.id);
      if (updateError) throw updateError;
      return json({ url: tx.url, token: tx.token });
    } catch (error) {
      await db.rpc("apply_payment_result", {
        p_payment_id: payment.id,
        p_status: "failed",
        p_external_id: null,
        p_amount_clp: null,
        p_raw: {
          error:
            error instanceof Error ? error.message : "webpay_create_failed",
        },
      });
      throw error;
    }
  } catch (e) {
    console.error(e);
    return json({ error: "Error interno" }, 500);
  }
});
