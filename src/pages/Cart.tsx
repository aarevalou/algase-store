import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { formatCLP } from '../lib/format'

export default function Cart() {
  const { lines, subtotal, setQuantity, remove } = useCart()
  if (lines.length === 0) return <div><h1 className="alg-text-5xl">Carrito</h1><p className="alg-mt-4">Tu carrito está vacío.</p><Link to="/catalogo" className="alg-btn-primary alg-mt-6">Ver catálogo</Link></div>
  return (
    <div>
      <h1 className="alg-mb-6 alg-text-5xl">Carrito</h1>
      <ul className="alg-divide-y alg-divide-white-2f-10">
        {lines.map((l) => (
          <li key={l.lineId ?? l.variantId} className="alg-flex alg-flex-wrap alg-items-center alg-justify-between alg-gap-4 alg-py-4">
            <div className="alg-flex alg-items-center alg-gap-4">
              {l.customization?.design_data_url && <img src={l.customization.design_data_url} alt="Vista previa del diseño" className="alg-h-20 alg-w-20 alg-rounded-sm alg-bg-white alg-object-contain alg-p-1" />}
              <div><p className="alg-font-bold">{l.productName}</p><p className="alg-text-sm alg-text-white-2f-60">{l.label}{l.customization?.design_data_url || l.customization?.text || l.customization?.notes || l.customization?.placement ? ' · Diseño personalizado' : ''}</p></div>
            </div>
            <div className="alg-flex alg-items-center alg-gap-3">
              <label className="alg-sr-only" htmlFor={`q-${l.lineId ?? l.variantId}`}>Cantidad</label>
              <input id={`q-${l.lineId ?? l.variantId}`} type="number" min={1} max={50} value={l.quantity} onChange={(e) => setQuantity(l.lineId ?? l.variantId, Number(e.target.value) || 1)} className="alg-field alg-w-20" />
              <span className="alg-w-28 alg-text-right alg-font-bold">{formatCLP((l.unitPrice + l.fee) * l.quantity)}</span>
              <button className="alg-underline" onClick={() => remove(l.lineId ?? l.variantId)}>Quitar</button>
            </div>
          </li>
        ))}
      </ul>
      <p className="alg-mt-6 alg-text-right alg-text-2xl alg-font-bold">Subtotal de referencia: <span className="alg-text-brand">{formatCLP(subtotal)}</span></p>
      <p className="alg-text-right alg-text-sm alg-text-white-2f-60">Disponibilidad, despacho y pago se coordinan antes de confirmar.</p>
      <div className="alg-mt-6 alg-text-right"><Link to="/checkout" className="alg-btn-primary">Continuar con la solicitud</Link></div>
    </div>
  )
}
