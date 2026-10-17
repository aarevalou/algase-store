// Verifica firma y estado consultando la API de Mercado Pago antes de aplicar el pago.
import { adminClient, cors, json } from "../_shared/clients.ts";

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifySignature(
  req: Request,
  paymentId: string,
  secret: string,
): Promise<boolean> {
  const signature = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  if (!parts.ts || !parts.v1 || !requestId) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)),
  );
  return constantTimeEqual(hex(digest), parts.v1.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST" && req.method !== "GET")
    return json({ error: "Método no permitido" }, 405);

  try {
    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET");
    if (!accessToken || !webhookSecret)
      return json({ error: "Webhook no configurado" }, 503);

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === "POST") body = await req.json().catch(() => ({}));
    const paymentId = String(
      url.searchParams.get("data.id") ??
        url.searchParams.get("id") ??
        (body.data as Record<string, unknown> | undefined)?.id ??
        "",
    );
    if (!paymentId || !/^\d+$/.test(paymentId))
      return json({ error: "ID de pago inválido" }, 400);
    if (!(await verifySignature(req, paymentId, webhookSecret)))
      return json({ error: "Firma de webhook inválida" }, 401);

    const apiResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const transaction = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error(
        "Mercado Pago payment lookup failed",
        apiResponse.status,
        transaction,
      );
      return json(
        { error: "No se pudo verificar el pago con Mercado Pago" },
        502,
      );
    }

    const paymentIdRef = String(transaction.external_reference ?? "");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        paymentIdRef,
      )
    )
      return json({ error: "Referencia de pago inválida" }, 400);

    const db = adminClient();
    const { data: payment, error: paymentError } = await db
      .from("payments")
      .select("*")
      .eq("id", paymentIdRef)
      .eq("provider", "mercadopago")
      .single();
    if (paymentError || !payment)
      return json({ error: "Pago no encontrado" }, 404);

    const eventId = `${paymentId}:${String(transaction.status ?? "unknown")}`;
    const { error: eventError } = await db.from("payment_events").insert({
      provider: "mercadopago",
      event_id: eventId,
      payload: {
        notification_type: body.type ?? url.searchParams.get("type"),
        payment_id: paymentId,
      },
    });
    if (eventError && eventError.code !== "23505") throw eventError;

    const status =
      transaction.status === "approved"
        ? "paid"
        : transaction.status === "rejected"
          ? "failed"
          : transaction.status === "cancelled"
            ? "cancelled"
            : null;
    if (!status)
      return json({ received: true, status: transaction.status ?? "pending" });

    if (
      status === "paid" &&
      (transaction.currency_id !== "CLP" ||
        Number(transaction.transaction_amount) !== Number(payment.amount_clp))
    ) {
      console.error("Mercado Pago amount mismatch", payment.id);
      return json(
        { error: "El monto confirmado no coincide con el pedido" },
        409,
      );
    }

    const { error: applyError } = await db.rpc("apply_payment_result", {
      p_payment_id: payment.id,
      p_status: status,
      p_external_id: paymentId,
      p_amount_clp:
        status === "paid" ? Number(transaction.transaction_amount) : null,
      p_raw: transaction,
    });
    if (applyError) throw applyError;
    return json({ received: true, status });
  } catch (error) {
    console.error("mercadopago-webhook failed", error);
    return json({ error: "Error procesando la notificación" }, 500);
  }
});
