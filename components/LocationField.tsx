'use client'
import { useState } from 'react'

/** Captures the device's GPS position into hidden lat/lng inputs. Used for route planning. */
export function LocationField({ initial, label = 'Use my current location' }: {
  initial?: { lat: number | null; lng: number | null }; label?: string
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null)
  const [msg, setMsg] = useState('')

  function locate() {
    if (!navigator.geolocation) return setMsg('Location is not available on this device.')
    setMsg('Finding you…')
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setMsg('') },
      () => setMsg('Could not get location. Allow location access and try again.'),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <div>
      <input type="hidden" name="lat" value={pos?.lat ?? ''} />
      <input type="hidden" name="lng" value={pos?.lng ?? ''} />
      <button type="button" onClick={locate} className="btn-secondary w-full">
        📍 {pos ? 'Location saved – update' : label}
      </button>
      <p className="mt-1 text-xs text-stone-500">
        {msg || (pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : 'Optional, but it gives a much better pickup route. Tap while at home / shop.')}
      </p>
    </div>
  )
}
