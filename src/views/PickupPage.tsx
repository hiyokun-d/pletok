import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Bell, BellOff, BellRing, Check, CloudOff, CupSoda, Focus, HandPlatter, KeyRound, LayoutGrid, Loader2, RotateCcw, ScanLine, Search, ShieldAlert, ShieldCheck, StickyNote, UserRoundCheck, WifiOff } from 'lucide-react'
import { BACKEND, crewPin, warm, enqueue, fetchQueue, findOrders, markPickedUp, markReady, pickUpPreorder, proofMatches, type QueueOrder } from '../lib/backend'
import { cachedQueue, forgetSales, localSales, marks, onCrewLocal, saveQueue, setMark, settleMarks } from '../lib/crewLocal'
import { ScanStruk, preorderRef } from '../components/ScanStruk'
import { PREORDER_ITEMS } from '../data/preorder'
import { DRINKS } from '../data/menu'
import { CrewNav, Empty, PinGate, Shell, hhmm, useCrewPage } from './adminUi'
import { chime, unlockAudio } from '../lib/chime'

/*
 * /pickup — the hand-over counter. Every paid order waits here: verified pre-orders (PLT-001…)
 * and booth sales from /cashier (B-001…). Type the digits, hand it over, tap "Diambil".
 * A pre-order's PLT number is easy to guess, so it's only handed over with a second proof: its
 * kode cek, or the last 4 digits of the WhatsApp number it was ordered with (a friend picking up
 * gets both from the forwarded WhatsApp message).
 *
 * New cashier sales ring this device (chime + vibrate + a toast; a system notification and a count
 * in the tab title when the screen is elsewhere) — switched on with the bell, since a browser only
 * plays sound after a tap. "Mode fokus" hides the board: one big number box → that one order →
 * its proof, with "Cek ulang" to check again, for the person standing at the counter.
 *
 * Without the Sheet (no signal, Apps Script down) it keeps going on what this phone knows
 * (lib/crewLocal): the last queue it loaded, booth sales scanned off a buyer's struk QR or rung up
 * on /cashier on this same phone, and its own taps — all sent to the Sheet once it answers.
 */

const REFRESH_MS = 5_000
const SOUND_KEY = 'pletok:pickup-sound'
const FOCUS_KEY = 'pletok:pickup-focus'
const stored = (k: string) => {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}
const store = (k: string, on: boolean) => {
  try {
    localStorage.setItem(k, on ? '1' : '0')
  } catch {
    /* fine — it just won't be remembered */
  }
}
const itemsOf = (o: QueueOrder) => o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')
type Filter = 'all' | 'po' | 'booth'

/** the cups an order line takes to make — bundles count each drink in them */
const cupsOf = (l: QueueOrder['lines'][number]) => l.drinks?.length ? l.drinks : PREORDER_ITEMS.find((i) => i.id === l.id)?.drinks ?? []
/** a cheap fingerprint of this phone's own records, for useSyncExternalStore */
const localSnap = () => {
  try {
    return `${localStorage.getItem('pletok:crew-sales')}|${localStorage.getItem('pletok:pickup-marks')}|${localSales().map((o) => o.id).join()}`
  } catch {
    return ''
  }
}
const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** one word of a "lupa nomor" search against an order: name, code, drinks, payment, time or total */
function fits(o: QueueOrder, w: string) {
  // "35rb" / "35k" / "35.000" → the total (in thousands)
  const money = w.match(/^(\d{1,3})(?:rb|k|\.000)$/)
  if (money) return o.total === Number(money[1])
  // "14.10" / "14:10" → ordered within 6 minutes of that time
  const time = w.match(/^(\d{1,2})[.:](\d{2})$/)
  if (time) {
    const [h, m] = hhmm(o.at).split(/[.:]/).map(Number)
    return Math.abs(h * 60 + m - (Number(time[1]) * 60 + Number(time[2]))) <= 6
  }
  const hay = plain([o.name, o.code, o.pay, ...o.lines.map((l) => l.name), ...o.lines.flatMap(cupsOf).map((d) => DRINKS.find((x) => x.id === d)?.short ?? d)].join(' '))
  return hay.includes(plain(w))
}


/** the yellow button: first a call, then "call again" for as long as they haven't come */
const callLabel = (o: QueueOrder, n = 0) => (!o.ready ? 'Siap · panggil' : `Panggil lagi · ${n > 1 ? `${n}×` : o.readyAt ? hhmm(o.readyAt) : '1×'}`)
const minutesAgo = (at: number) => Math.max(0, Math.round((Date.now() - at) / 60_000))

