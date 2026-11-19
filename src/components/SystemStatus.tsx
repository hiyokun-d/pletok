import { useEffect, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, CloudOff, MessageCircle, ServerCrash, WifiOff } from 'lucide-react'
import { ADMIN_WA } from '../data/event'
import { health, onHealth, onStats, pendingCount } from '../lib/backend'
import { hhmm } from '../views/adminUi'

/*
 * One honest line about the system, on every page but the booth screen (it has its own island):
 *   - the phone is offline          → "data dikirim saat sinyal balik"
 *   - the Sheet isn't answering     → customers: their order/feedback is safe on the phone, sent by
 *                                     itself later, or chat the admin · crew: a red bar with since
 *                                     when, how often, and what's waiting on this device
 *   - it came back                  → a short green "tersambung lagi" while the queues flush
 * While anything is wrong it keeps probing (the stats GET — cheap, cached by the Sheet), so it also
 * notices recovery on pages that don't poll by themselves.
 */

const CREW = ['/hasil', '/config', '/cashier', '/pickup']

export function SystemStatus() {
  const h = useSyncExternalStore(onHealth, health)
  const crew = CREW.includes(window.location.pathname.replace(/\/+$/, ''))
  const [, tick] = useState(0)
  // keep the shared poll running on every page — that's what spots both the outage and the recovery
  useEffect(() => onStats(() => {}), [])
  // the "back" note fades on its own
  const fresh = h.recoveredAt > 0 && Date.now() - h.recoveredAt < 5000
  useEffect(() => {
    if (!fresh) return
    const t = window.setTimeout(() => tick((n) => n + 1), 5200)
    return () => window.clearTimeout(t)
  }, [fresh, h.recoveredAt])
  // minutes-down ticks over while it's down
  useEffect(() => {
    if (!h.down) return
    const t = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(t)
  }, [h.down])

  const state = h.offline ? 'offline' : h.down ? 'down' : fresh ? 'back' : null
  const mins = h.since ? Math.max(1, Math.round((Date.now() - h.since) / 60_000)) : 0
  const waiting = pendingCount()

  if (crew && state === 'down')
    return (
      <motion.div role="alert" className="fixed inset-x-0 bottom-0 z-[60] bg-terracotta px-4 py-3 text-cream shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.5)]" initial={{ y: 80 }} animate={{ y: 0 }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 font-display">
          <ServerCrash className="size-5 shrink-0 animate-pulse" />
          <b>Google Sheet tidak menjawab</b>
          <span className="font-cond text-sm italic text-cream/85">
            sejak {h.since ? hhmm(h.since) : '—'} ({mins} mnt, {h.fails}× gagal){waiting > 0 && ` · ${waiting} data menunggu di HP ini`}
          </span>
          <span className="basis-full font-cond text-sm italic text-cream/85">
            Pembeli tetap bisa pre-order — pesanan tersimpan di HP mereka & masuk sendiri saat pulih. Cek Apps Script → Executions; kalau perlu Deploy → New version.
          </span>
        </div>
      </motion.div>
    )

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          key={state}
          role="status"
          className={`fixed left-1/2 top-3 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-semibold shadow-lg ${state === 'back' ? 'bg-leaf text-cream' : state === 'down' ? 'bg-[#e8b53a] text-brown' : 'bg-brown text-cream'}`}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
        >
          {state === 'offline' && (
            <>
              <WifiOff className="size-4 shrink-0 text-yakult" /> <span className="truncate">Offline — data terkirim sendiri saat sinyal balik</span>
            </>
          )}
          {state === 'down' && (
            <>
              <CloudOff className="size-4 shrink-0 animate-pulse" />
              <span className="truncate">{crew ? 'Sistem gangguan' : 'Sistem lagi gangguan — datamu aman, terkirim otomatis'}</span>
              {!crew && ADMIN_WA && (
                <a href={`https://wa.me/${ADMIN_WA}`} target="_blank" rel="noreferrer" data-track="status-chat-admin" className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-brown px-2.5 py-1 text-xs text-cream">
                  <MessageCircle className="size-3" /> Admin
                </a>
              )}
            </>
          )}
          {state === 'back' && (
            <>
              <CheckCircle2 className="size-4 shrink-0" /> Tersambung lagi — semua data dikirim
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
