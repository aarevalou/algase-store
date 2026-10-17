// Crea Checkout Pro con monto y propietario leídos exclusivamente desde la BD.
import { adminClient, cors, json, userClient } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const auth = userClient(req);
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser();
    if (authError || !user)
      return json({ error: "Inicia sesión para pagar" }, 401);

    const body = await req.json();
    if (typeof body.order_id !== "string")
      return json({ error: "Pedido inválido" }, 400);

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    const siteUrl = Deno.env.get("SITE_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!accessToken || !siteUrl || !supabaseUrl)
      return json(
        { error: "Falta configurar Mercado Pago en el servidor" },
        503,
      );

    const db = adminClient();
    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id,user_id,status,total_clp,order_number,contact_email")
      .eq("id", body.order_id)
      .single();
    if (orderError || !order || order.user_id !== user.id)
      return json({ error: "Pedido no encontrado" }, 404);
    if (order.status !== "pending_payment")
      return json({ error: "El pedido no admite pago" }, 409);

    const { data: payment, error: paymentError } = await db
      .from("payments")
      .insert({
        order_id: order.id,
        provider: "mercadopago",
        amount_clp: order.total_clp,
        buy_order:
          `MP-${order.order_number}-${crypto.randomUUID().slice(0, 8)}`.slice(
            0,
            26,
          ),
      })
      .select("id")
      .single();
    if (paymentError) throw paymentError;

    const preferenceResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": payment.id,
        },
        body: JSON.stringify({
          external_reference: payment.id,
          items: [
            {
              id: order.id,
              title: `Pedido Algase #${order.order_number}`,
              quantity: 1,
              currency_id: "CLP",
              unit_price: Number(order.total_clp),
            },
          ],
          payer: { email: order.contact_email },
          back_urls: {
            success: `${siteUrl}/pago/retorno?order_id=${encodeURIComponent(order.id)}`,
            failure: `${siteUrl}/pago/retorno?order_id=${encodeURIComponent(order.id)}`,
            pending: `${siteUrl}/pago/retorno?order_id=${encodeURIComponent(order.id)}`,
          },
          auto_return: "approved",
          notification_url: `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mercadopago-webhook`,
          metadata: { payment_id: payment.id, order_id: order.id },
        }),
      },
    );
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok || !preference.init_point) {
      await db.rpc("apply_payment_result", {
        p_payment_id: payment.id,
        p_status: "failed",
        p_external_id: null,
        p_amount_clp: null,
        p_raw: preference,
      });
      console.error("Mercado Pago preference error", preference);
      return json({ error: "Mercado Pago no pudo iniciar el pago" }, 502);
    }

    const { error: updateError } = await db
      .from("payments")
      .update({
        external_id: preference.id,
        raw_response: { preference_id: preference.id },
      })
      .eq("id", payment.id);
    if (updateError) throw updateError;

    return json({ url: preference.init_point });
  } catch (error) {
    console.error("mercadopago-create failed", error);
    return json({ error: "No se pudo iniciar el pago con Mercado Pago" }, 500);
  }
});
