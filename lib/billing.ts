// Bill calculation. Pure, so it can be unit-tested.

export type BillLine = { code: string; name: string; qty: number; unitPrice: number; isRegular: boolean }

export type Bill = {
  pieces: number
  subtotal: number
  subscriptionPieces: number
  discount: number
  total: number
  commission: number
}

/**
 * Subscription pieces cover regular clothes only. The dearest regular pieces are covered
 * first so the customer always gets the best value from their plan.
 */
export function computeBill(lines: BillLine[], subscriptionRemaining: number, commissionPct: number): Bill {
  const valid = lines.filter((l) => l.qty > 0)
  const subtotal = money(valid.reduce((s, l) => s + l.qty * l.unitPrice, 0))
  let left = Math.max(0, subscriptionRemaining)
  let covered = 0
  let discount = 0
  for (const l of valid.filter((x) => x.isRegular).sort((a, b) => b.unitPrice - a.unitPrice)) {
    const n = Math.min(left, l.qty)
    covered += n
    discount += n * l.unitPrice
    left -= n
  }
  const total = money(subtotal - discount)
  return {
    pieces: valid.reduce((s, l) => s + l.qty, 0),
    subtotal,
    subscriptionPieces: covered,
    discount: money(discount),
    total,
    commission: money((total * commissionPct) / 100),
  }
}

export function money(n: number) {
  return Math.round(n * 100) / 100
}

export function rupees(n: number) {
  return '₹' + (Number.isInteger(n) ? n.toString() : n.toFixed(2))
}

export function upiLink(upiId: string, payee: string, amount: number, note: string) {
  const p = new URLSearchParams({ pa: upiId, pn: payee, am: amount.toFixed(2), cu: 'INR', tn: note })
  return `upi://pay?${p}`
}
