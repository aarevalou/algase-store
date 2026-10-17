// Transbank devuelve el navegador mediante POST. Solo el commit servidor valida el pago.
import { adminClient, cors, json } from "../_shared/clients.ts";

const HOST =
  Deno.env.get("WEBPAY_ENV") === "production"
    ? "https://webpay3g.transbank.cl"
    : "https://webpay3gint.transbank.cl";
const BASE = `${HOST}/rswebpaytransaction/api/webpay/v1.2`;

function redirect(siteUrl: string, status: string, orderId?: string) {
  const url = new URL("/pago/retorno", siteUrl);
  url.searchParams.set("status", status);
  if (orderId) url.searchParams.set("order_id", orderId);
  return new Response(null, {
    status: 303,
    headers: { ...cors, Location: url.toString() },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const siteUrl = Deno.env.get("SITE_URL");
  if (!siteUrl) return json({ error: "Falta configurar SITE_URL" }, 503);

  try {
    let tokenWs: string | null = null;
    let abortedToken: string | null = null;
    const contentType = req.headers.get("content-type") ?? "";
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await req.formData();
      tokenWs = String(form.get("token_ws") ?? "") || null;
      abortedToken = String(form.get("TBK_TOKEN") ?? "") || null;
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      tokenWs = typeof body.token_ws === "string" ? body.token_ws : null;
      abortedToken = typeof body.TBK_TOKEN === "string" ? body.TBK_TOKEN : null;
    }

    const token = tokenWs ?? abortedToken;
    if (!token) return redirect(siteUrl, "invalid");

    const db = adminClient();
    const { data: payment, error: paymentError } = await db
      .from("payments")
      .select("id,order_id,status,external_id")
      .eq("provider", "webpay")
      .eq("external_id", token)
      .single();
    if (paymentError || !payment) return redirect(siteUrl, "not_found");
    if (payment.status !== "pending")
      return redirect(siteUrl, payment.status, payment.order_id);

    if (!tokenWs) {
      await db.rpc("apply_payment_result", {
        p_payment_id: payment.id,
        p_status: "cancelled",
        p_external_id: token,
        p_amount_clp: null,
        p_raw: { aborted: true },
      });
      return redirect(siteUrl, "cancelled", payment.order_id);
    }

    const commerceCode = Deno.env.get("WEBPAY_COMMERCE_CODE");
    const apiKey = Deno.env.get("WEBPAY_API_KEY");
    if (!commerceCode || !apiKey)
      return redirect(siteUrl, "verification_error", payment.order_id);

    const response = await fetch(
      `${BASE}/transactions/${encodeURIComponent(tokenWs)}`,
      {
        method: "PUT",
        headers: {
          "Tbk-Api-Key-Id": commerceCode,
          "Tbk-Api-Key-Secret": apiKey,
          "Content-Type": "application/json",
        },
      },
    );
    const transaction = await response.json();
    const approved =
      response.ok &&
      transaction.status === "AUTHORIZED" &&
      transaction.response_code === 0;
    await db.rpc("apply_payment_result", {
      p_payment_id: payment.id,
      p_status: approved ? "paid" : "failed",
      p_external_id: tokenWs,
      p_amount_clp: approved ? transaction.amount : null,
      p_raw: transaction,
    });
    return redirect(siteUrl, approved ? "paid" : "failed", payment.order_id);
  } catch (error) {
    console.error("webpay-commit failed", error);
    return redirect(siteUrl, "verification_error");
  }
});
