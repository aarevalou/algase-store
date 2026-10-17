import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartLine } from '../types/db'

interface CartValue {
  lines: CartLine[]
  count: number
  subtotal: number          // referencia local; validar precios al conectar el backend
  isOpen: boolean
  open: () => void
  close: () => void
  add: (line: CartLine) => void
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  clear: () => void
}

const KEY = 'algase.cart.v1'
const Ctx = createContext<CartValue | null>(null)

function load(): CartLine[] {
  try {
    const lines = JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartLine[]
    return lines.map((line) => ({ ...line, lineId: line.lineId ?? crypto.randomUUID() }))
  } catch { return [] }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)
  const [isOpen, setIsOpen] = useState(false)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch { /* modo privado */ } }, [lines])

  const value = useMemo<CartValue>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((n, l) => n + (l.unitPrice + l.fee) * l.quantity, 0),
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    add: (line) => setLines((prev) => {
      const i = prev.findIndex((l) => {
        const hasDesign = (item: CartLine) => Boolean(item.customization?.design_data_url || item.customization?.text || item.customization?.notes || item.customization?.placement)
        return l.variantId === line.variantId
          && l.customization?.color === line.customization?.color
          && !hasDesign(l)
          && !hasDesign(line)
      })
      if (i < 0) return [...prev, { ...line, lineId: line.lineId ?? crypto.randomUUID() }]
      const next = [...prev]
      next[i] = { ...next[i], quantity: Math.min(next[i].quantity + line.quantity, 50) }
      return next
    }),
    setQuantity: (id, q) => setLines((prev) => prev.map((l) => ((l.lineId ?? l.variantId) === id ? { ...l, quantity: Math.max(1, Math.min(q, 50)) } : l))),
    remove: (id) => setLines((prev) => prev.filter((l) => (l.lineId ?? l.variantId) !== id)),
    clear: () => setLines([]),
  }), [lines, isOpen])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart debe usarse dentro de CartProvider')
  return v
}
