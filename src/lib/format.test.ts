import { describe, expect, it } from 'vitest'
import { formatCLP, formatDateCL } from './format'

describe('formatCLP', () => {
  it('formatea sin decimales', () => {
    expect(formatCLP(12990).replace(/\s/g, ' ')).toMatch(/12\.990/)
  })
})

describe('formatDateCL', () => {
  it('convierte UTC a hora de Santiago (enero = UTC-3)', () => {
    expect(formatDateCL('2026-01-15T15:00:00Z')).toMatch(/12:00/)
  })
})
