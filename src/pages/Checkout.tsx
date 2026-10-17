import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  Landmark,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Package,
  WalletCards,
} from "lucide-react";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { formatCLP } from "../lib/format";
import type { LocalOrder } from "../lib/localData";
import {
  createPaidOrder,
  createStoreRequest,
  ensureCheckoutSession,
  getAccountDetails,
  isRemoteStoreEnabled,
  startOnlinePayment,
  type AccountDetails,
} from "../lib/remoteStore";

const emptyCheckoutDetails: AccountDetails = {
  fullName: "",
  phone: "",
  rut: "",
  address: { street: "", number: "", commune: "", region: "" },
};

const schema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre"),
  email: z.string().trim().email("Correo inválido"),
  phone: z
    .string()
    .trim()
    .regex(/^\d{8,10}$/, "Ingresa un teléfono de 8 a 10 números"),
  rut: z.string().trim().refine(isValidRut, "Ingresa un RUT válido"),
  street: z.string().trim().optional(),
  commune: z.string().trim().optional(),
  region: z.string().trim().optional(),
});

function formatRut(value: string): string {
  const cleaned = value
    .replace(/[^0-9k]/gi, "")
    .toUpperCase()
    .slice(0, 9);
  if (cleaned.length < 2) return cleaned;
  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${verifier}`;
}

function isValidRut(value: string): boolean {
  const cleaned = value.replace(/[^0-9k]/gi, "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) return false;
  const body = cleaned.slice(0, -1);
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index--) {
    sum += Number(body[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const remainder = 11 - (sum % 11);
  const verifier =
    remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return cleaned.endsWith(verifier);
}

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const [method, setMethod] = useState<"shipping" | "pickup">("shipping");
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<LocalOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutDetails, setCheckoutDetails] = useState(emptyCheckoutDetails);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "quote" | "transfer" | "webpay" | "mercadopago"
  >("transfer");
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setCheckoutDetails(emptyCheckoutDetails);
      setCheckoutEmail("");
      return;
    }
    setCheckoutEmail(user.email);
    setDetailsLoading(true);
    getAccountDetails(user.id)
      .then((details) => {
        if (active)
          setCheckoutDetails({
            ...details,
            fullName: details.fullName || user.user_metadata.full_name,
          });
      })
      .catch(() => {
        if (active)
          setCheckoutDetails({
            ...emptyCheckoutDetails,
            fullName: user.user_metadata.full_name,
          });
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const createOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const parsed = schema.safeParse(f);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (method === "shipping" && (!f.street || !f.commune || !f.region))
      return setError("Completa la dirección de despacho");
    const savedOrder: LocalOrder = {
      id: crypto.randomUUID(),
      order_number: 0,
      user_id: user?.id ?? "guest",
      status: "pending_confirmation",
      payment_method: paymentMethod === "transfer" ? "transfer" : "quote",
      total_clp: subtotal,
      created_at: new Date().toISOString(),
      contact: {
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        rut: f.rut.trim(),
      },
      fulfillment: method,
      address:
        method === "shipping"
          ? {
              street: [f.street, f.number].filter(Boolean).join(" "),
              commune: f.commune,
              region: f.region,
            }
          : undefined,
      items: lines.map((line) => ({
        product_name: line.productName,
        label: line.label,
        quantity: line.quantity,
        unit_price_clp: line.unitPrice + line.fee,
        customization: line.customization,
      })),
    };
    setSubmitting(true);
    try {
      if (paymentMethod === "webpay" || paymentMethod === "mercadopago") {
        if (!isRemoteStoreEnabled())
          throw new Error(
            "Los pagos en línea aún no están configurados en esta tienda.",
          );

        const checkoutUserId = await ensureCheckoutSession();
        const orderId =
          paidOrderId ??
          (await createPaidOrder({
            userId: checkoutUserId,
            items: lines.map((line) => ({
              variant_id: line.variantId,
              quantity: line.quantity,
              customization: line.customization
                ? {
                    placement: line.customization.placement,
                    text: line.customization.text,
                    notes: line.customization.notes,
                    file_path: line.customization.file_path,
                    design_data_url: line.customization.design_data_url,
                  }
                : null,
            })),
            fulfillment: method,
            address:
              method === "shipping"
                ? {
                    street: f.street.trim(),
                    number: f.number?.trim() ?? "",
                    commune: f.commune.trim(),
                    region: f.region.trim(),
                  }
                : null,
            contact: {
              name: f.name.trim(),
              email: f.email.trim(),
              phone: f.phone.trim(),
              rut: f.rut.trim(),
            },
            idempotencyKey,
          }));
        setPaidOrderId(orderId);
        const payment = await startOnlinePayment(paymentMethod, orderId);
        if (paymentMethod === "webpay") {
          const form = document.createElement("form");
          form.method = "POST";
          form.action = payment.url;
          const tokenInput = document.createElement("input");
          tokenInput.type = "hidden";
          tokenInput.name = "token_ws";
          tokenInput.value = payment.token!;
          form.append(tokenInput);
          document.body.append(form);
          form.submit();
        } else {
          window.location.assign(payment.url);
        }
        return;
      }

      const createdOrder = await createStoreRequest(savedOrder);
      setOrder(createdOrder);
      clear();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar la solicitud. Inténtalo nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (lines.length === 0 && !order) return <p>Tu carrito está vacío.</p>;

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <Link to="/carrito" className="checkout-back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Volver al carrito
        </Link>
        <div className="checkout-header__title">
          <div>
            <p className="checkout-eyebrow">Tu compra</p>
            <h1>Finalizar pedido</h1>
          </div>
          <span className="checkout-secure-label">
            <LockKeyhole size={15} aria-hidden="true" /> Pago seguro
          </span>
        </div>
        <ol className="checkout-progress" aria-label="Etapas de compra">
          <li className="is-current">
            <span>1</span> Datos y entrega
          </li>
          <li className="is-current">
            <span>2</span> Pago
          </li>
          <li>
            <span>3</span> Confirmación
          </li>
        </ol>
      </header>
      {error && (
        <div role="alert" className="checkout-error">
          <p>{error}</p>
          {paymentMethod !== "quote" && paidOrderId && (
            <button
              type="button"
              className="alg-mt-3 alg-text-sm alg-underline alg-underline-offset-4"
              onClick={() => {
                setPaidOrderId(null);
                setIdempotencyKey(crypto.randomUUID());
                setError(null);
              }}>
              Crear un pedido nuevo e intentar otra vez
            </button>
          )}
        </div>
      )}
      {!order && authLoading ? (
        <p role="status" className="alg-text-white-2f-70">
          Comprobando tu sesión…
        </p>
      ) : !order ? (
        <form onSubmit={createOrder} className="checkout-layout">
          <div className="checkout-details">
            <section
              className="checkout-section"
              aria-labelledby="contact-title">
              <div className="checkout-section__heading">
                <span>01</span>
                <div>
                  <h2 id="contact-title">Datos de contacto</h2>
                  <p>Usaremos estos datos para coordinar tu pedido.</p>
                </div>
              </div>
              <div className="checkout-fields-grid">
                <div className="checkout-field">
                  <label htmlFor="name">Nombre completo</label>
                  <input
                    id="name"
                    name="name"
                    value={checkoutDetails.fullName}
                    onChange={(event) =>
                      setCheckoutDetails((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    className="checkout-input"
                    required
                    autoComplete={user ? "name" : "off"}
                    disabled={detailsLoading}
                  />
                </div>
                <div className="checkout-field">
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={checkoutEmail}
                    onChange={(event) => setCheckoutEmail(event.target.value)}
                    className="checkout-input"
                    required
                    autoComplete={user ? "email" : "off"}
                    readOnly={Boolean(user)}
                  />
                </div>
                <div className="checkout-field">
                  <label htmlFor="rut">RUT</label>
                  <input
                    id="rut"
                    name="rut"
                    value={formatRut(checkoutDetails.rut)}
                    onChange={(event) =>
                      setCheckoutDetails((current) => ({
                        ...current,
                        rut: formatRut(event.target.value),
                      }))
                    }
                    autoComplete="off"
                    placeholder="12.345.678-9"
                    className="checkout-input"
                    inputMode="text"
                    maxLength={12}
                    aria-describedby="rut-hint"
                    required
                    disabled={detailsLoading}
                  />
                  <small id="rut-hint" className="checkout-field-hint">
                    Hasta 8 dígitos y dígito verificador.
                  </small>
                </div>
                <div className="checkout-field">
                  <label htmlFor="phone">Teléfono</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{8,10}"
                    aria-describedby="phone-hint"
                    autoComplete={user ? "tel" : "off"}
                    value={checkoutDetails.phone
                      .replace(/\D/g, "")
                      .slice(0, 10)}
                    onChange={(event) =>
                      setCheckoutDetails((current) => ({
                        ...current,
                        phone: event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10),
                      }))
                    }
                    className="checkout-input"
                    required
                    disabled={detailsLoading}
                  />
                  <small id="phone-hint" className="checkout-field-hint">
                    Solo números, máximo 10 dígitos.
                  </small>
                </div>
              </div>
            </section>

            <section
              className="checkout-section"
              aria-labelledby="delivery-title">
              <div className="checkout-section__heading">
                <span>02</span>
                <div>
                  <h2 id="delivery-title">Entrega</h2>
                  <p>El costo y plazo se confirman según tu ubicación.</p>
                </div>
              </div>
              <div className="checkout-delivery-options">
                <label
                  className={`checkout-delivery-option${method === "shipping" ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={method === "shipping"}
                    onChange={() => setMethod("shipping")}
                  />
                  <Package size={19} aria-hidden="true" />
                  <span>
                    <strong>Despacho</strong>
                    <small>A domicilio</small>
                  </span>
                </label>
                <label
                  className={`checkout-delivery-option${method === "pickup" ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={method === "pickup"}
                    onChange={() => setMethod("pickup")}
                  />
                  <MapPin size={19} aria-hidden="true" />
                  <span>
                    <strong>Retiro</strong>
                    <small>Coordinar con Algase</small>
                  </span>
                </label>
              </div>
              {method === "shipping" && (
                <div className="checkout-fields-grid checkout-address-grid">
                  <div className="checkout-field checkout-field--wide">
                    <label htmlFor="street">Calle</label>
                    <input
                      id="street"
                      name="street"
                      autoComplete={user ? "address-line1" : "off"}
                      value={checkoutDetails.address.street}
                      onChange={(event) =>
                        setCheckoutDetails((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            street: event.target.value,
                          },
                        }))
                      }
                      className="checkout-input"
                      required
                      disabled={detailsLoading}
                    />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="number">Número / depto.</label>
                    <input
                      id="number"
                      name="number"
                      autoComplete={user ? "address-line2" : "off"}
                      value={checkoutDetails.address.number}
                      onChange={(event) =>
                        setCheckoutDetails((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            number: event.target.value,
                          },
                        }))
                      }
                      className="checkout-input"
                      disabled={detailsLoading}
                    />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="commune">Comuna</label>
                    <input
                      id="commune"
                      name="commune"
                      autoComplete={user ? "address-level2" : "off"}
                      value={checkoutDetails.address.commune}
                      onChange={(event) =>
                        setCheckoutDetails((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            commune: event.target.value,
                          },
                        }))
                      }
                      className="checkout-input"
                      required
                      disabled={detailsLoading}
                    />
                  </div>
                  <div className="checkout-field checkout-field--wide">
                    <label htmlFor="region">Región</label>
                    <input
                      id="region"
                      name="region"
                      autoComplete={user ? "address-level1" : "off"}
                      value={checkoutDetails.address.region}
                      onChange={(event) =>
                        setCheckoutDetails((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            region: event.target.value,
                          },
                        }))
                      }
                      className="checkout-input"
                      required
                      disabled={detailsLoading}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="checkout-sidebar">
            <section
              className="checkout-order-summary"
              aria-labelledby="order-summary-title">
              <div className="checkout-aside-heading">
                <div>
                  <p>Resumen</p>
                  <h2 id="order-summary-title">Tu pedido</h2>
                </div>
                <span>
                  {(() => {
                    const itemCount = lines.reduce(
                      (total, line) => total + line.quantity,
                      0,
                    );
                    return `${itemCount} ${itemCount === 1 ? "artículo" : "artículos"}`;
                  })()}
                </span>
              </div>
              <ul className="checkout-order-lines">
                {lines.map((line) => (
                  <li key={line.lineId ?? line.variantId}>
                    <div>
                      <strong>{line.productName}</strong>
                      <span>
                        {line.label} · Cantidad {line.quantity}
                      </span>
                    </div>
                    <b>
                      {formatCLP((line.unitPrice + line.fee) * line.quantity)}
                    </b>
                  </li>
                ))}
              </ul>
              <dl className="checkout-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatCLP(subtotal)}</dd>
                </div>
                <div>
                  <dt>{method === "shipping" ? "Despacho" : "Entrega"}</dt>
                  <dd>{method === "shipping" ? "Por confirmar" : "Retiro"}</dd>
                </div>
                <div className="checkout-totals__total">
                  <dt>Total de referencia</dt>
                  <dd>{formatCLP(subtotal)}</dd>
                </div>
              </dl>
              <p className="checkout-summary-note">
                El monto final y la disponibilidad se confirmarán antes de
                procesar el pago.
              </p>
            </section>

            <section
              className="checkout-payment-panel"
              aria-labelledby="payment-title">
              <div className="checkout-aside-heading checkout-aside-heading--payment">
                <div>
                  <p>Elige cómo pagar</p>
                  <h2 id="payment-title">Método de pago</h2>
                </div>
              </div>
              <fieldset className="checkout-payment-list">
                <legend className="sr-only">Método de pago</legend>
                <label
                  className={`checkout-payment-option${paymentMethod === "transfer" ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "transfer"}
                    onChange={() => setPaymentMethod("transfer")}
                  />
                  <Landmark size={20} aria-hidden="true" />
                  <span>
                    <strong>Transferencia electrónica</strong>
                    <small>
                      Algase confirmará el pago por tus medios de contacto
                    </small>
                  </span>
                  {paymentMethod === "transfer" && (
                    <CheckCircle2
                      className="checkout-payment-check"
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                </label>
                <label
                  className="checkout-payment-option is-unavailable"
                  tabIndex={0}
                  role="group"
                  aria-label="WebPay. No disponible aún">
                  <input
                    type="radio"
                    name="payment-method"
                    disabled
                    aria-describedby="webpay-unavailable"
                  />
                  <CreditCard size={20} aria-hidden="true" />
                  <span>
                    <strong>WebPay</strong>
                    <small>Tarjetas y medios habilitados por Transbank</small>
                  </span>
                  <span
                    className="checkout-unavailable-tooltip"
                    id="webpay-unavailable"
                    role="tooltip">
                    <Ban size={16} aria-hidden="true" />
                    <strong>NO DISPONIBLE AÚN</strong>
                  </span>
                </label>
                <label
                  className="checkout-payment-option is-unavailable"
                  tabIndex={0}
                  role="group"
                  aria-label="Mercado Pago. No disponible aún">
                  <input
                    type="radio"
                    name="payment-method"
                    disabled
                    aria-describedby="mercadopago-unavailable"
                  />
                  <WalletCards size={20} aria-hidden="true" />
                  <span>
                    <strong>Mercado Pago</strong>
                    <small>Paga en Checkout Pro</small>
                  </span>
                  <span
                    className="checkout-unavailable-tooltip"
                    id="mercadopago-unavailable"
                    role="tooltip">
                    <Ban size={16} aria-hidden="true" />
                    <strong>NO DISPONIBLE AÚN</strong>
                  </span>
                </label>
                <label
                  className={`checkout-payment-option${paymentMethod === "quote" ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "quote"}
                    onChange={() => setPaymentMethod("quote")}
                  />
                  <MessageCircle size={20} aria-hidden="true" />
                  <span>
                    <strong>Coordinar con Algase</strong>
                    <small>
                      Efectivo o transferencia al momento de la entrega
                    </small>
                  </span>
                  {paymentMethod === "quote" && (
                    <CheckCircle2
                      className="checkout-payment-check"
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                </label>
              </fieldset>
              <p className="checkout-payment-message">
                {paymentMethod === "quote"
                  ? `La solicitud ${isRemoteStoreEnabled() ? "se enviará a Algase" : "quedará guardada en este navegador"}; no procesa pagos.`
                  : paymentMethod === "transfer"
                    ? "La solicitud quedará pendiente. Algase confirmará disponibilidad, despacho y monto final antes de que realices la transferencia."
                    : "El pedido se crea con los precios e inventario vigentes. La confirmación se completa en la plataforma de pago."}
              </p>
              <button className="checkout-submit" disabled={submitting}>
                {submitting
                  ? paymentMethod === "webpay" ||
                    paymentMethod === "mercadopago"
                    ? "Conectando con el medio de pago…"
                    : "Registrando solicitud…"
                  : paymentMethod === "quote"
                    ? "Enviar solicitud"
                    : paymentMethod === "transfer"
                      ? "Continuar con transferencia"
                      : `Pagar con ${paymentMethod === "webpay" ? "WebPay" : "Mercado Pago"}`}
              </button>
              <p className="checkout-secure-note">
                <LockKeyhole size={14} aria-hidden="true" /> Tus datos se usan
                solo para gestionar esta compra.
              </p>
            </section>
          </aside>
        </form>
      ) : (
        <div className="checkout-confirmation">
          <h2 className="alg-text-3xl">
            {order.payment_method === "transfer"
              ? "Solicitud de transferencia registrada"
              : "Solicitud registrada"}
          </h2>
          <p>
            Referencia {isRemoteStoreEnabled() ? "#" : "local #"}
            {order.order_number}.{" "}
            {isRemoteStoreEnabled()
              ? "Algase recibió la solicitud para revisar disponibilidad, despacho y precio final."
              : "La solicitud quedó guardada en este navegador."}
          </p>
          {order.payment_method === "transfer" ? (
            <TransferInstructions order={order} />
          ) : (
            <p className="alg-text-white-2f-70">
              Puedes pagar en efectivo o por transferencia cuando retires en
              persona o en el lugar de entrega acordado con Algase.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TransferInstructions({ order }: { order: LocalOrder }) {
  return (
    <section className="checkout-transfer" aria-labelledby="transfer-title">
      <h3 id="transfer-title">Datos para la transferencia</h3>
      <dl>
        <div>
          <dt>Nombre</dt>
          <dd>Danitza Arlen Carrillo Rubilar</dd>
        </div>
        <div>
          <dt>RUT</dt>
          <dd>13.495.653-4</dd>
        </div>
        <div>
          <dt>Banco</dt>
          <dd>Banco Estado</dd>
        </div>
        <div>
          <dt>Tipo de cuenta</dt>
          <dd>Cuenta RUT</dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>confeccionesalgase@gmail.com</dd>
        </div>
      </dl>
      <p>
        Indica la solicitud <strong>#{order.order_number}</strong> como
        referencia. Una vez realizada la transferencia, Algase confirmará la
        recepción del pago por tus medios de contacto: {order.contact.email}
        {order.contact.phone ? ` o ${order.contact.phone}` : ""}.
      </p>
    </section>
  );
}
