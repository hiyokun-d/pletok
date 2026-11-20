import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Banknote, Check, CloudOff, Copy, Download, Gift, HardDrive, RefreshCw, Landmark, Loader2, Minus, Plus, QrCode, ReceiptText, RotateCcw, ShoppingBasket, TriangleAlert, X } from 'lucide-react'
import { BACKEND, crewPin, warm, enqueue, fetchQueue, health, onHealth, sendBoothOrder, voidBoothOrder, type BoothLine, type BoothPay, type QueueOrder } from '../lib/backend'
import { receiptUrl, tempCode, warmSeal, type PackedSale } from '../lib/saleCode'
import { usePreorder } from '../hooks/usePreorder'
import { useMenu } from '../hooks/useMenu'
import { rupiah } from '../data/preorder'
import { ParticleField } from '../components/ParticleField'
import { QrisCode } from '../components/QrisCode'
import { LinkQr } from '../components/LinkQr'
import { SITE_URL } from '../data/event'
import { downloadLedger, ledger, markSent, markVoid, onLedger, reconcile, record, sync, type Reconciled } from '../lib/boothLedger'
import { Card, CrewNav, Empty, PinGate, Shell, hhmm, useCrewPage } from './adminUi'

/*
 * /cashier — the booth's till. Tap what they want, take the money, and the order lands in /pickup
 * with a B-001 style number to call out. Same crew PIN as /hasil.
 */

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2))
const slug = (name: string) => name.replace(/^Paket /, '').toLowerCase().replace(/\s+/g, '-')
/** notes people pay with — tapping one fills "uang diterima" */
const NOTES = [20, 50, 100]

interface SellItem {
  key: string
  name: string
  price: number
  drinks: string[]
  images: string[]
  soldOut: boolean
}
/** a row of the bill — a bundle whose cups were swapped is its own row, "duo-klasik|original,original" */
interface Line extends SellItem {
  cartKey: string
  qty: number
  custom: boolean
}
const sameMix = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()
/** a bundle as the buyer wants it: its own key, or the plain one when it's the default mix */
const mixKey = (b: SellItem, drinks: string[]) => (sameMix(drinks, b.drinks) ? b.key : `${b.key}|${drinks.join(',')}`)

