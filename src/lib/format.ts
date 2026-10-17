const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

/** Formatea un monto en pesos chilenos. Los montos se manejan como enteros (CLP no tiene decimales). */
export const formatCLP = (amount: number): string => clp.format(amount)

/** Las fechas se guardan en UTC y se muestran en hora de Chile. */
export const formatDateCL = (iso: string): string =>
  new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' })
    .format(new Date(iso))

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pendiente de confirmación',
  pending_payment: 'Pendiente de pago',
  confirmed: 'Confirmado',
  in_production: 'En producción',
  ready: 'Listo',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
