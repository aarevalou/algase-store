import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { fetchContact } from "../lib/api";
import type { SiteContact } from "../types/db";

const TITLES: Record<string, string> = {
  nosotros: "Sobre Algase",
  contacto: "Contacto",
  "preguntas-frecuentes": "Preguntas frecuentes",
  despacho: "Despacho",
  retiro: "Retiro",
  privacidad: "Privacidad",
  terminos: "Términos de compra",
  "cambios-y-devoluciones": "Cambios y devoluciones",
};

const FAQ_GROUPS = {
  nosotros: {
    label: "Nosotros",
    items: [
      [
        "¿Qué productos puedo personalizar?",
        "Realizamos los siguientes productos personalizados: poleras, polerones, buzos, shorts, delantales, gorras, mochilas para niños, tazones, botellas, mousepads, officepads, llaveros, choperos, laminas de azúcar, stickers, y otros.",
      ],
      [
        "¿Puedo enviar mi propio diseño?",
        "Sí. En la ficha del producto activa “Quiero personalizarlo”, carga una imagen y ubícala en la vista previa. La imagen es una referencia; Algase debe confirmar que el archivo y la técnica sean adecuados.",
      ],
      [
        "¿Cómo elijo talla y color?",
        "Selecciona la talla o formato y el color en la ficha del producto. Las opciones y la disponibilidad se confirman directamente con Algase antes de producir.",
      ],
    ],
  },
  pago: {
    label: "Pago",
    items: [
      [
        "¿Puedo pagar directamente en el sitio?",
        "Cuando la tienda tenga configuradas y habilitadas sus credenciales de pago, podrás pagar con Webpay o Mercado Pago. También puedes enviar una solicitud para coordinar el pago directamente con Algase.",
      ],
      [
        "¿El precio incluye el estampado?",
        "El precio publicado es de referencia para el producto y su variante. Algase debe confirmar cualquier costo de personalización, el total final y el despacho antes de que pagues.",
      ],
      [
        "¿Cuándo queda confirmado mi pedido?",
        "Enviar una consulta o guardar una solicitud local no confirma la compra ni reserva stock. El pedido queda acordado cuando Algase confirma contigo disponibilidad, precio y forma de pago.",
      ],
    ],
  },
  envios: {
    label: "Envíos",
    items: [
      [
        "¿Cuánto cuesta el envío y cuánto demora?",
        "El costo de despacho en Santiago tiene un valor fijo de 3,000 CLP. Para otras comunas y regiones, Algase confirmará el costo y el plazo.",
      ],
      [
        "¿Puedo retirar mi pedido?",
        "Sí, puedes consultar por retiro en Las Cruces 2179, Puente Alto. Coordina antes la visita y confirma que el pedido esté listo. Horario de referencia: lunes a sábado, 10:00 a 20:00 hrs.",
      ],
      [
        "¿Qué dirección debo indicar para despacho?",
        "Si solicitas despacho, entrega calle y número, comuna, región y un teléfono de contacto. Algase confirmará cobertura, costo y fecha antes de producir o enviar.",
      ],
    ],
  },
} as const;

type FaqTopic = keyof typeof FAQ_GROUPS;

