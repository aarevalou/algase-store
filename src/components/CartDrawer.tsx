import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { formatCLP } from '../lib/format'

export default function CartDrawer() {
  const { lines, subtotal, isOpen, close, setQuantity, remove } = useCart()
  const [isMounted, setIsMounted] = useState(isOpen)

  useEffect(() => {
    let closeTimer: number | undefined
    if (isOpen) {
      setIsMounted(true)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      closeTimer = window.setTimeout(() => setIsMounted(false), 220)
    }
    return () => {
      window.clearTimeout(closeTimer)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, close])

  if (!isMounted) return null

  return (
    <div className={`cart-drawer ${isOpen ? 'is-open' : 'is-closing'}`} role="presentation" aria-hidden={!isOpen}>
      <button aria-label="Cerrar carrito" className="cart-drawer__backdrop" onClick={close} tabIndex={isOpen ? 0 : -1} />
      <section role="dialog" aria-modal={isOpen} aria-labelledby="cart-title" className="cart-drawer__panel">
        <header className="cart-drawer__header">
          <div>
            <h2 id="cart-title" className="cart-drawer__title">Tu carrito</h2>
            <p className="cart-drawer__count">{lines.reduce((total, line) => total + line.quantity, 0)} artículos</p>
          </div>
          <button type="button" onClick={close} className="btn btn--ghost btn--small" aria-label="Cerrar carrito">Cerrar</button>
        </header>

        {lines.length === 0 ? (
          <div className="cart-drawer__empty">
            <p>Todavía no agregas productos.</p>
            <Link to="/catalogo" onClick={close} className="btn btn--primary">Explorar catálogo</Link>
          </div>
        ) : (
          <>
            <ul className="cart-drawer__list">
              {lines.map((line) => (
                <li key={line.lineId ?? line.variantId} className="cart-drawer__item">
                  {line.customization?.design_data_url ? <img src={line.customization.design_data_url} alt="Vista previa del diseño" className="cart-drawer__thumb" /> : <div className="cart-drawer__thumb cart-drawer__thumb--placeholder">ALGASE</div>}
                  <div className="cart-drawer__details">
                    <p className="cart-drawer__product-name">{line.productName}</p>
                    <p className="cart-drawer__meta">{line.label}{line.customization?.placement || line.customization?.text || line.customization?.notes || line.customization?.design_data_url ? ' · Personalizado' : ''}</p>
                    <p className="cart-drawer__price">{formatCLP((line.unitPrice + line.fee) * line.quantity)}</p>
                    <div className="cart-drawer__controls">
                      <label className="sr-only" htmlFor={`drawer-qty-${line.lineId ?? line.variantId}`}>Cantidad</label>
                      <input id={`drawer-qty-${line.lineId ?? line.variantId}`} type="number" min={1} max={50} value={line.quantity} onChange={(event) => setQuantity(line.lineId ?? line.variantId, Number(event.target.value) || 1)} className="field field--compact" />
                      <button type="button" className="cart-drawer__remove" onClick={() => remove(line.lineId ?? line.variantId)}>Quitar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="cart-drawer__footer">
              <div className="cart-drawer__subtotal"><span>Subtotal de referencia</span><span className="cart-drawer__subtotal-value">{formatCLP(subtotal)}</span></div>
              <p className="cart-drawer__note">Disponibilidad, despacho y pago se coordinan antes de confirmar.</p>
              <Link to="/checkout" onClick={close} className="btn btn--primary btn--block">Continuar con la solicitud</Link>
              <Link to="/carrito" onClick={close} className="cart-drawer__link">Ver carrito completo</Link>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}