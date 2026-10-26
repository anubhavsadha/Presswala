import { materializeSchedules } from '@/lib/data'

// Daily job (see vercel.json): creates the week's orders from every recurring schedule,
// so presswalas see tomorrow's work even if no one opened the app.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const created = await materializeSchedules({}, 7)
  return Response.json({ created })
}
