// Small FormData readers shared by the server actions. Not a 'use server' module.
export function str(fd: FormData, key: string, max = 500) {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key)
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function int(fd: FormData, key: string, fallback = 0) {
  const n = num(fd, key)
  return n == null ? fallback : Math.trunc(n)
}
