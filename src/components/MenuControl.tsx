import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Ban, Check, Cloud, CloudOff, DoorClosed, PackageCheck, RotateCcw, UtensilsCrossed, X } from 'lucide-react'
import { DRINKS, type DrinkId } from '../data/menu'
import { resetMenu, setBundleForced, setBundleItems, setDrinkSold, useMenu } from '../hooks/useMenu'
import { spring } from '../lib/motion'
import { signal } from '../lib/events'
import { setForcedPhase, useEventPhase } from '../hooks/useEventPhase'
import { BACKEND, crewPin, setCrewPin } from '../lib/backend'

const clock = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
const nextDrink = (id: DrinkId) => DRINKS[(DRINKS.findIndex((d) => d.id === id) + 1) % DRINKS.length].id

/**
 * Crew-only menu panel (A + C). Mark drinks SOLD; bundles that contain a sold drink go SOLD on
 * their own — tap a bundle's cups to swap them (e.g. Duo Klasik → 2 Original) and it's back on
 * sale. When every drink is gone the booth plays the sold-out thank-you; "Restock" undoes it all.
 */
export function MenuControl() {
  const [open, setOpen] = useState(false)
  const menu = useMenu()
  const { phase } = useEventPhase()
  // one crew panel at a time (see PhaseControl)
  useEffect(() => {
    if (open) signal.emit('panel-menu')
  }, [open])
  useEffect(() => signal.on('panel-booth', () => setOpen(false)), [])

  useEffect(() => {
    const down = new Set<string>()
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      down.add(k)
      if (down.has('a') && k === 'c' && !e.repeat) setOpen((o) => !o)
      if (k === 'escape') setOpen(false)
    }
    const onUp = (e: KeyboardEvent) => down.delete(e.key.toLowerCase())
    const clear = () => down.clear()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-x-0 bottom-4 z-[80] mx-auto max-h-[calc(100dvh-2rem)] w-[min(94vw,760px)] overflow-y-auto rounded-3xl border border-cream/10 bg-[#2b160c] p-4 text-cream shadow-2xl"
          initial={{ y: 80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.95 }}
          transition={spring.snappy}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 font-display text-lg font-semibold">
                <UtensilsCrossed className="size-4 text-yakult" /> Kontrol Menu
              </p>
              <p className="font-cond text-sm italic text-cream/60">
                {menu.allSoldOut ? 'Semua habis — layar terima kasih sedang tampil' : 'Tandai yang habis · paket ikut otomatis'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full bg-cream/10" aria-label="Tutup panel">
              <X className="size-4" />
            </button>
          </div>

          {BACKEND ? <SyncRow /> : <p className="flex items-center gap-2 rounded-2xl bg-cream/5 px-3 py-2 font-cond text-xs italic text-cream/50"><CloudOff className="size-4" /> Belum tersambung ke Google Sheet — perubahan hanya di laptop ini</p>}

          <Label>Minuman</Label>
          <div className="grid grid-cols-3 gap-2">
            {menu.drinks.map((d) => (
              <button
                key={d.id}
                onClick={() => setDrinkSold(d.id, !d.soldOut)}
                className={`flex items-center gap-2 rounded-2xl p-2 text-left transition-colors ${d.soldOut ? 'bg-terracotta' : 'bg-cream/5 hover:bg-cream/10'}`}
              >
                <img src={d.image} alt="" className={`h-12 w-auto shrink-0 object-contain ${d.soldOut ? 'grayscale' : ''}`} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-display text-sm font-semibold">{d.short}</span>
                  <span className="font-cond text-xs italic text-cream/70">{d.soldOut ? `SOLD · ${clock(d.soldAt!)}` : `${d.price}K · tersedia`}</span>
                </span>
                {d.soldOut ? <Ban className="size-4 shrink-0" /> : <Check className="size-4 shrink-0 text-leaf-light" />}
              </button>
            ))}
          </div>

          <Label>Paket — ketuk gelasnya untuk ganti isi</Label>
          <div className="flex flex-col gap-2">
            {menu.bundles.map((b) => (
              <div key={b.name} className={`flex flex-wrap items-center gap-3 rounded-2xl p-2 ${b.soldOut ? 'bg-terracotta/25 ring-1 ring-terracotta/60' : 'bg-cream/5'}`}>
                <div className="flex gap-1">
                  {b.items.map((id, slot) => {
                    const d = menu.drinks.find((x) => x.id === id)!
                    return (
                      <motion.button
                        key={slot}
                        title="Ganti isi"
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setBundleItems(b.name, b.items.map((x, i) => (i === slot ? nextDrink(x) : x)))}
                        className="grid size-11 place-items-center rounded-xl bg-cream/10 hover:bg-cream/20"
                      >
                        <img src={d.image} alt={d.short} className={`h-9 w-auto object-contain ${d.soldOut ? 'opacity-50 grayscale' : ''}`} />
                      </motion.button>
                    )
                  })}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="font-display text-sm font-semibold">
                    {b.name.replace('Paket ', '')} · {b.price}K {b.edited && <span className="ml-1 rounded-full bg-spice/30 px-1.5 font-cond text-xs italic">diubah</span>}
                  </p>
                  <p className="truncate font-cond text-xs italic text-cream/60">{b.detail}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 font-cond text-xs font-semibold italic ${b.soldOut ? 'bg-terracotta' : 'bg-leaf'}`}>
                  {b.soldOut ? (b.reason === 'manual' ? 'SOLD · manual' : `SOLD · ${b.reason} habis`) : 'tersedia'}
                </span>
                <div className="flex gap-1">
                  {b.edited && (
                    <button onClick={() => setBundleItems(b.name, null)} className="rounded-full bg-cream/10 px-2.5 py-1 font-display text-xs font-semibold" title="Kembalikan isi asli">
                      isi asli
                    </button>
                  )}
                  <button
                    onClick={() => setBundleForced(b.name, b.reason !== 'manual')}
                    className="rounded-full bg-cream/10 px-2.5 py-1 font-display text-xs font-semibold"
                  >
                    {b.reason === 'manual' ? 'buka lagi' : 'paksa sold'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-cond text-xs italic text-cream/50">A + C buka/tutup · tersimpan walau di-refresh</p>
            <div className="flex gap-2">
            {/* all gone and nothing to wait for → skip straight to the closing show */}
            {menu.allSoldOut && (phase === 'open' || phase === 'last-call') && (
              <button
                onClick={() => {
                  setForcedPhase('closed')
                  setOpen(false)
                }}
                className="flex items-center gap-2 rounded-2xl bg-terracotta px-4 py-2.5 font-display text-sm font-semibold"
              >
                <DoorClosed className="size-4" /> Tutup sekarang
              </button>
            )}
            <button
              onClick={resetMenu}
              disabled={!menu.anySoldOut && !menu.bundles.some((b) => b.edited)}
              className="flex items-center gap-2 rounded-2xl bg-leaf px-4 py-2.5 font-display text-sm font-semibold disabled:opacity-40"
            >
              {menu.allSoldOut ? <PackageCheck className="size-4" /> : <RotateCcw className="size-4" />} Restock semua (reset)
            </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Label({ children }: { children: string }) {
  return <p className="mb-1.5 mt-3 font-cond text-xs font-semibold uppercase italic tracking-[0.3em] text-cream/45">{children}</p>
}

/** crew PIN (the CREW_PIN in the Sheet's script properties) → this laptop's changes reach every phone */
function SyncRow() {
  const [pin, setPin] = useState('')
  const [ok, setOk] = useState(() => !!crewPin())
  const [bad, setBad] = useState(false)
  if (ok)
    return (
      <p className="flex items-center justify-between gap-2 rounded-2xl bg-leaf/30 px-3 py-2 font-cond text-xs italic">
        <span className="flex items-center gap-2"><Cloud className="size-4" /> Tersinkron — semua HP ikut dalam ±30 detik</span>
        <button onClick={() => void setCrewPin(null).then(() => setOk(false))} className="underline">lepas</button>
      </p>
    )
  return (
    <form
      className="flex items-center gap-2 rounded-2xl bg-cream/5 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault()
        void setCrewPin(pin).then((r) => (r ? setOk(true) : setBad(true)))
      }}
    >
      <CloudOff className="size-4 shrink-0 text-cream/60" />
      <span className="flex-1 font-cond text-xs italic text-cream/60">{bad ? 'PIN salah / belum ada sinyal' : 'Masukkan PIN crew biar SOLD ikut ke semua HP'}</span>
      <input value={pin} onChange={(e) => { setPin(e.target.value); setBad(false) }} type="password" inputMode="numeric" placeholder="PIN" className="w-24 rounded-xl bg-cream/10 px-3 py-1.5 font-display text-sm outline-none" />
      <button className="rounded-xl bg-leaf px-3 py-1.5 font-display text-sm font-semibold">Sambung</button>
    </form>
  )
}
