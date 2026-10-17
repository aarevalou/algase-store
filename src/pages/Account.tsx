import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  CircleUserRound,
  LogOut,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatCLP, formatDateCL, ORDER_STATUS_LABEL } from "../lib/format";
import type { LocalOrder } from "../lib/localData";
import {
  getAccountDetails,
  getStoreRequests,
  isRemoteStoreEnabled,
  saveAccountDetails,
  type AccountDetails,
} from "../lib/remoteStore";

const emptyAccountDetails: AccountDetails = {
  fullName: "",
  phone: "",
  rut: "",
  address: { street: "", number: "", commune: "", region: "" },
};

export default function Account() {
  const { user, isAdmin, signOut, updateProfile, deleteAccount } = useAuth();
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [profileMessage, setProfileMessage] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [accountDetails, setAccountDetails] = useState(emptyAccountDetails);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const userId = user?.id;
  useEffect(() => {
    let active = true;
    if (!userId || !user) {
      setOrdersLoading(false);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    getAccountDetails(userId)
      .then((details) => {
        if (active)
          setAccountDetails({
            ...details,
            fullName: details.fullName || user.user_metadata.full_name,
          });
      })
      .catch((error: unknown) => {
        if (active)
          setProfileMessage(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar tus datos.",
          );
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    setOrdersLoading(true);
    setOrdersError("");
    getStoreRequests()
      .then((requests) => {
        if (active)
          setOrders(requests.filter((order) => order.user_id === userId));
      })
      .catch((error: unknown) => {
        if (active) {
          setOrders([]);
          setOrdersError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar tus solicitudes.",
          );
        }
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const details: AccountDetails = {
      fullName: String(form.get("fullName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      rut: String(form.get("rut") ?? "").trim(),
      address: {
        street: String(form.get("street") ?? "").trim(),
        number: String(form.get("number") ?? "").trim(),
        commune: String(form.get("commune") ?? "").trim(),
        region: String(form.get("region") ?? "").trim(),
      },
    };
    const addressValues = Object.values(details.address);
    const hasAddress = addressValues.some(Boolean);
    if (
      hasAddress &&
      (!details.address.street ||
        !details.address.commune ||
        !details.address.region)
    ) {
      setProfileMessage(
        "Completa calle, comuna y región, o deja toda la dirección vacía.",
      );
      return;
    }
    setProfileSaving(true);
    setProfileMessage("");
    try {
      const profileError = await updateProfile(details.fullName);
      if (profileError) throw new Error(profileError);
      await saveAccountDetails(user!.id, details);
      setAccountDetails(details);
      setProfileMessage(
        "Datos personales y dirección predeterminada guardados.",
      );
    } catch (error) {
      setProfileMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar tus datos.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const removeAccount = async () => {
    if (
      !window.confirm(
        "Se eliminarán de este navegador la cuenta local y sus solicitudes. Esta acción no se puede deshacer. ¿Continuar?",
      )
    )
      return;
    const error = await deleteAccount();
    if (error) setProfileMessage(error);
  };

  return (
    <div className="account-page">
      <header className="account-header">
        <div>
          <p className="account-header__eyebrow">
            {isAdmin ? "Administración" : "Espacio personal"}
          </p>
          <h1>Mi cuenta</h1>
          <p className="account-header__email">{user?.email}</p>
        </div>
        <div className="account-header__actions">
          <span className="account-role">
            {isAdmin ? (
              <ShieldCheck size={15} aria-hidden="true" />
            ) : (
              <CircleUserRound size={15} aria-hidden="true" />
            )}
            {isAdmin ? "Administrador" : "Cliente"}
          </span>
        </div>
      </header>

      <div className="account-layout">
        <section
          className="account-panel"
          aria-labelledby="account-profile-title">
          <header className="account-panel__heading">
            <span className="account-panel__icon">
              <CircleUserRound size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="account-profile-title">Mis datos</h2>
            </div>
          </header>
          <form onSubmit={saveProfile} className="account-form">
            <div className="account-form__identity">
              <div>
                <label className="alg-label" htmlFor="profile-name">
                  Nombre
                </label>
                <input
                  id="profile-name"
                  name="fullName"
                  className="alg-field"
                  value={accountDetails.fullName}
                  onChange={(event) =>
                    setAccountDetails((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  required
                  minLength={2}
                  disabled={profileLoading || profileSaving}
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="profile-phone">
                  Teléfono
                </label>
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="alg-field"
                  value={accountDetails.phone}
                  onChange={(event) =>
                    setAccountDetails((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  disabled={profileLoading || profileSaving}
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="profile-rut">
                  RUT
                </label>
                <input
                  id="profile-rut"
                  name="rut"
                  autoComplete="off"
                  className="alg-field"
                  placeholder="12.345.678-9"
                  value={accountDetails.rut}
                  onChange={(event) =>
                    setAccountDetails((current) => ({
                      ...current,
                      rut: event.target.value,
                    }))
                  }
                  disabled={profileLoading || profileSaving}
                />
              </div>
            </div>
            <details className="account-address">
              <summary>Dirección predeterminada</summary>
              <fieldset className="account-address__fields">
                <div>
                  <label className="alg-label" htmlFor="profile-street">
                    Calle
                  </label>
                  <input
                    id="profile-street"
                    name="street"
                    className="alg-field"
                    autoComplete="address-line1"
                    value={accountDetails.address.street}
                    onChange={(event) =>
                      setAccountDetails((current) => ({
                        ...current,
                        address: {
                          ...current.address,
                          street: event.target.value,
                        },
                      }))
                    }
                    disabled={profileLoading || profileSaving}
                  />
                </div>
                <div>
                  <label className="alg-label" htmlFor="profile-number">
                    Número / depto.
                  </label>
                  <input
                    id="profile-number"
                    name="number"
                    className="alg-field"
                    autoComplete="address-line2"
                    value={accountDetails.address.number}
                    onChange={(event) =>
                      setAccountDetails((current) => ({
                        ...current,
                        address: {
                          ...current.address,
                          number: event.target.value,
                        },
                      }))
                    }
                    disabled={profileLoading || profileSaving}
                  />
                </div>
                <div>
                  <label className="alg-label" htmlFor="profile-commune">
                    Comuna
                  </label>
                  <input
                    id="profile-commune"
                    name="commune"
                    className="alg-field"
                    autoComplete="address-level2"
                    value={accountDetails.address.commune}
                    onChange={(event) =>
                      setAccountDetails((current) => ({
                        ...current,
                        address: {
                          ...current.address,
                          commune: event.target.value,
                        },
                      }))
                    }
                    disabled={profileLoading || profileSaving}
                  />
                </div>
                <div>
                  <label className="alg-label" htmlFor="profile-region">
                    Región
                  </label>
                  <input
                    id="profile-region"
                    name="region"
                    className="alg-field"
                    autoComplete="address-level1"
                    value={accountDetails.address.region}
                    onChange={(event) =>
                      setAccountDetails((current) => ({
                        ...current,
                        address: {
                          ...current.address,
                          region: event.target.value,
                        },
                      }))
                    }
                    disabled={profileLoading || profileSaving}
                  />
                </div>
              </fieldset>
            </details>
            <p className="account-form__note">
              {isRemoteStoreEnabled()
                ? "Tu nombre, teléfono, RUT y dirección predeterminada se guardan en tu perfil."
                : "Este perfil solo se guarda en este navegador."}
            </p>
            <button
              className="account-form__save"
              disabled={profileLoading || profileSaving}>
              <PackageCheck size={16} aria-hidden="true" />
              {profileSaving ? "Guardando…" : "Guardar cambios"}
            </button>
            {profileMessage && (
              <p role="status" className="account-form__message">
                {profileMessage}
              </p>
            )}
          </form>
          <div className="account-panel__footer">
            <button className="account-signout" onClick={signOut}>
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
            {!isRemoteStoreEnabled() && (
              <button className="account-delete" onClick={removeAccount}>
                <Trash2 size={15} aria-hidden="true" />
                Eliminar cuenta local
              </button>
            )}
          </div>
        </section>

        <section
          className="account-requests"
          aria-labelledby="account-requests-title">
          <header className="account-requests__heading">
            <div>
              <p>Actividad</p>
              <h2 id="account-requests-title">Mis solicitudes</h2>
            </div>
            <span className="account-requests__count">{orders.length}</span>
          </header>
          {ordersLoading ? (
            <p className="account-state" role="status">
              Cargando solicitudes…
            </p>
          ) : ordersError ? (
            <p className="account-state account-state--error" role="alert">
              {ordersError}
            </p>
          ) : orders.length === 0 ? (
            <div className="account-empty">
              <ShoppingBag size={24} aria-hidden="true" />
              <h3>Aún no tienes solicitudes</h3>
              <p>
                Cuando envíes una cotización, podrás revisar aquí sus artículos
                y estado.
              </p>
              <Link to="/catalogo" className="account-empty__link">
                Explorar catálogo <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ul className="account-request-list">
              {orders.map((order) => (
                <li key={order.id} className="account-request">
                  <div className="account-request__summary">
                    <div className="account-request__identity">
                      <span className="account-request__number">
                        #{order.order_number}
                      </span>
                      <time dateTime={order.created_at}>
                        {formatDateCL(order.created_at)}
                      </time>
                    </div>
                    <div className="account-request__amount">
                      <span
                        className={`admin-orders__status admin-orders__status--${order.status}`}>
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      <strong>{formatCLP(order.total_clp)}</strong>
                    </div>
                  </div>
                  <details className="account-request__details">
                    <summary>
                      <span>
                        <ShoppingBag size={15} aria-hidden="true" />{" "}
                        {order.items.length}{" "}
                        {order.items.length === 1 ? "artículo" : "artículos"}
                      </span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="account-request__body">
                      <ul>
                        {order.items.map((item, index) => (
                          <li key={`${order.id}-${index}`}>
                            {item.customization?.design_data_url && (
                              <img
                                src={item.customization.design_data_url}
                                alt="Diseño personalizado"
                              />
                            )}
                            <span>
                              <strong>
                                {item.quantity} × {item.product_name}
                              </strong>
                              <small>
                                {item.label}
                                {item.customization?.text
                                  ? ` · ${item.customization.text}`
                                  : ""}
                              </small>
                            </span>
                            <b>
                              {formatCLP(item.unit_price_clp * item.quantity)}
                            </b>
                          </li>
                        ))}
                      </ul>
                      <p className="account-request__fulfillment">
                        <PackageCheck size={15} aria-hidden="true" />
                        {order.fulfillment === "pickup"
                          ? "Retiro por coordinar"
                          : "Despacho por coordinar"}
                        <span>
                          Total referencial, pendiente de confirmación
                        </span>
                      </p>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="account-disclaimer">
        Las solicitudes son cotizaciones de referencia; disponibilidad, precio
        final, entrega y pago se confirman con Algase.
      </p>
    </div>
  );
}