export default function Info({ page }: { page?: string }) {
  const params = useParams();
  const key = page ?? params.page ?? "";
  const [c, setC] = useState<SiteContact | null>(null);
  useEffect(() => {
    fetchContact()
      .then(setC)
      .catch(() => undefined);
  }, []);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [faqTopic, setFaqTopic] = useState<FaqTopic>("nosotros");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const title = TITLES[key];
  if (!title) return <p>Página no encontrada.</p>;
  const whatsapp = c?.whatsapp
    ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`
    : "";

  const submitQuote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!whatsapp) {
      setSubmissionMessage(
        "El contacto por WhatsApp no está configurado. Escríbenos por correo.",
      );
      return;
    }
    const data = new FormData(event.currentTarget);
    const lines = [
      "Hola Algase, quisiera solicitar una cotización.",
      `Nombre: ${String(data.get("name") ?? "").trim()}`,
      `WhatsApp / teléfono: ${String(data.get("phone") ?? "").trim()}`,
      `Correo: ${String(data.get("email") ?? "").trim()}`,
      data.get("company")
        ? `Empresa: ${String(data.get("company")).trim()}`
        : "",
      data.get("quantity")
        ? `Cantidad aproximada: ${String(data.get("quantity")).trim()}`
        : "",
      `Consulta: ${String(data.get("message") ?? "").trim()}`,
      attachmentName
        ? `Adjuntaré este archivo en el chat: ${attachmentName}`
        : "",
    ].filter(Boolean);
    const url = `${whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    const chat = window.open(url, "_blank");
    if (chat) {
      chat.opener = null;
      setWhatsappLink("");
      setSubmissionMessage(
        attachmentName
          ? "WhatsApp se abrió. Adjunta allí el archivo seleccionado para completar tu consulta."
          : "WhatsApp se abrió con los datos de tu consulta.",
      );
    } else {
      setWhatsappLink(url);
      setSubmissionMessage(
        "El navegador bloqueó la pestaña nueva. Continúa por este enlace; tus datos no se guardan en el sitio.",
      );
    }
  };

  const submitHelpQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!whatsapp) {
      setSubmissionMessage(
        "WhatsApp no está configurado. Escríbenos por correo para recibir ayuda.",
      );
      return;
    }
    const data = new FormData(event.currentTarget);
    const text = [
      "Hola Algase, necesito ayuda con una consulta.",
      `Nombre: ${String(data.get("help-name") ?? "").trim()}`,
      `Correo: ${String(data.get("help-email") ?? "").trim()}`,
      data.get("help-phone")
        ? `Teléfono: ${String(data.get("help-phone")).trim()}`
        : "",
      `Consulta: ${String(data.get("help-comment") ?? "").trim()}`,
    ]
      .filter(Boolean)
      .join("\n");
    const url = `${whatsapp}?text=${encodeURIComponent(text)}`;
    const chat = window.open(url, "_blank");
    if (chat) {
      chat.opener = null;
      setWhatsappLink("");
      setSubmissionMessage("WhatsApp se abrió con tu consulta.");
    } else {
      setWhatsappLink(url);
      setSubmissionMessage(
        "El navegador bloqueó la pestaña nueva. Continúa desde este enlace.",
      );
    }
  };

  const selectAttachment = (file?: File) => {
    setAttachmentError("");
    setAttachmentName("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError("El archivo supera el máximo de 5 MB.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !["png", "jpg", "jpeg", "webp", "pdf", "ai", "psd"].includes(extension)
    ) {
      setAttachmentError("Formatos permitidos: imágenes, PDF, AI o PSD.");
      return;
    }
    setAttachmentName(file.name);
  };
  return (
    <article
      className={
        key === "contacto" ||
        key === "preguntas-frecuentes" ||
        key === "nosotros"
          ? "alg-max-w-none"
          : "alg-max-w-3xl"
      }>
      <Helmet>
        <title>{title} | Algase</title>
        <meta
          name="description"
          content={`${title} de Algase: confecciones y estampados personalizados.`}
        />
      </Helmet>
      {key !== "contacto" && key !== "preguntas-frecuentes" && (
        <>
          <p className="alg-text-sm alg-font-bold alg-uppercase alg-text-brand">
            Algase by Danny
          </p>
          <h1 className="alg-mb-8-6d622d38 alg-mt-2 alg-text-5xl">{title}</h1>
        </>
      )}

      {key === "nosotros" && (
        <div className="about-page alg-text-white-2f-80">
          <div className="about-page__copy">
            <p className="about-page__intro">
              Confecciones, estampados y bordados para convertir ideas
              personales y de negocios en prendas y objetos únicos.
            </p>
            <section className="about-page__section">
              <h2>Hecho para personalizar</h2>
              <p>
                En Algase puedes elegir productos, tallas y colores y proponer
                tu propio diseño. Cada solicitud se revisa antes de confirmar
                materiales, técnica, precio final y plazo.
              </p>
            </section>
            <section className="about-page__section">
              <h2>Tu idea, conversada contigo</h2>
              <p>
                El personalizador del catálogo es una herramienta de referencia.
                La impresión real puede variar según el archivo, el color de la
                base y el método de estampado. Coordinamos estos detalles
                directamente contigo antes de producir.
              </p>
            </section>
            <a href="/catalogo" className="alg-btn-primary about-page__link">
              Conocer el catálogo
            </a>
          </div>
          <figure className="about-page__image">
            <img
              src="/images/background-jokey.png"
              alt="Jockey negro con bordado Algase personalizado"
              className="about-page__photo"
            />
          </figure>
        </div>
      )}

      {key === "contacto" && (
        <div className="alg-mt-8 alg-mb-8 alg-w-full">
          <section className="alg-relative alg-isolate alg-border-y alg-border-white-2f-10 alg-bg-ink-900 alg-px-4 alg-py-10 alg-before-3a-absolute alg-before-3a-inset-y-0 alg-before-3a-left-1-2f-2 alg-before-3a--z-10 alg-before-3a-w-screen alg-before-3a--translate-x-1-2f-2 alg-before-3a-bg-ink-900 alg-before-3a-content--5b-27-27-5d alg-sm-3a-py-12">
            <div className="alg-mx-auto alg-max-w-xl">
              <header className="alg-mb-7 alg-text-center">
                <h2 className="alg-mt-2 alg-text-3xl alg-sm-3a-text-4xl">
                  Escríbenos
                </h2>
                <p className="alg-mx-auto alg-mt-3-6d742d33 alg-max-w-md alg-text-sm alg-leading-relaxed alg-text-white-2f-65">
                  Cuéntanos qué necesitas y te responderemos para revisar
                  diseño, cantidades y opciones.
                </p>
              </header>

              <form
                onSubmit={submitQuote}
                className="alg-grid alg-gap-4 alg-border alg-border-white-2f-10 alg-bg-ink-800 alg-p-5 alg-sm-3a-p-7">
                <div className="alg-grid alg-gap-4 alg-sm-3a-grid-cols-2">
                  <div>
                    <label className="alg-label" htmlFor="contact-name">
                      Nombre <span className="alg-text-brand">*</span>
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      className="alg-field"
                      autoComplete="name"
                      required
                      minLength={2}
                    />
                  </div>
                  <div>
                    <label className="alg-label" htmlFor="contact-phone">
                      WhatsApp / teléfono{" "}
                      <span className="alg-text-brand">*</span>
                    </label>
                    <input
                      id="contact-phone"
                      name="phone"
                      className="alg-field"
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={8}
                      placeholder="+56 9 …"
                    />
                  </div>
                  <div>
                    <label className="alg-label" htmlFor="contact-email">
                      Correo <span className="alg-text-brand">*</span>
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      className="alg-field"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div>
                    <label className="alg-label" htmlFor="contact-company">
                      Empresa{" "}
                      <span className="alg-text-white-2f-45">(opcional)</span>
                    </label>
                    <input
                      id="contact-company"
                      name="company"
                      className="alg-field"
                      autoComplete="organization"
                    />
                  </div>
                </div>

                <div>
                  <label className="alg-label" htmlFor="contact-quantity">
                    Cantidad aproximada{" "}
                    <span className="alg-text-white-2f-45">(opcional)</span>
                  </label>
                  <input
                    id="contact-quantity"
                    name="quantity"
                    className="alg-field"
                    type="number"
                    min="1"
                    max="10000"
                    placeholder="Ej.: 25"
                  />
                </div>
                <div>
                  <label className="alg-label" htmlFor="contact-message">
                    ¿En qué te ayudamos?{" "}
                    <span className="alg-text-brand">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    className="alg-field alg-min-h-28 alg-resize-y"
                    required
                    minLength={8}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="alg-label" htmlFor="contact-file">
                    Adjunta tu diseño o logo{" "}
                    <span className="alg-text-white-2f-45">(opcional)</span>
                  </label>
                  <input
                    id="contact-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.pdf,.ai,.psd"
                    onChange={(event) =>
                      selectAttachment(event.target.files?.[0])
                    }
                    className="alg-field alg-file-3a-mr-3 alg-file-3a-border-0 alg-file-3a-bg-brand alg-file-3a-px-3 alg-file-3a-py-2 alg-file-3a-font-bold alg-file-3a-text-white"
                  />
                  <p className="alg-mt-2 alg-text-xs alg-text-white-2f-50">
                    Imágenes, PDF, AI o PSD, hasta 5 MB.
                  </p>
                  {attachmentName && (
                    <p className="alg-mt-2 alg-text-sm alg-text-white-2f-70">
                      Archivo seleccionado: {attachmentName}
                    </p>
                  )}
                  {attachmentError && (
                    <p
                      role="alert"
                      className="alg-mt-2 alg-text-sm alg-text-brand">
                      {attachmentError}
                    </p>
                  )}
                </div>

                <button className="alg-btn-primary alg-w-full">
                  Enviar mensaje por WhatsApp
                </button>
                {submissionMessage && (
                  <p
                    role="status"
                    className="alg-text-center alg-text-sm alg-text-white-2f-70">
                    {submissionMessage}
                    {whatsappLink && (
                      <>
                        {" "}
                        <a
                          className="alg-font-bold alg-text-brand alg-underline alg-underline-offset-4"
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer">
                          Abrir WhatsApp
                        </a>
                      </>
                    )}
                  </p>
                )}
              </form>
            </div>
          </section>

          
        </div>
      )}

      {key === "preguntas-frecuentes" && (
        <div className="alg-grid alg-gap-8 alg-lg-3a-grid-cols--5b-minmax-28-0-2c-1fr-29-_300px-5d alg-lg-3a-gap-12">
          <section aria-labelledby="help-title">
            <p className="alg-text-sm alg-font-bold alg-uppercase alg-text-brand">
              Centro de ayuda
            </p>
            <h1
              id="help-title"
              className="alg-mt-2 alg-break-words alg-text-3xl alg-sm-3a-text-4xl">
              Preguntas frecuentes
            </h1>
            <p className="alg-mt-3-6d742d33 alg-max-w-3xl alg-text-sm alg-leading-relaxed alg-text-white-2f-70">
              Encuentra respuestas sobre productos, pagos y entregas. Si
              necesitas algo más, envíanos tu consulta desde el formulario.
            </p>

            <div
              className="alg-mt-6 alg-grid alg-grid-cols-3 alg-gap-2 alg-border-b alg-border-white-2f-10 alg-pb-5"
              role="tablist"
              aria-label="Temas de ayuda">
              {(Object.keys(FAQ_GROUPS) as FaqTopic[]).map((topic) => (
                <button
                  key={topic}
                  id={`faq-tab-${topic}`}
                  type="button"
                  role="tab"
                  aria-selected={faqTopic === topic}
                  aria-controls="faq-list"
                  onClick={() => {
                    setFaqTopic(topic);
                    setOpenFaq(0);
                  }}
                  className={`${faqTopic === topic ? "alg-btn-primary" : "alg-btn-ghost"} alg-min-w-0 alg-px-2 alg-py-2 alg-text-xs alg-sm-3a-px-5 alg-sm-3a-text-sm`}>
                  {FAQ_GROUPS[topic].label}
                </button>
              ))}
            </div>

            <div
              id="faq-list"
              className="alg-mt-5 alg-grid alg-gap-3"
              role="tabpanel"
              aria-labelledby={`faq-tab-${faqTopic}`}>
              {FAQ_GROUPS[faqTopic].items.map(([question, answer], index) => {
                const expanded = openFaq === index;
                const answerId = `faq-answer-${faqTopic}-${index}`;
                return (
                  <section
                    key={question}
                    className={`alg-border alg-px-4 alg-transition-colors alg-sm-3a-px-5 ${expanded ? "alg-border-brand-2f-60 alg-bg-ink-800" : "alg-border-white-2f-15 alg-bg-transparent alg-hover-3a-border-white-2f-30"}`}>
                    <h2 className="alg-m-0 alg-text-base alg-normal-case alg-tracking-normal">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={answerId}
                        onClick={() => setOpenFaq(expanded ? null : index)}
                        className="alg-flex alg-min-h-14 alg-w-full alg-items-center alg-gap-4 alg-py-3 alg-text-left">
                        <span
                          aria-hidden="true"
                          className={`alg-grid alg-h-7 alg-w-7 alg-shrink-0 alg-place-items-center alg-border alg-text-lg alg-leading-none ${expanded ? "alg-border-brand alg-text-brand" : "alg-border-white-2f-25 alg-text-white-2f-60"}`}>
                          {expanded ? "−" : "+"}
                        </span>
                        <span className="alg-font-bold">{question}</span>
                      </button>
                    </h2>
                    {expanded && (
                      <div
                        id={answerId}
                        className="alg-ml-11 alg-max-w-3xl alg-border-t alg-border-white-2f-10 alg-py-4 alg-text-sm alg-leading-relaxed alg-text-white-2f-70">
                        {answer}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </section>

          <aside
            className="alg-h-fit alg-border alg-border-white-2f-15 alg-bg-ink-800 alg-p-5 alg-sm-3a-p-6 alg-lg-3a-sticky alg-lg-3a-top-28"
            aria-labelledby="help-form-title">
            <div className="alg-mb-5 alg-border-b alg-border-white-2f-10 alg-pb-5">
              <img
                src="/images/logo-letter.png"
                alt="Algase"
                className="alg-h-14 alg-w-14 alg-object-contain"
              />
              <h2 id="help-form-title" className="alg-mt-5 alg-text-xl">
                ¿No encontraste lo que buscabas?
              </h2>
              <p className="alg-mt-2 alg-text-sm alg-text-white-2f-60">
                Cuéntanos tu duda y te ayudaremos por WhatsApp.
              </p>
            </div>
            <form onSubmit={submitHelpQuestion} className="alg-grid alg-gap-3">
              <div>
                <label className="alg-label" htmlFor="help-name">
                  Nombre <span className="alg-text-brand">*</span>
                </label>
                <input
                  id="help-name"
                  name="help-name"
                  className="alg-field"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="help-email">
                  Correo electrónico <span className="alg-text-brand">*</span>
                </label>
                <input
                  id="help-email"
                  name="help-email"
                  type="email"
                  className="alg-field"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="help-phone">
                  Teléfono{" "}
                  <span className="alg-text-white-2f-45">(opcional)</span>
                </label>
                <input
                  id="help-phone"
                  name="help-phone"
                  type="tel"
                  className="alg-field"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="alg-label" htmlFor="help-comment">
                  Comentario <span className="alg-text-brand">*</span>
                </label>
                <textarea
                  id="help-comment"
                  name="help-comment"
                  className="alg-field alg-min-h-24 alg-resize-y"
                  required
                  minLength={5}
                />
              </div>
              <button className="alg-btn-primary alg-mt-1 alg-w-full">
                Enviar consulta
              </button>
              {submissionMessage && (
                <p role="status" className="alg-text-sm alg-text-white-2f-70">
                  {submissionMessage}
                  {whatsappLink && (
                    <>
                      {" "}
                      <a
                        className="alg-font-bold alg-text-brand alg-underline alg-underline-offset-4"
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer">
                        Abrir WhatsApp
                      </a>
                    </>
                  )}
                </p>
              )}
              <p className="alg-text-xs alg-text-white-2f-45">
                El mensaje se prepara en tu dispositivo; no guardamos tus datos
                aquí.
              </p>
            </form>
            {c?.email && (
              <a
                href={`mailto:${c.email}`}
                className="alg-mt-4 alg-inline-block alg-text-sm alg-underline alg-underline-offset-4 alg-hover-3a-text-brand">
                O escríbenos por correo
              </a>
            )}
          </aside>
        </div>
      )}

      {key === "despacho" && (
        <div className="alg-grid alg-gap-6 alg-text-white-2f-75">
          <section className="alg-border-y alg-border-white-2f-15 alg-py-5">
            <h2 className="alg-mb-2 alg-text-2xl">Antes de confirmar</h2>
            <ul className="alg-list-disc alg-space-y-2 alg-pl-5">
              <li>Indica una dirección completa y un teléfono de contacto.</li>
              <li>El costo que aparece en el carrito no incluye despacho.</li>
              <li>
                El sitio todavía no genera etiquetas ni seguimiento automático.
              </li>
            </ul>
          </section>
          {whatsapp && (
            <a
              className="alg-btn-primary alg-justify-self-start"
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer">
              Consultar despacho
            </a>
          )}
        </div>
      )}

      {key === "retiro" && (
        <div className="alg-grid alg-gap-6 alg-text-white-2f-75">
          <p>
            El retiro debe coordinarse con Algase antes de acudir. La dirección,
            horario y confirmación de que el pedido está listo se entregan
            directamente al cliente.
          </p>
          <p className="alg-border-y alg-border-white-2f-15 alg-py-5">
            Seleccionar “Retiro” registra una preferencia; no confirma por sí
            sola fecha ni lugar de entrega.
          </p>
          {whatsapp && (
            <a
              className="alg-btn-primary alg-justify-self-start"
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer">
              Coordinar retiro
            </a>
          )}
        </div>
      )}

      {key === "cambios-y-devoluciones" && (
        <div className="alg-grid alg-gap-5 alg-text-white-2f-75">
          <p>
            Antes de aceptar una solicitud, confirma con Algase las condiciones
            aplicables al producto, especialmente cuando se fabrica o estampa
            con un diseño solicitado por el cliente.
          </p>
          <section className="alg-border-y alg-border-white-2f-15 alg-py-5">
            <h2 className="alg-mb-2 alg-text-2xl">Si hay un problema</h2>
            <p>
              Conserva el comprobante y comunícate indicando el número de
              solicitud, el producto y una descripción del inconveniente. Algase
              revisará el caso y te informará los pasos aplicables conforme a la
              normativa vigente.
            </p>
          </section>
          <p className="alg-text-sm alg-text-white-2f-55">
            Esta información es orientativa y no reemplaza los derechos
            establecidos por la legislación de protección al consumidor.
          </p>
          {whatsapp && (
            <a
              className="alg-btn-ghost alg-justify-self-start"
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer">
              Contactar a Algase
            </a>
          )}
        </div>
      )}

      {key === "privacidad" && (
        <div className="alg-grid alg-gap-5 alg-text-white-2f-75">
          <p>
            En el modo actual la tienda guarda datos de cuenta, carrito y
            solicitudes en el almacenamiento local del navegador. Esos datos no
            se sincronizan ni se envían automáticamente a un servidor.
          </p>
          <section className="alg-border-y alg-border-white-2f-15 alg-py-5">
            <h2 className="alg-mb-2 alg-text-2xl">Qué debes tener en cuenta</h2>
            <ul className="alg-list-disc alg-space-y-2 alg-pl-5">
              <li>
                Quien tenga acceso a este navegador podría ver o modificar los
                datos guardados.
              </li>
              <li>
                Limpiar los datos del sitio puede borrar tu cuenta, carrito e
                historial local.
              </li>
              <li>
                El personalizador procesa las imágenes en el dispositivo y
                guarda una versión optimizada en el navegador.
              </li>
              <li>
                Si decides contactar por WhatsApp o correo, se aplicarán las
                condiciones de esos servicios.
              </li>
            </ul>
          </section>
          <p>
            Al conectar un servicio en línea se deberá publicar una política
            actualizada que identifique al responsable, finalidades,
            conservación y derechos de las personas.
          </p>
        </div>
      )}

      {key === "terminos" && (
        <div className="alg-grid alg-gap-5 alg-text-white-2f-75">
          <p>
            El catálogo y sus precios actuales son informativos. Antes de
            producir, Algase debe confirmar disponibilidad, color, talla,
            diseño, costo final, plazo y forma de entrega.
          </p>
          <section className="alg-border-y alg-border-white-2f-15 alg-py-5">
            <h2 className="alg-mb-2 alg-text-2xl">Solicitudes y pagos</h2>
            <ul className="alg-list-disc alg-space-y-2 alg-pl-5">
              <li>
                Registrar una solicitud en este sitio no crea una compra
                confirmada ni reserva inventario.
              </li>
              <li>
                El sitio no procesa pagos online. No transfieras dinero sin
                confirmar previamente las instrucciones con Algase.
              </li>
              <li>
                La vista previa de estampado es referencial y no garantiza
                reproducción exacta de color o escala.
              </li>
            </ul>
          </section>
          <p>
            Los términos definitivos deben ser revisados y aprobados por el
            negocio antes de aceptar pedidos mediante un servicio en línea.
          </p>
        </div>
      )}
    </article>
  );
}