export function CashierPage() {
  const [pin, setPin] = useState(crewPin)
  const [wrong, setWrong] = useState(false)
  useCrewPage('Kasir')
  const menu = useMenu()
  const items: SellItem[] = useMemo(
    () => [
      ...menu.drinks.map((d) => ({ key: d.id, name: d.name, price: d.price, drinks: [d.id], images: [d.image], soldOut: d.soldOut })),
      ...menu.bundles.map((b) => ({ key: slug(b.name), name: b.name, price: b.price, drinks: b.items, images: b.items.map((i) => menu.drinks.find((d) => d.id === i)!.image), soldOut: b.soldOut })),
    ],
    [menu],
  )

  const [cart, setCart] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  // taps on "Lunas" without a name — each one shakes the field, and the reminder gets firmer
  const [needName, setNeedName] = useState(0)
  const nameBox = useRef<HTMLInputElement>(null)
  const [pay, setPay] = useState<BoothPay>('qris')
  // same account the pre-orders pay into (set in /config)
  const bca = usePreorder().config.bca ?? { number: '', holder: '' }
  const [cash, setCash] = useState('')
  const [orderId, setOrderId] = useState(newId)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // the sale just paid (or one re-opened from the history): its number + the receipt QR for the buyer
  const [done, setDone] = useState<{ id: string; code: string; name: string; at: number; sale: PackedSale; queued?: boolean; again?: boolean } | null>(null)
  const [history, setHistory] = useState<QueueOrder[] | null>(() => warm('queue')?.data.filter((o) => o.src === 'booth').sort((a, b) => b.at - a.at) ?? null)
  // the Sheet didn't answer the last history load — the list comes from this phone's own log
  const [historyFailed, setHistoryFailed] = useState(false)
  // offline / Sheet down: what still works at the till
  const h = useSyncExternalStore(onHealth, health)
  const cut = h.offline || h.down
  // QRIS paid but the GoPay notification is late: checked on the buyer's success screen instead
  const [qrisSeen, setQrisSeen] = useState(false)
  useEffect(() => {
    if (pin) warmSeal(pin)
  }, [pin])

  const drinkOf = (id: string) => menu.drinks.find((d) => d.id === id)
  const lines: Line[] = Object.entries(cart)
    .filter(([, n]) => n > 0)
    .flatMap(([cartKey, qty]) => {
      const [base, mix] = cartKey.split('|')
      const it = items.find((i) => i.key === base)
      if (!it) return []
      const drinks = mix ? mix.split(',') : it.drinks
      const names = drinks.map((id) => drinkOf(id)?.short ?? id).join(' + ')
      return [{ ...it, cartKey, qty, custom: !!mix, drinks, images: drinks.map((id) => drinkOf(id)?.image ?? ''), name: mix ? `${it.name} (${names})` : it.name }]
    })
    // menu order, the default mix before its swapped versions
    .sort((a, b) => items.findIndex((i) => a.key === i.key) - items.findIndex((i) => b.key === i.key) || Number(a.custom) - Number(b.custom))
  const total = lines.reduce((t, i) => t + i.price * i.qty, 0)
  const cups = lines.reduce((n, i) => n + i.qty * i.drinks.length, 0)
  // the QR waits until the cashier stops tapping, so the buyer never scans a half-made bill —
  // until then it shimmers (its loading state) and builds itself the moment the total settles
  const localLog = useSyncExternalStore(onLedger, ledger)
  const [qrTotal, setQrTotal] = useState(total)
  useEffect(() => {
    const t = window.setTimeout(() => setQrTotal(total), 350)
    return () => window.clearTimeout(t)
  }, [total])
  const received = Number(cash) || 0
  const change = received - total

  const deals = useMemo(() => bundleDeals(items, cart), [items, cart])
  // one tap: the loose drinks leave the bill, the bundle takes their place
  const takeDeal = (d: Deal) =>
    setCart((c) => {
      const k = mixKey(d.bundle, d.drinks)
      const next = { ...c, [k]: (c[k] ?? 0) + d.times }
      d.drinks.forEach((id) => (next[id] = Math.max(0, (next[id] ?? 0) - d.times)))
      return next
    })
  // tap a cup in a bundle row → every flavour shows under it, tap the one they want (no cycling:
  // rows only move once the pick is made). One bundle of that row moves to its new mix
  // (a row of 3 becomes 2 + 1); back to the default mix and it rejoins the plain row
  const [picking, setPicking] = useState<{ cartKey: string; slot: number } | null>(null)
  const setCup = (l: Line, slot: number, id: string) => {
    setPicking(null)
    if (l.drinks[slot] === id) return
    const drinks = [...l.drinks]
    drinks[slot] = id
    const k = mixKey(l, drinks)
    setCart((c) => ({ ...c, [l.cartKey]: (c[l.cartKey] ?? 0) - 1, [k]: (c[k] ?? 0) + 1 }))
  }
  /** how many of this menu tile are in the bill, swapped mixes included */
  const inBill = (key: string) => lines.filter((l) => l.key === key).reduce((t, l) => t + l.qty, 0)

  const bump = (key: string, d: number) => setCart((c) => ({ ...c, [key]: Math.max(0, Math.min(50, (c[key] ?? 0) + d)) }))
  const reset = () => {
    setCart({})
    setPicking(null)
    setName('')
    setCash('')
    setPay('qris')
    setOrderId(newId())
    setError(null)
    setQrisSeen(false)
    setNeedName(0)
  }

  const loadHistory = useCallback(async () => {
    if (!pin) return
    const r = await fetchQueue(pin)
    if (r === 'pin') return setPin(null), setWrong(true)
    setHistoryFailed(!r)
    if (r) setHistory(r.filter((o) => o.src === 'booth').sort((a, b) => b.at - a.at))
  }, [pin])
  useEffect(() => {
    void loadHistory()
    const t = window.setInterval(() => void loadHistory(), 15_000)
    return () => window.clearInterval(t)
  }, [loadHistory])

  const submit = async () => {
    if (!pin || !lines.length || sending) return
    // the pickup crew calls people by name — no name, no sale
    if (!name.trim()) {
      setNeedName((n) => n + 1)
      nameBox.current?.focus()
      nameBox.current?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(9px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 380 })
      navigator.vibrate?.([60, 40, 60])
      return
    }
    if (pay === 'tunai' && cash && change < 0) return setError('Uang yang diterima kurang dari total.')
    setSending(true)
    setError(null)
    const order: BoothLine[] = lines.map((i) => ({ id: i.key, name: i.name, qty: i.qty, price: i.price, drinks: i.drinks }))
    // on this phone first — whatever the Sheet does next, the sale exists
    const at = Date.now()
    const note = pay === 'qris' && qrisSeen ? 'QRIS: dicek dari layar sukses pembeli (notif GoPay belum masuk)' : ''
    record({ id: orderId, at, lines: order, pay, name: name.trim(), total })
    const sale: PackedSale = { id: orderId, at, pay, name: name.trim(), lines: order }
    const send = sendBoothOrder(pin, { id: orderId, lines: order, pay, name: name.trim(), note })
    // slow festival wifi: the buyer doesn't stand there for a minute while it retries — after 6 s they
    // get the struk with the temporary code, and the send carries on behind it
    const r = await Promise.race([send, new Promise<'slow'>((res) => window.setTimeout(() => res('slow'), 6000))])
    setSending(false)
    if (r === 'slow') {
      const id = orderId
      setDone({ id, code: tempCode(id), name: name.trim(), at: Date.now(), sale, queued: true })
      reset()
      void send.then((code) => {
        if (!code || code === 'pin') return
        markSent(id, code)
        setDone((d) => (d?.id === id ? { ...d, code, queued: false } : d))
        void loadHistory()
      })
      return
    }
    if (r === 'pin') return setPin(null), setWrong(true)
    // Plan B: the Sheet didn't answer — the sale stays "pending" in this phone's log and goes in by
    // itself when it's back (same id → the Sheet never counts it twice). The buyer still gets served now.
    if (!r) {
      setDone({ id: orderId, code: tempCode(orderId), name: name.trim(), at: Date.now(), sale, queued: true })
      reset()
      return
    }
    markSent(orderId, r)
    setDone({ id: orderId, code: r, name: name.trim(), at: Date.now(), sale })
    reset()
    void loadHistory()
  }

  if (!BACKEND) return <Shell><Empty title="Belum tersambung" text="VITE_BACKEND_URL belum diisi — lihat apps-script/README.md." /></Shell>
  if (!pin) return <Shell><PinGate title="Kasir Pletok" wrong={wrong} onOk={setPin} /></Shell>

  // what the Sheet has + what's only on this phone so far: the till's numbers never stall on bad wifi
  const local = localLog.filter((s) => s.state === 'pending' && !(history ?? []).some((o) => o.id === s.id)).map(
    (s): QueueOrder & { local?: boolean } => ({ src: 'booth', id: s.id, code: tempCode(s.id), name: s.name, at: s.at, total: s.total, pay: s.pay === 'qris' ? 'QRIS' : s.pay === 'bca' ? 'Transfer BCA' : 'Tunai', note: '', done: false, lines: s.lines, local: true }),
  )
  // nothing from the Sheet at all yet: every sale this phone logged (sent ones included) stands in
  const offlineList =
    history === null && historyFailed
      ? localLog.filter((s) => s.state !== 'void').map((s): QueueOrder & { local?: boolean } => ({ src: 'booth', id: s.id, code: s.code || tempCode(s.id), name: s.name, at: s.at, total: s.total, pay: s.pay === 'qris' ? 'QRIS' : s.pay === 'bca' ? 'Transfer BCA' : 'Tunai', note: '', done: false, lines: s.lines, local: s.state === 'pending' }))
      : null
  const shown = offlineList ?? (history ? [...local, ...history].sort((a, b) => b.at - a.at) : null)
  const sold = (shown ?? []).filter((o) => o.at > Date.now() - 18 * 3600_000)
  const sum = (p: string) => sold.filter((o) => o.pay.toLowerCase() === p).reduce((t, o) => t + o.total, 0)

  return (
    <Shell>
      <CrewNav at="cashier" />
      <LocalLog pin={pin} onSynced={loadHistory} />
      <ParticleField preset="burst" overrides={{ shape: 'sparkle', count: 50 }} points={[[window.innerWidth / 2, window.innerHeight * 0.35]]} burstKey={done?.at} />

      {/* no Sheet: the till keeps going — what works and how, in one place */}
      <AnimatePresence initial={false}>
        {cut && (
          <motion.div key="cut" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-5 rounded-3xl border-2 border-[#e8b53a] bg-[#e8b53a]/15 p-4 font-display text-sm">
              <p className="flex items-center gap-2 text-base font-bold"><CloudOff className="size-5" /> {h.offline ? 'HP ini offline' : 'Sheet tidak menjawab'} — kasir tetap jalan</p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
                <li><b>Tunai ✓</b> seperti biasa.</li>
                <li><b>QRIS ✓</b> QR dibuat di HP ini. Pembeli butuh sinyal; cek notif GoPay di HP pemegang — telat? lihat layar sukses di HP pembeli (nama merchant, nominal, jam).</li>
                <li><b>BCA</b> hanya kalau mutasi bisa dicek. Ragu → minta tunai/QRIS.</li>
              </ul>
              <p className="mt-2 text-brown-soft">Tiap penjualan tersimpan di HP ini & masuk Sheet sendiri nanti. Struk QR-nya membawa isi pesanan — <b>HP pickup tinggal scan</b> (kamera HP biasa juga bisa), tanpa internet.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ---- what's for sale: one tap = one more */}
        <section>
          <h1 className="mb-3 flex items-center gap-2 font-display text-3xl font-bold">
            <ShoppingBasket className="size-7 text-terracotta" /> Kasir
          </h1>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((i, k) => (
              <SellTile key={i.key} item={i} n={inBill(i.key)} index={k} onAdd={() => bump(i.key, 1)} />
            ))}
          </div>
        </section>

        {/* ---- the bill */}
        <section className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border-2 border-brown/15 bg-cream p-4">
            <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-terracotta">Pesanan</p>
            {!lines.length ? (
              <p className="py-6 text-center font-cond italic text-brown/50">Tap menu di kiri buat mulai</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {lines.map((i) => (
                    <motion.li key={i.cartKey} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="font-display">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">
                          {i.drinks.length > 1 ? items.find((x) => x.key === i.key)?.name : i.name}
                          {i.custom && <span className="ml-1.5 rounded-full bg-yakult/40 px-1.5 py-0.5 align-middle font-cond text-xs font-semibold italic">isi bebas</span>}
                        </span>
                        <button type="button" aria-label={`Kurangi ${i.name}`} onClick={() => bump(i.cartKey, -1)} className="grid size-8 place-items-center rounded-full bg-cream-deep">
                          <Minus className="size-4" />
                        </button>
                        <motion.span key={i.qty} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="w-6 text-center font-bold tabular-nums">
                          {i.qty}
                        </motion.span>
                        <button type="button" aria-label={`Tambah ${i.name}`} onClick={() => bump(i.cartKey, 1)} className="grid size-8 place-items-center rounded-full bg-brown text-cream">
                          <Plus className="size-4" />
                        </button>
                        <span className="w-20 text-right tabular-nums">{rupiah(i.price * i.qty)}</span>
                      </div>
                      {/* a bundle's cups: tap one, then pick its flavour (same bundle price) */}
                      {i.drinks.length > 1 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {i.drinks.map((id, slot) => {
                            const open = picking?.cartKey === i.cartKey && picking.slot === slot
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setPicking(open ? null : { cartKey: i.cartKey, slot })}
                                aria-expanded={open}
                                aria-label={`Cup ${slot + 1}: ${drinkOf(id)?.short ?? id} — ganti rasa`}
                                className={`flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs font-semibold transition-colors ${open ? 'border-brown bg-brown text-cream' : 'border-brown/20 bg-cream-deep/60'}`}
                              >
                                <img src={drinkOf(id)?.image} alt="" className="h-5 w-auto" />
                                {drinkOf(id)?.short ?? id}
                              </button>
                            )
                          })}
                          {!picking || picking.cartKey !== i.cartKey ? <span className="font-cond text-xs italic text-brown/50">tap cup buat ganti rasa</span> : null}
                        </div>
                      )}
                      <AnimatePresence initial={false}>
                        {picking?.cartKey === i.cartKey && (
                          <motion.div key="pick" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                            <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-2xl bg-brown/10 p-1.5">
                              {menu.drinks.map((d) => {
                                const now = i.drinks[picking.slot] === d.id
                                return (
                                  <button
                                    key={d.id}
                                    type="button"
                                    disabled={d.soldOut && !now}
                                    onClick={() => setCup(i, picking.slot, d.id)}
                                    className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-center text-xs font-semibold leading-tight ${now ? 'bg-brown text-cream' : d.soldOut ? 'cursor-not-allowed bg-brown/5 text-brown-soft' : 'bg-cream'}`}
                                  >
                                    <img src={d.image} alt="" className={`h-8 w-auto ${d.soldOut && !now ? 'opacity-35 grayscale' : ''}`} />
                                    {d.short}
                                    {d.soldOut && !now && <span className="font-cond text-[0.7rem] font-bold uppercase text-terracotta">habis</span>}
                                  </button>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            <div className="mt-3 flex items-baseline justify-between border-t-2 border-dashed border-brown/15 pt-3 font-display">
              <span className="text-brown-soft">{cups} cup</span>
              <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="text-3xl font-bold tabular-nums">
                {rupiah(total)}
              </motion.span>
            </div>

            {/* loose drinks that make a bundle → tell the buyer, swap in one tap */}
            <AnimatePresence initial={false}>
              {deals.map((d) => (
                <motion.div
                  key={mixKey(d.bundle, d.drinks)}
                  layout
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-leaf p-3 text-cream shadow-[0_4px_0_#3f5426]">
                    <motion.span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cream/15" initial={{ rotate: -20, scale: 0.5 }} animate={{ rotate: [0, -14, 10, 0], scale: 1 }} transition={{ duration: 0.6 }}>
                      <Gift className="size-5" />
                    </motion.span>
                    <span className="min-w-0 flex-1 font-display leading-tight">
                      <span className="block text-sm text-cream/80">Tawarin paket! {d.names}</span>
                      <b>
                        {d.times > 1 ? `${d.times}× ` : ''}
                        {d.bundle.name}
                        {!sameMix(d.drinks, d.bundle.drinks) && ' (isi bebas)'} · hemat {rupiah(d.save)}
                      </b>
                    </span>
                    <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => takeDeal(d)} className="shrink-0 rounded-full bg-cream px-3.5 py-2 font-display text-sm font-bold text-leaf">
                      Ganti ke paket
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <input
              ref={nameBox}
              value={name}
              onChange={(e) => (setName(e.target.value), setNeedName(0))}
              maxLength={60}
              required
              autoCapitalize="words"
              autoComplete="off"
              aria-invalid={needName > 0}
              aria-describedby="name-need"
              placeholder="Nama pembeli — buat dipanggil"
              className={`mt-3 w-full rounded-2xl bg-cream-deep/80 p-3 font-display outline-none focus:ring-2 focus:ring-terracotta ${needName ? 'ring-2 ring-terracotta' : ''}`}
            />
            <AnimatePresence initial={false}>
              {needName > 0 && (
                <motion.p
                  id="name-need"
                  role="alert"
                  key={needName >= 3 ? 'firm' : 'soft'}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mt-2 overflow-hidden rounded-2xl px-3 py-2 font-display text-sm ${needName >= 3 ? 'bg-terracotta font-semibold text-cream' : 'bg-terracotta/10 text-terracotta'}`}
                >
                  {needName >= 3 ? '✋ Stop dulu — tanya nama pembelinya. Tim pickup manggil pakai nama ini, tanpa nama pesanannya bisa ketuker.' : 'Tanya nama pembeli dulu ya — buat dipanggil waktu minumannya siap.'}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-brown/10 p-1">
              {(['tunai', 'qris', 'bca'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPay(p)} className="relative flex items-center justify-center gap-2 rounded-xl py-2.5 font-display font-semibold">
                  {pay === p && <motion.span layoutId="pay" className="absolute inset-0 rounded-xl bg-brown" />}
                  <span className={`relative flex items-center gap-2 ${pay === p ? 'text-cream' : ''}`}>
                    {p === 'tunai' ? <Banknote className="size-4" /> : p === 'qris' ? <QrCode className="size-4" /> : <Landmark className="size-4" />} {p === 'tunai' ? 'Tunai' : p === 'qris' ? 'QRIS' : 'BCA'}
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence initial={false}>
              {pay === 'tunai' && total > 0 && (
                <motion.div key="cash" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setCash(String(total))} className="rounded-full border-2 border-brown/15 px-3 py-1.5 font-display text-sm font-semibold">
                      Uang pas
                    </button>
                    {NOTES.filter((n) => n >= total).map((n) => (
                      <button key={n} type="button" onClick={() => setCash(String(n))} className="rounded-full border-2 border-brown/15 px-3 py-1.5 font-display text-sm font-semibold">
                        {rupiah(n)}
                      </button>
                    ))}
                  </div>
                  <label className="mt-2 flex items-center gap-2 rounded-2xl bg-cream-deep/80 p-3 font-display">
                    <span className="text-brown-soft">Diterima Rp</span>
                    <input value={cash} onChange={(e) => setCash(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="0" className="w-16 bg-transparent text-right font-bold outline-none" />
                    <span className="text-brown-soft">.000</span>
                  </label>
                  {received > 0 && (
                    <motion.p key={change} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`mt-2 flex items-baseline justify-between rounded-2xl px-3 py-2 font-display ${change < 0 ? 'bg-terracotta/10 text-terracotta' : 'bg-leaf/15 text-leaf'}`}>
                      <span>{change < 0 ? 'Kurang' : 'Kembalian'}</span>
                      <span className="text-2xl font-bold tabular-nums">{rupiah(Math.abs(change))}</span>
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {pay === 'bca' && (
                <motion.div key="bca" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {bca.number ? (
                    <div className="mt-3 rounded-2xl bg-brown p-3 text-cream">
                      <p className="font-cond text-sm italic text-cream/70">Transfer BCA ke</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-2xl font-bold tracking-wider tabular-nums">{bca.number}</span>
                        <button type="button" onClick={() => void navigator.clipboard?.writeText(bca.number.replace(/\D/g, ''))} className="flex items-center gap-1 rounded-full bg-cream/15 px-2.5 py-1 font-display text-xs font-semibold">
                          <Copy className="size-3" /> Salin
                        </button>
                      </div>
                      <p className="font-cond text-sm italic text-cream/80">a.n. {bca.holder || '—'} · cek mutasi masuk dulu sebelum tekan lunas</p>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl bg-terracotta/10 p-3 font-display text-sm text-terracotta">Rekening BCA belum diisi — atur di /config → Pre-order.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {pay === 'qris' && total > 0 && (
                <motion.div key="qris" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {/* the buyer scans this straight off the screen — the amount is already in it */}
                  <div className="mt-3 rounded-2xl bg-brown p-3 text-cream">
                    <p className="text-center font-cond text-sm italic text-cream/70">Arahkan ke pembeli · nominal sudah terisi</p>
                    <p className="text-center font-display text-3xl font-bold tabular-nums">{rupiah(total)}</p>
                    <QrisCode total={qrTotal || total} loading={qrTotal !== total || sending} className="mx-auto mt-2 max-w-72" />
                    <p className="mt-2 text-center font-cond text-sm italic text-cream/80">Tunggu notif "pembayaran masuk" {rupiah(total)} di GoPay Merchant, baru tekan lunas</p>
                    {/* the notification can lag on a crowded network — the buyer's own success screen is the backup check */}
                    <button type="button" onClick={() => setQrisSeen((v) => !v)} aria-pressed={qrisSeen} className={`mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-xs font-semibold ${qrisSeen ? 'bg-yakult text-brown' : 'bg-cream/15 text-cream'}`}>
                      {qrisSeen ? <Check className="size-3.5" /> : <TriangleAlert className="size-3.5" />} Notif telat — sudah cek layar sukses pembeli
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-terracotta/10 p-3 font-display text-sm text-terracotta">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}

            <motion.button
              type="button"
              onClick={submit}
              disabled={!lines.length || sending}
              whileTap={{ scale: 0.96 }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta py-4 font-display text-lg font-semibold text-cream shadow-[0_6px_0_#6e3418] disabled:bg-[#cfa98f] disabled:shadow-none"
            >
              {sending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {!lines.length ? 'Pilih menu dulu' : name.trim() ? 'Lunas · kirim ke pickup' : 'Isi nama pembeli dulu'}
            </motion.button>
            {lines.length > 0 && (
              <button type="button" onClick={reset} className="mx-auto mt-2 flex items-center gap-1.5 font-display text-sm text-brown-soft">
                <X className="size-4" /> Kosongkan
              </button>
            )}
          </div>
        </section>
      </div>

      <History
        onReceipt={(o) => setDone({ id: o.id, code: o.code, name: o.name, at: Date.now(), again: true, sale: { id: o.id, at: o.at, pay: /qris/i.test(o.pay) ? 'qris' : /bca/i.test(o.pay) ? 'bca' : 'tunai', name: o.name, lines: o.lines.map((l) => ({ ...l, drinks: l.drinks ?? [l.id] })) } })}
        orders={shown}
        offline={!!offlineList}
        pin={pin} total={{ tunai: sum('tunai'), qris: sum('qris'), bca: sum('transfer bca'), n: sold.length }} onChange={loadHistory} />

      {/* the number to call out, big */}
      <AnimatePresence>
        {done && (
          <motion.div
            key={done.at}
            className="fixed inset-0 z-50 grid place-items-center bg-brown/60 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDone(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-cream p-6 text-center sm:p-8"
              initial={{ scale: 0.6, y: 40, rotate: -4 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              <p className="font-cond text-lg italic text-brown-soft">{done.again ? 'Tunjukkan struk lagi' : done.queued ? 'Sistem gangguan · tersimpan di HP ini' : 'Masuk ke pickup · nomor antrean'}</p>
              <motion.p className="mt-1 font-display text-7xl font-bold tracking-wide text-terracotta" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}>
                {done.code}
              </motion.p>
              {done.name && <p className="mt-2 font-display text-xl">a.n. {done.name}</p>}
              {done.queued && (
                <p className="mt-3 rounded-2xl bg-[#e8b53a]/35 p-3 text-left font-display text-sm">
                  Penjualan ini masuk ke Sheet otomatis begitu sistem pulih. <b>Layar pickup belum melihatnya</b> — HP pickup scan QR di bawah (atau sampaikan langsung ke barista & panggil pakai nama).
                </p>
              )}
              {/* the receipt: the buyer scans, gets the live struk + a ring when it's ready */}
              <div className="mx-auto mt-4 w-52 sm:w-60">
                <ReceiptQr pin={pin} sale={done.sale} />
              </div>
              <p className="mt-2 font-display text-sm font-semibold">Minta pembeli scan → struk + dikabari saat siap</p>
              <button type="button" onClick={() => setDone(null)} className="mt-5 w-full rounded-full bg-brown py-3 font-display font-semibold text-cream">
                {done.again ? 'Tutup' : 'Pesanan berikutnya'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  )
}

interface Deal {
  bundle: SellItem
  /** the cups going in — the bundle's own mix, or the buyer's loose picks */
  drinks: string[]
  times: number
  /** thousands saved in total */
  save: number
  /** "Original + Yakult" — what to say to the buyer */
  names: string
}
/**
 * Loose drinks in the bill that make a bundle for less, each drink used once. The bundles' own
 * mixes first, biggest saving first (the trio before the duos). Whatever's left still makes a
 * bundle of the same size, filled with what they picked (Original + Original → a duo, isi bebas).
 */
function bundleDeals(items: SellItem[], cart: Record<string, number>): Deal[] {
  const single = (id: string) => items.find((i) => i.drinks.length === 1 && i.drinks[0] === id)
  const short = (id: string) => single(id)?.name.replace(/^Pletok /, '') ?? id
  const worth = (drinks: string[]) => drinks.reduce((t, id) => t + (single(id)?.price ?? 0), 0)
  const left: Record<string, number> = {}
  items.forEach((i) => i.drinks.length === 1 && (left[i.drinks[0]] = cart[i.key] ?? 0))
  const bundles = items.filter((b) => b.drinks.length > 1 && !b.soldOut)
  const deals: Deal[] = []

  bundles
    .map((b) => ({ b, gain: worth(b.drinks) - b.price }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .forEach(({ b, gain }) => {
      const times = Math.min(...b.drinks.map((id) => left[id] ?? 0))
      if (!(times > 0)) return
      b.drinks.forEach((id) => (left[id] -= times))
      deals.push({ bundle: b, drinks: b.drinks, times, save: gain * times, names: b.drinks.map(short).join(' + ') })
    })

  // the leftovers, priciest first, into the cheapest bundle of each size (biggest size first)
  const loose = Object.entries(left)
    .flatMap(([id, n]) => Array<string>(Math.max(0, n)).fill(id))
    .sort((a, b) => (single(b)?.price ?? 0) - (single(a)?.price ?? 0))
  const bySize = [...new Set(bundles.map((b) => b.drinks.length))].sort((a, b) => b - a)
  for (const size of bySize) {
    const b = bundles.filter((x) => x.drinks.length === size).sort((x, y) => x.price - y.price)[0]
    while (loose.length >= size) {
      const drinks = loose.slice(0, size)
      if (worth(drinks) - b.price <= 0) break
      loose.splice(0, size)
      const same = deals.find((d) => d.bundle === b && sameMix(d.drinks, drinks))
      if (same) {
        same.times++
        same.save += worth(drinks) - b.price
      } else deals.push({ bundle: b, drinks, times: 1, save: worth(drinks) - b.price, names: drinks.map(short).join(' + ') })
    }
  }
  return deals
}

/** a big tappable menu tile; the cup hops and a "+1" floats off on every tap */
function SellTile({ item: i, n, index, onAdd }: { item: SellItem; n: number; index: number; onAdd: () => void }) {
  const [cupsRef, animate] = useAnimate<HTMLDivElement>()
  const [pops, setPops] = useState<number[]>([])
  return (
    <motion.button
      type="button"
      disabled={i.soldOut}
      onClick={() => {
        onAdd()
        setPops((p) => [...p.slice(-3), Date.now() + Math.random()])
        animate(cupsRef.current, { y: [0, -12, 0], rotate: [0, -5, 4, 0] }, { duration: 0.45 })
      }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`relative flex flex-col items-center rounded-3xl border-2 p-3 text-center transition-colors ${i.soldOut ? 'cursor-not-allowed border-dashed border-brown/20 bg-brown/5' : n ? 'border-terracotta/60 bg-cream shadow-[0_4px_0_rgba(168,87,42,0.18)]' : 'border-brown/10 bg-cream/70'}`}
    >
      {/* sold out: only the picture fades — the name stays readable, the stamp says why */}
      <div ref={cupsRef} className={`relative flex h-20 origin-bottom items-end justify-center ${i.soldOut ? 'opacity-35 grayscale' : ''}`}>
        {i.images.map((src, k) => (
          <img key={k} src={src} alt="" className="h-full w-auto object-contain" style={{ marginInline: i.images.length > 1 ? -10 : 0 }} />
        ))}
      </div>
      <AnimatePresence>
        {i.soldOut && (
          <motion.span
            key="habis"
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-9 -translate-x-1/2 rounded-lg border-2 border-terracotta bg-cream px-2.5 py-0.5 font-display text-lg font-bold uppercase tracking-wider text-terracotta shadow-[0_3px_0_rgba(168,87,42,0.25)]"
            initial={{ scale: 2, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          >
            Habis
          </motion.span>
        )}
      </AnimatePresence>
      <p className="mt-2 font-display font-bold leading-tight">{i.name}</p>
      {i.soldOut ? (
        <p className="mt-0.5 rounded-full bg-brown/10 px-2.5 py-0.5 font-display text-sm font-semibold text-brown-soft">Stok habis</p>
      ) : (
        <p className="font-display text-terracotta">{rupiah(i.price)}</p>
      )}
      <AnimatePresence>
        {n > 0 && (
          <motion.span key="n" className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-terracotta font-display text-sm font-bold text-cream" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            {n}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pops.map((p) => (
          <motion.span
            key={p}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 font-display text-lg font-bold text-leaf"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: -34 }}
            transition={{ duration: 0.7 }}
            onAnimationComplete={() => setPops((ps) => ps.filter((x) => x !== p))}
          >
            +1
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.button>
  )
}

/** the buyer's struk QR — the sale rides inside it (sealed with the crew PIN), so it opens and scans with no network */
function ReceiptQr({ pin, sale }: { pin: string; sale: PackedSale }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void receiptUrl(SITE_URL, pin, sale).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [pin, sale])
  return url ? <LinkQr url={url} ecc="M" /> : <div className="grid aspect-square w-full place-items-center rounded-2xl bg-brown/5"><Loader2 className="size-6 animate-spin text-brown/40" /></div>
}

/** today's booth sales; a mistake can be cancelled (tap twice) until it's been picked up */
function History({ orders, offline, pin, total, onChange, onReceipt }: { onReceipt: (o: QueueOrder) => void; orders: Array<QueueOrder & { local?: boolean }> | null; offline: boolean; pin: string; total: { tunai: number; qris: number; bca: number; n: number }; onChange: () => void }) {
  const [arm, setArm] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <Card className="mt-8" title={<span className="flex items-center gap-2"><ReceiptText className="size-5 text-terracotta" /> Penjualan booth</span>} meta={`${total.n} transaksi · tunai ${rupiah(total.tunai)} · QRIS ${rupiah(total.qris)} · BCA ${rupiah(total.bca)}`}>
      {offline && (
        <p className="mb-3 flex items-center gap-2 rounded-2xl bg-[#e8b53a]/20 px-3 py-2 font-display text-sm">
          <CloudOff className="size-4 shrink-0" /> Sheet belum terjangkau — daftar & total ini dari catatan HP ini saja
        </p>
      )}
      {!orders ? (
        <p className="flex items-center gap-2 font-cond italic text-brown/55"><Loader2 className="size-4 animate-spin" /> Memuat…</p>
      ) : !orders.length ? (
        <p className="font-cond italic text-brown/55">Belum ada penjualan.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-brown/10">
          {orders.slice(0, 30).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 font-display">
              <span className="w-16 font-bold text-terracotta">{o.code}</span>
              {o.local && <span className="flex items-center gap-1 rounded-full bg-[#e8b53a]/35 px-2 py-0.5 text-xs font-semibold"><CloudOff className="size-3" /> di HP ini</span>}
              {/* the name first — it's what the pickup crew calls out */}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{o.name || <i className="font-normal text-brown/45">tanpa nama</i>}</span>
                <span className="block truncate text-sm text-brown-soft">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</span>
              </span>
              <span className="font-cond text-sm italic text-brown/55">{hhmm(o.at)} · {o.pay}</span>
              <span className="w-20 text-right tabular-nums">{rupiah(o.total)}</span>
              <button type="button" onClick={() => onReceipt(o)} aria-label={`QR struk ${o.code}`} className="flex items-center gap-1 rounded-full border border-brown/15 px-2.5 py-1 text-xs font-semibold text-brown-soft">
                <QrCode className="size-3" /> Struk
              </button>
              {o.done ? (
                <span className="rounded-full bg-leaf/15 px-2.5 py-1 text-xs font-semibold text-leaf">Diambil</span>
              ) : (
                <button
                  type="button"
                  disabled={busy === o.id}
                  onClick={async () => {
                    if (arm !== o.id) return setArm(o.id)
                    setBusy(o.id)
                    // never reached the Sheet: cancelling it here is enough (it won't be sent)
                    if (o.local) markVoid(o.id)
                    else if (await voidBoothOrder(pin, o.id)) markVoid(o.id)
                    // no answer: cancelled here now, and the Sheet hears it when it's back
                    else markVoid(o.id), void enqueue({ type: 'booth-void', pin, id: o.id })
                    setBusy(null)
                    setArm(null)
                    onChange()
                  }}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${arm === o.id ? 'bg-terracotta text-cream' : 'border border-brown/15 text-brown-soft'}`}
                >
                  {busy === o.id ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                  {arm === o.id ? 'Yakin batalkan?' : 'Batalkan'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/**
 * This phone's own log of sales (lib/boothLedger): how many the Sheet has, what's still only here,
 * and "Cek ulang" — asks the Sheet which sales it really has and re-sends only the missing ones.
 * Pending sales also go out by themselves every 20 s and the moment the Sheet is back.
 */
function LocalLog({ pin, onSynced }: { pin: string; onSynced: () => void }) {
  const sales = useSyncExternalStore(onLedger, ledger)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<Reconciled | 'fail' | null>(null)
  const [open, setOpen] = useState(false)
  const pending = sales.filter((s) => s.state === 'pending')
  const inSheet = sales.filter((s) => s.state === 'sent').length
  useEffect(() => {
    if (!pending.length) return
    const go = () => void sync(pin).then((n) => typeof n === 'number' && n > 0 && onSynced())
    go()
    const t = window.setInterval(go, 20_000)
    window.addEventListener('pletok:recovered', go)
    window.addEventListener('online', go)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('pletok:recovered', go)
      window.removeEventListener('online', go)
    }
  }, [pending.length, pin, onSynced])
  if (!sales.length) return null

  const check = async () => {
    setChecking(true)
    const r = await reconcile(pin)
    setChecking(false)
    setResult(r && r !== 'pin' ? r : 'fail')
    if (r && r !== 'pin') onSynced()
  }
  return (
    // a small bubble at the top; tap it for the check / download
    <div className="relative z-20 -mt-2 mb-4 flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 font-display text-sm shadow-sm ring-1 ${pending.length ? 'bg-[#e8b53a]/25 ring-[#e8b53a]' : 'bg-cream/80 ring-brown/10'}`}
      >
        <span className={`grid size-7 place-items-center rounded-full ${pending.length ? 'bg-[#e8b53a] text-brown' : 'bg-leaf text-cream'}`}>
          {pending.length ? <CloudOff className="size-4 animate-pulse" /> : <HardDrive className="size-4" />}
        </span>
        <span className="font-semibold">{sales.length} penjualan di HP ini</span>
        <span className="font-cond italic text-brown-soft">· {pending.length ? <b className="not-italic text-terracotta">{pending.length} belum di Sheet</b> : 'semua di Sheet'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 top-full mt-2 w-[min(24rem,calc(100vw-2rem))] origin-top-left rounded-3xl bg-cream p-4 font-display shadow-[0_20px_50px_-20px_rgb(58_28_15/0.5)] ring-1 ring-brown/10"
          >
            <p className="text-sm">
              {sales.length} penjualan · {inSheet} sudah di Sheet{pending.length > 0 && <b className="text-terracotta"> · {pending.length} belum — dikirim otomatis</b>}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => void check()} disabled={checking} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brown px-3.5 py-2 text-sm font-semibold text-cream disabled:opacity-60">
                {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Cek ulang dengan Sheet
              </button>
              <button type="button" onClick={downloadLedger} aria-label="Unduh catatan HP ini (CSV)" className="grid size-9 place-items-center rounded-full border-2 border-brown/15">
                <Download className="size-4" />
              </button>
            </div>
            {result && (
              <p className={`mt-3 rounded-2xl px-3 py-2 text-sm ${result === 'fail' ? 'bg-terracotta/10 text-terracotta' : result.left ? 'bg-[#e8b53a]/30' : 'bg-leaf/15 text-leaf'}`}>
                {result === 'fail'
                  ? 'Sheet belum bisa dihubungi — catatan tetap aman di HP ini, coba lagi sebentar.'
                  : `Dicek ${hhmm(result.at)}: ${result.matched} cocok dengan Sheet${result.resent ? ` · ${result.resent} yang belum masuk sudah dikirim` : ''}${result.left ? ` · ${result.left} masih menunggu` : result.resent ? '' : ' · tidak ada yang dobel / hilang'}`}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
