// All scheduling happens in India Standard Time, whatever the server's timezone.
const IST_OFFSET_MS = 5.5 * 3600 * 1000

export function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS)
}

export function todayIST() {
  return nowIST().toISOString().slice(0, 10)
}

export function currentHourIST() {
  return nowIST().getUTCHours() + nowIST().getUTCMinutes() / 60
}

export function addDays(date: string, days: number) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function weekday(date: string) {
  return new Date(date + 'T00:00:00Z').getUTCDay()
}

export function formatDate(date: string | Date) {
  const s = typeof date === 'string' ? date : toDateString(date)
  const today = todayIST()
  if (s === today) return 'Today'
  if (s === addDays(today, 1)) return 'Tomorrow'
  if (s === addDays(today, -1)) return 'Yesterday'
  return new Date(s + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export function toDateString(d: Date | string) {
  if (typeof d === 'string') return d.slice(0, 10)
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00Z').getTime())
}
