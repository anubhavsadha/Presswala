export type Slot = { id: string; label: string; start: number; end: number }

// Morning windows when the presswala collects clothes.
export const PICKUP_SLOTS: Slot[] = [
  { id: '07-09', label: '7–9 am', start: 7, end: 9 },
  { id: '09-11', label: '9–11 am', start: 9, end: 11 },
  { id: '11-13', label: '11 am–1 pm', start: 11, end: 13 },
]

// Evening windows when the customer is home to receive ironed clothes.
export const RETURN_SLOTS: Slot[] = [
  { id: '16-18', label: '4–6 pm', start: 16, end: 18 },
  { id: '18-20', label: '6–8 pm', start: 18, end: 20 },
  { id: '20-22', label: '8–10 pm', start: 20, end: 22 },
]

export const ALL_SLOTS = [...PICKUP_SLOTS, ...RETURN_SLOTS]

export function slotLabel(id: string) {
  return ALL_SLOTS.find((s) => s.id === id)?.label ?? id
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  picked_up: 'Picked up · ironing',
  ready: 'Ironed · ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const STATUS_HI: Record<string, string> = {
  requested: 'नया',
  accepted: 'मंज़ूर',
  picked_up: 'उठाया',
  ready: 'तैयार',
  delivered: 'दे दिया',
  cancelled: 'रद्द',
}
