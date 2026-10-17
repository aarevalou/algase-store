import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { formatCLP } from "../lib/format";
import { supabase } from "../lib/supabase";

interface PaymentOrder {
  order_number: number;
  total_clp: number;
  status: string;
}

export default function WebpayReturn() {
  const [params] = useSearchParams();
  const { clear } = useCart();
  const { user } = useAuth();
  const orderId = params.get("order_id");
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cartCleared = useRef(false);

  const refreshOrder = useCallback(async () => {
    if (!supabase || !orderId) {
      setError(
        "No pudimos identificar el pedido. Vuelve a la tienda o contacta a Algase con los datos de tu compra.",
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("orders")
      .select("order_number,total_clp,status")
      .eq("id", orderId)
      .single();
    if (queryError || !data) {
      setError(
        "No se pudo consultar el estado del pedido. Espera un momento y vuelve a intentarlo; si el problema continúa, contacta a Algase.",
      );
      setOrder(null);
    } else {
      setOrder({
        order_number: Number(data.order_number),
        total_clp: Number(data.total_clp),
        status: data.status,
      });
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void refreshOrder();
  }, [refreshOrder]);

  const paid = order?.status === "confirmed";
  const cancelled = order?.status === "cancelled";

  useEffect(() => {
    if (paid && !cartCleared.current) {
      cartCleared.current = true;
      clear();
    }
  }, [paid, clear]);

  return (
    <section className="payment-result" aria-live="polite">
      <span
        className={`payment-result__icon ${paid ? "is-paid" : cancelled ? "is-cancelled" : "is-pending"}`}>
        {paid ? (
          <CheckCircle2 size={28} aria-hidden="true" />
        ) : cancelled ? (
          <XCircle size={28} aria-hidden="true" />
        ) : (
          <Clock3 size={28} aria-hidden="true" />
        )}
      </span>
      <p className="payment-result__eyebrow">Estado del pago</p>
      <h1>
        {loading
          ? "Verificando pago…"
          : paid
            ? "Pago confirmado"
            : cancelled
              ? "Pago no completado"
              : "Pago en proceso"}
      </h1>
      {order && (
        <p className="payment-result__reference">
          Pedido #{order.order_number} · {formatCLP(order.total_clp)}
        </p>
      )}
      <p className="payment-result__message">
        {loading
          ? "Estamos consultando el estado confirmado por el proveedor de pago."
          : error
            ? error
            : paid
              ? "El pago fue confirmado y el pedido quedó registrado."
              : cancelled
                ? "El pago no se completó y el pedido fue cancelado. Si deseas comprar, vuelve al catálogo y crea un pedido nuevo."
                : "El proveedor aún no confirma el resultado. No vuelvas a pagar hasta revisar el estado actualizado."}
      </p>
      {!loading && !paid && !cancelled && order && (
        <button
          type="button"
          className="alg-btn-ghost"
          onClick={() => void refreshOrder()}>
          Consultar estado nuevamente
        </button>
      )}
      <Link to={user ? "/cuenta" : "/catalogo"} className="alg-btn-primary">
        {user ? "Ir a mi cuenta" : "Volver a la tienda"}
      </Link>
    </section>
  );
}