export function PickupPage() {
  const [pin, setPin] = useState(crewPin)
  const [wrong, setWrong] = useState(false)
  useCrewPage('Pickup')
  // the last queue this phone saw opens instantly (and is all there is while offline)
  // whichever copy is newer: this phone's offline cache, or what another crew page just preloaded
  const [first] = useState(() => {
    const a = cachedQueue()
    const b = warm('queue')
    return b && (!a || b.at > a.at) ? { at: b.at, orders: b.data } : a
  })
  const [orders, setOrders] = useState<QueueOrder[] | null>(first?.orders ?? null)
  const [loadedAt, setLoadedAt] = useState(first?.at ?? 0)
  const [offline, setOffline] = useState(false)
  const [scan, setScan] = useState(false)
  // scanned sales, this phone's cashier log and its own taps — re-render when any of them change
  const localVer = useSyncExternalStore(onCrewLocal, localSnap)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  // taps not confirmed by the Sheet yet: id → done
  const [pending, setPending] = useState<Record<string, boolean>>({})
  // orders seen on the first load don't flash as "new"
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  // bad news from the Sheet after a hand-over (picked up twice, proof refused) — stays until tapped away
  const [alert, setAlert] = useState<string | null>(null)
  // new-sale ring (needs one tap to unlock sound) and the focus desk
  const [sound, setSound] = useState(() => stored(SOUND_KEY))
  const soundRef = useRef(sound)
  soundRef.current = sound
  const [focus, setFocus] = useState(() => stored(FOCUS_KEY))
  // the order "Scan struk" found while in focus mode
  const [pick, setPick] = useState<{ id: string; at: number } | null>(null)
  // a pre-order opened from its pickup QR: its kode cek goes straight into the proof box
  const [scanProof, setScanProof] = useState<{ id: string; ref: string } | null>(null)
  const [toast, setToast] = useState<QueueOrder[]>([])
  const [unseen, setUnseen] = useState(0)

  const toggleSound = async () => {
    const on = !sound
    setSound(on)
    store(SOUND_KEY, on)
    if (!on) return
    unlockAudio()
    chime([660, 990])
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    } catch {
      /* the chime + toast still work */
    }
  }
  const toggleFocus = () => {
    setFocus((f) => (store(FOCUS_KEY, !f), !f))
  }

  // new cashier sales: ring, toast, and when the screen is elsewhere a notification + tab count
  const announce = useCallback((added: QueueOrder[]) => {
    setToast(added)
    window.setTimeout(() => setToast((t) => (t === added ? [] : t)), 6000)
    if (!soundRef.current) return
    chime([988, 1319, 1568], 0.15)
    navigator.vibrate?.([200, 80, 200])
    if (document.visibilityState === 'hidden') {
      setUnseen((n) => n + added.length)
      try {
        if ('Notification' in window && Notification.permission === 'granted')
          new Notification(added.length > 1 ? `${added.length} pesanan kasir baru` : `Pesanan baru ${added[0].code}`, { body: added.map((o) => `${o.code}: ${itemsOf(o)}`).join('\n'), tag: 'pletok-pickup' })
      } catch {
        /* some phones only notify from a service worker */
      }
    }
  }, [])
  useEffect(() => {
    const seenNow = () => document.visibilityState === 'visible' && setUnseen(0)
    document.addEventListener('visibilitychange', seenNow)
    return () => document.removeEventListener('visibilitychange', seenNow)
  }, [])
  useEffect(() => {
    const base = 'Pickup · Pletok'
    document.title = unseen ? `(${unseen}) 🔔 ${base}` : base
  }, [unseen])

  const load = useCallback(async () => {
    if (!pin) return
    const r = await fetchQueue(pin)
    if (r === 'pin') return setPin(null), setWrong(true)
    setOffline(!r)
    if (!r) return
    saveQueue(r)
    setLoadedAt(Date.now())
    settleMarks(r)
    forgetSales(new Set(r.map((o) => o.id)))
    if (seen.current) {
      const added = r.filter((o) => !o.done && !seen.current!.has(o.id))
      if (added.length) setFresh((f) => new Set([...f, ...added.map((o) => o.id)]))
      const booth = added.filter((o) => o.src === 'booth')
      if (booth.length) announce(booth)
    }
    seen.current = new Set(r.map((o) => o.id))
    setOrders(r)
  }, [pin, announce])
  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  // the Sheet's list + sales only this phone has, with this phone's taps laid over both
  const all = useMemo(() => {
    void localVer // re-run when this phone's own records change
    const sheet = orders ?? []
    const ids = new Set(sheet.map((o) => o.id))
    const m = marks()
    return [...sheet, ...localSales().filter((o) => !ids.has(o.id))].map((o) => {
      const t = m[o.id]
      const x = t ? { ...o, done: t.done ?? o.done, ready: o.ready || !!t.ready, readyAt: o.readyAt || (t.ready ? t.at : 0), pickedBy: t.by ?? o.pickedBy } : o
      return o.id in pending ? { ...x, done: pending[o.id] } : x
    })
  }, [orders, pending, localVer])
  /** a pre-order from its kode cek — matched on this phone against the queue's hashes (works offline);
   *  an older Sheet without them is asked which order the code belongs to. Read-only either way. */
  const byRef = async (ref: string) => {
    const pos = all.filter((o) => o.src === 'po')
    for (const o of pos) if ((await proofMatches(o, ref)) === 'kode cek') return o
    if (pos.some((o) => o.vref)) return undefined
    const hit = (await findOrders({ ref }))?.[0]
    return hit ? pos.find((o) => o.id === hit.id) : undefined
  }
  const openFound = (id: string, code: string, proof?: string) => {
    setScanProof(proof ? { id, ref: proof } : null)
    // already in the Sheet → its real number; otherwise the temporary one
    // focus mode stays: the scanned order opens in the focus card; the list jumps to it
    if (focus) setPick({ id, at: Date.now() })
    else {
      setFilter('all')
      setQ((orders ?? []).find((o) => o.id === id)?.code ?? code)
    }
  }
  // the phone's own Camera app read a pickup QR → the customer page sent us here: /pickup?ambil=KODE
  const ambil = useRef(new URLSearchParams(location.search).get('ambil'))
  useEffect(() => {
    const ref = ambil.current && preorderRef(`/c/${ambil.current}`)
    if (!ref || !pin || !orders) return
    ambil.current = null
    history.replaceState(null, '', location.pathname)
    void byRef(ref).then((o) => {
      if (!o) return setAlert(`Pre-order dengan kode ${ref} belum ada di antrean — belum lunas / belum diverifikasi, atau sinyal. Cari nomor PLT-nya manual.`)
      if (o.done) return setAlert(`${o.code} sudah diambil${o.pickedBy ? ` (${o.pickedBy})` : ''} — jangan diserahkan lagi.`)
      openFound(o.id, o.code, ref)
    })
    // once, when the queue is first here
  }, [pin, orders]) // eslint-disable-line react-hooks/exhaustive-deps
  /** a sale the Sheet hasn't seen: its own record goes first, so the tap that follows has something to land on */
  const deliver = (o: QueueOrder) => {
    if (!pin || (orders ?? []).some((x) => x.id === o.id)) return
    void enqueue({ type: 'booth-order', pin, id: o.id, lines: o.lines, pay: /qris/i.test(o.pay) ? 'qris' : /bca/i.test(o.pay) ? 'bca' : 'tunai', name: o.name, note: '' })
  }
  const match = (o: QueueOrder) => {
    if (filter !== 'all' && o.src !== filter) return false
    const t = q.trim().toLowerCase()
    if (!t) return true
    // "7" or "007" → the code number
    if (/^\d{1,4}$/.test(t)) return Number(o.code.replace(/\D/g, '')) === Number(t)
    // forgot the number? describe it instead — every word has to fit: "sinta lychee qris 14.10 35rb"
    return t.split(/\s+/).every((w) => fits(o, w))
  }
  const waiting = all.filter((o) => !o.done && match(o)).sort((a, b) => a.at - b.at)
  const handed = all.filter((o) => o.done && match(o)).sort((a, b) => b.at - a.at).slice(0, 12)
  // what the drink-maker still has to pour, across everything waiting
  const tally = DRINKS.map((d) => ({ d, n: all.filter((o) => !o.done).reduce((t, o) => t + o.lines.reduce((s, l) => s + l.qty * cupsOf(l).filter((x) => x === d.id).length, 0), 0) }))

  // "Siap": the buyer's receipt page rings
  const [calling, setCalling] = useState<Set<string>>(new Set())
  // how many times each order has been called from this phone — a loud booth means calling again
  const [calls, setCalls] = useState<Record<string, number>>({})
  const call = async (o: QueueOrder) => {
    if (!pin) return
    setCalling((c) => new Set(c).add(o.id))
    setCalls((c) => ({ ...c, [o.id]: (c[o.id] ?? (o.ready ? 1 : 0)) + 1 }))
    setMark(o.id, { ready: true })
    const ok = await markReady(pin, o.id)
    if (ok) setOrders((os) => os?.map((x) => (x.id === o.id ? { ...x, ready: true, readyAt: Date.now() } : x)) ?? os)
    else {
      // the buyer's phone can't hear us right now anyway — call it out loud; the Sheet gets it later
      deliver(o)
      void enqueue({ type: 'pickup', pin, src: 'booth', id: o.id, ready: true })
      setAlert(`${o.code}: sinyal putus — panggil pakai suara ("${o.name || o.code}"). Tercatat & dikirim otomatis nanti.`)
    }
    setCalling((c) => {
      const n = new Set(c)
      n.delete(o.id)
      return n
    })
  }

  const mark = async (o: QueueOrder, done: boolean) => {
    if (!pin) return
    setPending((p) => ({ ...p, [o.id]: done }))
    setFresh((f) => {
      const n = new Set(f)
      n.delete(o.id)
      return n
    })
    // remembered on this phone first — a reload or a dead network can't undo a hand-over
    setMark(o.id, { done })
    const ok = await markPickedUp(pin, o.src, o.id, done)
    if (ok) setOrders((os) => os?.map((x) => (x.id === o.id ? { ...x, done } : x)) ?? os)
    else {
      deliver(o)
      void enqueue({ type: 'pickup', pin, src: o.src, id: o.id, done })
      setOffline(true)
    }
    setPending((p) => {
      const n = { ...p }
      delete n[o.id]
      return n
    })
  }

  if (!BACKEND) return <Shell><Empty title="Belum tersambung" text="VITE_BACKEND_URL belum diisi — lihat apps-script/README.md." /></Shell>
  if (!pin) return <Shell><PinGate title="Pickup Pletok" wrong={wrong} onOk={setPin} /></Shell>

  return (
    <Shell>
      <CrewNav at="pickup" />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
          <HandPlatter className="size-7 text-terracotta" /> Pickup
          <motion.span key={waiting.length} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="ml-1 rounded-full bg-terracotta px-3 py-0.5 text-lg text-cream">
            {waiting.length}
          </motion.span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {offline && (
            <span className="flex items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1 font-cond text-sm italic text-terracotta">
              <WifiOff className="size-4" /> Sinyal putus{loadedAt ? ` · antrean per ${hhmm(loadedAt)}` : ''}
            </span>
          )}
          <button type="button" onClick={() => setScan(true)} className="flex items-center gap-1.5 rounded-full border-2 border-brown/15 px-3.5 py-2 font-display text-sm font-semibold">
            <ScanLine className="size-4" /> Scan QR
          </button>
          <button
            type="button"
            onClick={() => void toggleSound()}
            aria-pressed={sound}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-sm font-semibold ${sound ? 'bg-leaf text-cream' : 'border-2 border-terracotta/50 text-terracotta'}`}
          >
            {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />} {sound ? 'Notif ON' : 'Nyalakan notif'}
          </button>
          <button
            type="button"
            onClick={toggleFocus}
            aria-pressed={focus}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-sm font-semibold ${focus ? 'bg-brown text-cream' : 'border-2 border-brown/15'}`}
          >
            {focus ? <LayoutGrid className="size-4" /> : <Focus className="size-4" />} {focus ? 'Semua kartu' : 'Mode fokus'}
          </button>
        </div>
      </div>

      {/* new cashier sales */}
      <AnimatePresence>
        {toast.length > 0 && (
          <motion.button
            type="button"
            onClick={() => setToast([])}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed inset-x-3 top-3 z-50 flex items-center gap-3 rounded-2xl bg-[#e8b53a] p-3.5 text-left font-display text-brown shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2"
          >
            <motion.span animate={{ rotate: [0, -14, 14, -8, 8, 0] }} transition={{ duration: 0.8 }}>
              <BellRing className="size-6" />
            </motion.span>
            <span className="min-w-0 flex-1">
              <b>{toast.length > 1 ? `${toast.length} pesanan kasir baru` : `Pesanan baru ${toast[0].code}`}</b>
              <span className="block truncate text-sm">{toast.map((o) => `${o.code}: ${itemsOf(o)}`).join(' · ')}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alert && (
          <motion.button
            type="button"
            role="alert"
            onClick={() => setAlert(null)}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-3 bottom-3 z-50 flex items-start gap-2 rounded-2xl bg-terracotta p-4 text-left font-display text-cream shadow-2xl sm:inset-x-auto sm:right-6 sm:max-w-md"
          >
            <ShieldAlert className="mt-0.5 size-5 shrink-0 animate-pulse" />
            <span className="flex-1">{alert}</span>
            <span className="font-cond text-sm italic text-cream/75">tutup</span>
          </motion.button>
        )}
      </AnimatePresence>

      <ScanStruk
        open={scan}
        pin={pin}
        known={(id) => all.find((o) => o.id === id)}
        byRef={byRef}
        onClose={() => setScan(false)}
        onFound={(id, code, proof) => {
          setScan(false)
          openFound(id, code, proof)
        }}
      />

      {focus ? (
        <FocusDesk
          orders={orders ? all : null}
          waiting={all.filter((o) => !o.done).length}
          pin={pin}
          onAlert={setAlert}
          onBooth={(o) => mark(o, true)}
          onCall={call}
          calling={calling}
          calls={calls}
          pick={pick}
          proofFor={scanProof}
          onDone={(id, by, done) => (setMark(id, { done, by }), setOrders((os) => os?.map((x) => (x.id === id ? { ...x, done, pickedBy: by } : x)) ?? os))}
        />
      ) : (
        <>
      {/* how a pre-order is handed over, in one line */}
      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-leaf/10 px-3 py-2 font-display text-sm">
        <ShieldCheck className="size-4 shrink-0 text-leaf" />
        <b>Pre-order:</b> cari nomor PLT → kode cek / 4 angka WA <i>(opsional)</i> atau cek nama → <b>Serahkan</b>
      </p>

      {/* cups to make for everything still waiting */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {tally.map(({ d, n }) => (
          <div key={d.id} className="flex items-center gap-2 rounded-2xl border border-brown/10 bg-cream/80 p-2.5">
            <img src={d.image} alt="" className="h-10 w-auto" />
            <div className="min-w-0">
              <motion.p key={n} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-2xl font-bold leading-none tabular-nums">{n}</motion.p>
              <p className="truncate font-cond text-xs italic text-brown-soft">{d.short}</p>
            </div>
          </div>
        ))}
      </div>

      {/* stays at the top while scrolling the queue on a phone */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 flex flex-wrap gap-2 bg-cream/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-cream-deep/80 px-3.5 py-3 focus-within:ring-2 focus-within:ring-terracotta">
          <Search className="size-5 text-brown-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nomor 007, nama, atau minuman" inputMode="search" className="w-full bg-transparent font-display text-lg outline-none" />
        </label>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-brown/10 p-1">
          {(
            [
              ['all', 'Semua'],
              ['po', 'Pre-order'],
              ['booth', 'Kasir'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className="relative rounded-xl px-3 py-2 font-display text-sm font-semibold">
              {filter === id && <motion.span layoutId="pickup-filter" className="absolute inset-0 rounded-xl bg-brown" />}
              <span className={`relative ${filter === id ? 'text-cream' : ''}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {!orders ? (
        <p className="flex items-center gap-2 font-cond italic text-brown/55"><Loader2 className="size-4 animate-spin" /> Memuat antrean…</p>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {waiting.map((o) => (
                <motion.li
                  key={o.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 80, transition: { duration: 0.3 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  className={`relative flex flex-col rounded-3xl border-2 bg-cream p-4 ${fresh.has(o.id) ? 'border-[#e8b53a]' : 'border-brown/10'}`}
                >
                  {fresh.has(o.id) && (
                    <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-[#e8b53a]" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-4xl font-bold leading-none tracking-wide text-terracotta">{o.code}</p>
                      <p className="mt-1 font-display text-lg font-semibold">{o.name || 'Tanpa nama'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2.5 py-1 font-display text-xs font-semibold ${o.src === 'po' ? 'bg-leaf text-cream' : 'bg-brown text-cream'}`}>
                        {o.src === 'po' ? 'Pre-order' : `Kasir · ${o.pay}`}
                      </span>
                      {'via' in o && (
                        <span className="mt-1 flex items-center justify-end gap-1 font-cond text-xs italic text-brown-soft">
                          <CloudOff className="size-3" /> {o.via === 'scan' ? 'dari scan struk' : 'dari kasir HP ini'} · belum di Sheet
                        </span>
                      )}
                      <p className="mt-1.5 font-cond text-sm italic text-brown/55">
                        {hhmm(o.at)}
                        {o.src === 'booth' && ` · ${minutesAgo(o.at)} mnt`}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1 border-t-2 border-dashed border-brown/15 pt-3 font-display">
                    {o.lines.map((l, k) => {
                      const cups = cupsOf(l)
                      return (
                        <li key={k}>
                          <span className="text-xl font-bold">{l.qty}×</span> <span className="text-lg">{l.name}</span>
                          {cups.length > 1 && (
                            <span className="block font-cond text-sm italic text-brown-soft">
                              <CupSoda className="mr-1 inline size-3.5" />
                              {cups.map((c) => DRINKS.find((d) => d.id === c)?.short ?? c).join(' + ')}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {o.note && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#e8b53a]/20 px-3 py-2 font-display text-sm">
                      <StickyNote className="mt-0.5 size-4 shrink-0" /> {o.note}
                    </p>
                  )}
                  {o.src === 'po' ? (
                    <HandOver order={o} pin={pin} initialProof={scanProof?.id === o.id ? scanProof.ref : undefined} onAlert={setAlert} onDone={(by, done) => (setMark(o.id, { done, by }), setOrders((os) => os?.map((x) => (x.id === o.id ? { ...x, done, pickedBy: by } : x)) ?? os))} />
                  ) : (
                    <>
                      {o.ref && (
                        <p className="mt-3 flex items-center justify-between rounded-xl bg-brown/[0.06] px-3 py-1.5 font-display text-sm">
                          <span className="text-brown-soft">Kode cek di struk HP-nya</span>
                          <b className="tracking-[0.2em]">{o.ref}</b>
                        </p>
                      )}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          disabled={calling.has(o.id)}
                          onClick={() => void call(o)}
                          className="flex items-center justify-center gap-1.5 rounded-full bg-[#e8b53a] py-3.5 font-display font-semibold text-brown shadow-[0_5px_0_#a87d1c] disabled:opacity-70"
                        >
                          {calling.has(o.id) ? <Loader2 className="size-5 animate-spin" /> : <BellRing className="size-5" />}
                          {callLabel(o, calls[o.id])}
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          disabled={o.id in pending}
                          onClick={() => void mark(o, true)}
                          className="flex items-center justify-center gap-1.5 rounded-full bg-leaf py-3.5 font-display font-semibold text-cream shadow-[0_5px_0_#3f5426]"
                        >
                          {o.id in pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Diambil
                        </motion.button>
                      </div>
                    </>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {!waiting.length && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border-2 border-dashed border-brown/15 p-10 text-center font-display text-lg text-brown-soft">
              {q ? 'Nggak ada yang cocok — cek lagi nomornya.' : 'Antrean kosong. Santai dulu 🍹'}
            </motion.p>
          )}
          {q.trim() && waiting.length !== 1 && <ForgotCode />}

          {handed.length > 0 && (
            <section className="mt-8">
              <p className="mb-2 font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-brown/55">Baru diambil</p>
              <ul className="flex flex-col divide-y divide-brown/10 rounded-3xl border border-brown/10 bg-cream/60 px-4">
                <AnimatePresence initial={false}>
                  {handed.map((o) => (
                    <motion.li key={o.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-2.5 font-display">
                      <span className="w-20 font-bold text-brown/60 line-through decoration-2">{o.code}</span>
                      <span className="min-w-0 flex-1 truncate text-brown-soft">
                        {o.name || 'Tanpa nama'} · {o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
                        {o.pickedBy && <span className="ml-1.5 font-cond text-sm italic text-leaf">· {o.pickedBy}</span>}
                      </span>
                      <button type="button" disabled={o.id in pending} onClick={() => void mark(o, false)} className="flex items-center gap-1 rounded-full border border-brown/15 px-2.5 py-1 text-xs font-semibold text-brown-soft">
                        <RotateCcw className="size-3" /> Belum
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          )}
        </>
      )}
        </>
      )}
    </Shell>
  )
}

type Match = 'kode cek' | '4 digit WA' | 'unknown' | null

/**
 * A pre-order's hand-over. The extra proof is optional — not everyone remembers their own number:
 *   - typed a kode cek / last 4 WA digits → checked on this device as it's typed (instant, works
 *     offline); a match hands it over in one tap
 *   - nothing typed → "cek nama": the order's name shows big, the crew asks, a second tap hands over
 * Either way the Sheet is told in the background, writes down how it was checked, and refuses a
 * second pickup of the same order (that comes back as an alert) — the one rule that's never optional.
 */
function HandOver({ order: o, pin, onDone, onAlert, autoFocus = false, initialProof }: { order: QueueOrder; pin: string; onDone: (by: string, done: boolean) => void; onAlert: (text: string) => void; autoFocus?: boolean; initialProof?: string }) {
  // scanned off the customer's pickup QR: the kode cek is already in — the crew still taps Serahkan
  const [typed, setTyped] = useState(initialProof ?? '')
  useEffect(() => {
    if (initialProof) setTyped(initialProof)
  }, [initialProof])
  const [match, setMatch] = useState<Match>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // "cek nama" asked: the second tap hands it over
  const [nameCheck, setNameCheck] = useState(false)
  const p = typed.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const proven = match === 'kode cek' || match === '4 digit WA'
  // full length and still no match → say so right away (4 digits = WA, 6 = kode cek)
  const wrong = !match && (p.length >= 6 || (/^\d{4}$/.test(p) && !!o.vwa))

  useEffect(() => {
    let live = true
    void proofMatches(o, typed).then((m) => live && setMatch(m))
    return () => {
      live = false
    }
  }, [o, typed])

  // what the Sheet says afterwards — only bad news needs anyone's attention
  const confirm = async (proof: { proof?: string; manual?: string }) => {
    const r = await pickUpPreorder(pin, o.id, proof)
    if (r?.ok) return
    if (r?.error === 'taken') return onAlert(`${o.code} (${o.name}) ternyata SUDAH diambil sebelumnya${r.by ? ` — ${r.by}` : ''}. Cek siapa yang barusan menerima!`)
    if (r?.error === 'proof') {
      onDone('', false)
      return onAlert(`${o.code}: Sheet menolak buktinya — pesanan dikembalikan ke antrean. Cek lagi kode cek-nya.`)
    }
    // no answer: the record goes in by itself later (the Sheet re-checks it then)
    void enqueue({ type: 'pickup', pin, src: 'po', id: o.id, done: true, ...proof })
  }

  const handOver = async () => {
    if (busy) return
    if (proven) {
      onDone(`${match} · ${hhmm(Date.now())}`, true)
      void confirm({ proof: typed })
      return
    }
    if (match === 'unknown') {
      // an older Sheet without the hashes: this one has to wait for its answer
      setBusy(true)
      const r = await pickUpPreorder(pin, o.id, { proof: typed })
      setBusy(false)
      if (r?.ok) return onDone(`bukti · ${hhmm(Date.now())}`, true)
      setNote(r?.error === 'taken' ? `Sudah diambil sebelumnya${r.by ? ` (${r.by})` : ''} — jangan diserahkan.` : r?.error === 'proof' ? 'Tidak cocok.' : 'Sistem gangguan — coba lagi, atau kosongkan untuk cek nama.')
      return
    }
    if (!p) {
      if (!nameCheck) return setNameCheck(true)
      onDone(`cek nama · ${hhmm(Date.now())}`, true)
      void confirm({ manual: 'cek nama' })
    }
  }

  return (
    <div className="mt-4">
      <label
        className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 transition-colors ${proven ? 'border-leaf bg-leaf/10' : wrong ? 'border-terracotta bg-terracotta/5' : 'border-transparent bg-cream-deep/80'}`}
      >
        {proven ? <ShieldCheck className="size-6 shrink-0 text-leaf" /> : <KeyRound className="size-6 shrink-0 text-brown-soft" />}
        <input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value.slice(0, 12))
            setNote(null)
            setNameCheck(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && void handOver()}
          autoFocus={autoFocus}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Kode cek / 4 angka WA (opsional)"
          aria-label={`Bukti ambil untuk ${o.code} (opsional): kode cek atau 4 angka terakhir nomor WhatsApp`}
          className="min-w-0 flex-1 bg-transparent font-display text-xl uppercase tracking-[0.2em] outline-none placeholder:text-base placeholder:normal-case placeholder:tracking-normal placeholder:text-brown/40"
        />
      </label>
      {(wrong || note) && (
        <p className="mt-1.5 flex items-start gap-1.5 font-display text-sm text-terracotta">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {note ?? 'Tidak cocok — cek lagi, atau kosongkan untuk cek nama saja.'}
        </p>
      )}

      {/* no code: the name, big, for the crew to ask */}
      <AnimatePresence initial={false}>
        {nameCheck && !p && (
          <motion.div key="name" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 rounded-2xl bg-[#e8b53a]/25 p-3 text-center font-display">
              <p className="text-sm text-brown-soft">Tanya: "Atas nama siapa?" — harus</p>
              <p className="text-2xl font-bold">{o.name || 'Tanpa nama'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`mt-2 grid gap-2 ${nameCheck && !p ? 'grid-cols-[auto_1fr]' : ''}`}>
        {nameCheck && !p && (
          <button type="button" onClick={() => setNameCheck(false)} className="rounded-full border-2 border-brown/15 px-4 font-display text-sm font-semibold">
            Batal
          </button>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          disabled={busy || wrong || (!!p && !match)}
          onClick={() => void handOver()}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-4 font-display text-lg font-semibold text-cream disabled:bg-brown/15 disabled:text-brown/45 disabled:shadow-none ${proven || nameCheck ? 'bg-leaf shadow-[0_5px_0_#3f5426]' : 'bg-brown shadow-[0_5px_0_#3a1c0f]'}`}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
          {proven ? `Cocok (${match}) · Serahkan` : match === 'unknown' ? 'Cek & serahkan' : p ? 'Ketik sampai lengkap…' : nameCheck ? 'Namanya cocok · Serahkan' : 'Serahkan (cek nama)'}
        </motion.button>
      </div>
    </div>
  )
}

/**
 * Mode fokus: no board, just the person at the counter. Number → that one order (pre-order or
 * kasir) → its proof → hand over. "Cek ulang" clears the proof to try again; an order that's already
 * gone shows a red stop with when and how it was taken.
 */
function FocusDesk({
  orders,
  waiting,
  pin,
  onAlert,
  onDone,
  onBooth,
  onCall,
  calling,
  calls,
  pick,
  proofFor,
}: {
  orders: QueueOrder[] | null
  waiting: number
  pin: string
  onAlert: (t: string) => void
  onDone: (id: string, by: string, done: boolean) => void
  onBooth: (o: QueueOrder) => Promise<void>
  /** "Siap · panggil": the buyer's struk rings — same as the list view */
  onCall: (o: QueueOrder) => Promise<void>
  calling: Set<string>
  calls: Record<string, number>
  pick: { id: string; at: number } | null
  proofFor: { id: string; ref: string } | null
}) {
  const [src, setSrc] = useState<'po' | 'booth'>('po')
  const [num, setNum] = useState('')
  // bumping it remounts the proof box: "Cek ulang"
  const [round, setRound] = useState(0)
  // handed over just now — show the green "done", not the red "already taken"
  const [handed, setHanded] = useState<{ o: QueueOrder; by: string } | null>(null)
  const numRef = useRef<HTMLInputElement>(null)
  // a scanned order with no number yet (#0B6C, not in the Sheet) is opened by id instead
  const [picked, setPicked] = useState<string | null>(null)
  const n = Number(num)
  const found = picked ? (orders ?? []).filter((o) => o.id === picked) : num ? (orders ?? []).filter((o) => o.src === src && /^(PLT|B)-\d+$/.test(o.code) && Number(o.code.replace(/\D/g, '')) === n) : []
  const o = found[0]

  // "Scan struk" found one: show it here, as if its number had been typed
  useEffect(() => {
    if (!pick) return
    const hit = (orders ?? []).find((x) => x.id === pick.id)
    setHanded(null)
    setRound((r) => r + 1)
    if (hit && /^(PLT|B)-\d+$/.test(hit.code)) {
      setSrc(hit.src)
      setNum(String(Number(hit.code.replace(/\D/g, ''))).padStart(3, '0'))
      setPicked(null)
    } else {
      setSrc('booth')
      setNum('')
      setPicked(pick.id)
    }
    // only when a new scan comes in — not on every queue refresh
  }, [pick])
  const prefix = src === 'po' ? 'PLT-' : 'B-'

  const next = () => {
    setNum('')
    setPicked(null)
    setHanded(null)
    setRound((r) => r + 1)
    window.setTimeout(() => numRef.current?.focus(), 50)
  }
  // the green "done" clears itself for the next person
  useEffect(() => {
    if (!handed) return
    const t = window.setTimeout(next, 4000)
    return () => window.clearTimeout(t)
  }, [handed])

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-3 text-center font-cond text-sm italic text-brown-soft">{waiting} pesanan menunggu · sebut nomornya, lalu cek</p>

      {/* 1 · the number */}
      <div className="rounded-[2rem] border-2 border-brown/10 bg-cream p-4">
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-brown/10 p-1">
          {(
            [
              ['po', 'PLT · Pre-order'],
              ['booth', 'B · Kasir'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSrc(id)
                setHanded(null)
                setRound((r) => r + 1)
                numRef.current?.focus()
              }}
              className={`rounded-xl py-2.5 font-display font-semibold ${src === id ? 'bg-brown text-cream' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 rounded-2xl bg-cream-deep/80 px-4 py-3 focus-within:ring-2 focus-within:ring-terracotta">
          {!picked && <span className="font-display text-4xl font-bold text-terracotta/60">{prefix}</span>}
          <input
            ref={numRef}
            autoFocus
            value={num}
            onChange={(e) => {
              setNum(e.target.value.replace(/\D/g, '').slice(0, 4))
              setPicked(null)
              setHanded(null)
              setRound((r) => r + 1)
            }}
            inputMode="numeric"
            placeholder={picked ? (o?.code ?? '') : '007'}
            aria-label={`Nomor ${prefix}`}
            className="w-full min-w-0 bg-transparent font-display text-4xl font-bold tracking-wider text-terracotta outline-none placeholder:text-brown/25"
          />
          {(num || picked) && (
            <button type="button" onClick={next} className="shrink-0 rounded-full border-2 border-brown/15 px-3 py-1.5 font-display text-sm font-semibold">
              Hapus
            </button>
          )}
        </label>
      </div>

      {/* 2 · that order */}
      <AnimatePresence mode="wait">
        {handed ? (
          <motion.div key="handed" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 rounded-[2rem] bg-leaf p-6 text-center font-display text-cream shadow-[0_8px_0_#3f5426]">
            <UserRoundCheck className="mx-auto size-14" />
            <p className="mt-2 text-4xl font-bold">{handed.o.code}</p>
            <p className="text-xl font-semibold">Serahkan ✓ {handed.o.name}</p>
            <p className="mt-1 text-sm text-cream/85">{itemsOf(handed.o)} · {handed.by}</p>
            <button type="button" onClick={next} className="mt-5 w-full rounded-full bg-cream py-3 font-semibold text-leaf">
              Pelanggan berikutnya
            </button>
          </motion.div>
        ) : !num && !picked ? null : !orders ? (
          <p key="load" className="mt-4 flex items-center justify-center gap-2 font-cond italic text-brown/55"><Loader2 className="size-4 animate-spin" /> Memuat antrean…</p>
        ) : !o ? (
          <motion.div key="none" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-[2rem] border-2 border-dashed border-terracotta/40 p-6 text-center font-display">
            <ShieldAlert className="mx-auto size-10 text-terracotta" />
            <p className="mt-2 text-xl font-bold">{prefix}{num.padStart(3, '0')} tidak ada</p>
            <p className="mt-1 text-sm text-brown-soft">Salah nomor, belum dibayar / belum diverifikasi admin, atau {src === 'po' ? 'ternyata pesanan kasir (B)' : 'ternyata pre-order (PLT)'}.</p>
          </motion.div>
        ) : o.done ? (
          <motion.div key={`taken-${o.id}`} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 rounded-[2rem] bg-terracotta p-6 text-center font-display text-cream">
            <ShieldAlert className="mx-auto size-12 animate-pulse" />
            <p className="mt-2 text-4xl font-bold">{o.code}</p>
            <p className="text-2xl font-bold">SUDAH DIAMBIL</p>
            <p className="mt-1 text-sm text-cream/85">{o.name || 'Tanpa nama'} · {itemsOf(o)}{o.pickedBy ? ` · ${o.pickedBy}` : ''}</p>
            <p className="mt-3 rounded-2xl bg-cream/15 p-3 text-sm">Jangan diserahkan lagi. Kalau orangnya ngotot, panggil admin.</p>
            <button type="button" onClick={next} className="mt-4 w-full rounded-full bg-cream py-3 font-semibold text-terracotta">
              Pelanggan berikutnya
            </button>
          </motion.div>
        ) : (
          <motion.div key={`o-${o.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-[2rem] border-2 border-brown/10 bg-cream p-5">
            <div className="flex items-start justify-between gap-3 font-display">
              <div>
                <p className="text-4xl font-bold leading-none text-terracotta">{o.code}</p>
                <p className="mt-1 text-xl font-semibold">{o.name || 'Tanpa nama'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-cream ${o.src === 'po' ? 'bg-leaf' : 'bg-brown'}`}>{o.src === 'po' ? 'Pre-order' : `Kasir · ${o.pay}`}</span>
            </div>
            <ul className="mt-3 flex flex-col gap-0.5 border-t-2 border-dashed border-brown/15 pt-3 font-display">
              {o.lines.map((l, k) => {
                const cups = cupsOf(l)
                return (
                  <li key={k}>
                    <span className="text-lg font-bold">{l.qty}×</span> {l.name}
                    {cups.length > 1 && <span className="block font-cond text-sm italic text-brown-soft">{cups.map((c) => DRINKS.find((d) => d.id === c)?.short ?? c).join(' + ')}</span>}
                  </li>
                )
              })}
            </ul>
            {o.note && <p className="mt-2 rounded-xl bg-[#e8b53a]/20 px-3 py-2 font-display text-sm"><StickyNote className="mr-1 inline size-4" />{o.note}</p>}

            {/* 3 · the proof */}
            {o.src === 'po' ? (
              <HandOver
                key={`${o.id}-${round}`}
                order={o}
                pin={pin}
                initialProof={proofFor?.id === o.id ? proofFor.ref : undefined}
                autoFocus
                onAlert={onAlert}
                onDone={(by, done) => {
                  onDone(o.id, by, done)
                  if (done) setHanded({ o, by })
                }}
              />
            ) : (
              <>
                {o.ref && (
                  <p className="mt-4 flex items-center justify-between rounded-2xl bg-brown/[0.06] px-4 py-3 font-display">
                    <span className="text-sm text-brown-soft">Cocokkan dengan struk di HP-nya</span>
                    <b className="text-2xl tracking-[0.2em]">{o.ref}</b>
                  </p>
                )}
                <p className="mt-2 font-cond text-sm italic text-brown-soft">Struk asli: jam di halamannya berdetik & segelnya berputar.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    disabled={calling.has(o.id)}
                    onClick={() => void onCall(o)}
                    className="flex items-center justify-center gap-2 rounded-full bg-[#e8b53a] py-4 font-display text-lg font-semibold text-brown shadow-[0_5px_0_#a87d1c] disabled:opacity-70"
                  >
                    {calling.has(o.id) ? <Loader2 className="size-5 animate-spin" /> : <BellRing className="size-5" />}
                    {callLabel(o, calls[o.id])}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      void onBooth(o)
                      setHanded({ o, by: 'struk' })
                    }}
                    className="flex items-center justify-center gap-2 rounded-full bg-leaf py-4 font-display text-lg font-semibold text-cream shadow-[0_5px_0_#3f5426]"
                  >
                    <Check className="size-5" /> Cocok · Serahkan
                  </motion.button>
                </div>
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRound((r) => r + 1)} className="flex items-center justify-center gap-1.5 rounded-full border-2 border-brown/15 py-2.5 font-display text-sm font-semibold">
                <RotateCcw className="size-4" /> Cek ulang
              </button>
              <button type="button" onClick={next} className="rounded-full border-2 border-brown/15 py-2.5 font-display text-sm font-semibold">
                Pelanggan berikutnya
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** a buyer who forgot their number still gets their drink — what to ask, in order */
function ForgotCode() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-3xl bg-[#e8b53a]/20 p-4 font-display text-sm text-brown">
      <p className="flex items-center gap-2 font-bold"><KeyRound className="size-4 text-terracotta" /> Pembeli lupa nomornya?</p>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
        <li>Minta buka <b>pletok…/struk</b> di HP-nya — struk tersimpan di sana, nomor paling atas.</li>
        <li>Ketik apa yang dia ingat, digabung: <b>nama</b> · <b>minumannya</b> (lychee) · <b>bayar pakai</b> (qris) · <b>jam</b> (14.10) · <b>total</b> (35rb).</li>
        <li>Masih ragu? Cocokkan <b>isi pesanan + cara bayar</b> dengan yang dia sebut, lalu tanya kasir — kasir ingat wajahnya.</li>
      </ol>
    </motion.div>
  )
}
