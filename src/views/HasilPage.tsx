import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Banknote, Check, Coins, Crown, Landmark, QrCode, Download, ExternalLink, HelpCircle, Hourglass, ImageIcon, Lightbulb, Loader2, MessageCircle, MessageCircleHeart, PackageCheck, RefreshCw, ScanLine, Search, Send, Settings2, ShieldAlert, ShoppingBag, Sparkles, Star, ThumbsUp, Undo2, Users, Wallet, X } from 'lucide-react'
import { EVENT, SITE_URL } from '../data/event'
import { DRINKS } from '../data/menu'
import { AnimatePresence } from 'motion/react'
import { BACKEND, crewPin, fetchProof, fetchQueue, fetchResults, saveMoneyHolders, updateOrder, type MoneyHolders, type Order, type OrderStatus, type PreorderPay, type QueueOrder, type Response, type Results, type SecurityEvent } from '../lib/backend'
import { usePreorder } from '../hooks/usePreorder'
import { PREORDER_ITEMS, rupiah } from '../data/preorder'
import { spring } from '../lib/motion'
import { Btn, Card, CrewNav, DEMO, Empty, PinGate, Shell, Tile, WAIT, dayTime, hhmm, useCrewPage, wait } from './adminUi'

/**
 * Crew-only results (/hasil), laid out like Google Forms' "Ringkasan" tab: headline numbers,
 * one chart per question, then every written answer. Live from the Sheet (refreshes every 30 s).
 * One series per chart → one brand colour; labels carry identity, never colour alone.
 */

const BAR = '#a8572a' // validated on the cream surface (dataviz validator: all checks pass)
const RATING_LABELS = ['Kurang', 'Biasa', 'Enak', 'Enak bgt', 'Juara!']
const GRID = [
  { key: 'like', title: 'Like', sub: 'yang disukai', Icon: ThumbsUp },
  { key: 'wish', title: 'Wishes', sub: 'kritik & saran', Icon: Sparkles },
  { key: 'question', title: 'Questions', sub: 'pertanyaan', Icon: HelpCircle },
  { key: 'idea', title: 'Ideas', sub: 'ide', Icon: Lightbulb },
] as const
const REFRESH_MS = 30_000
const BUCKET_MIN = 15

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)


export function HasilPage() {
  const [pin, setPin] = useState(DEMO ? 'demo' : crewPin)
  const [data, setData] = useState<Results | null>(DEMO ? demoResults() : null)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'pin'>('idle')
  const [at, setAt] = useState<number | undefined>(DEMO ? Date.now() : undefined)
  // booth sales (/cashier), for the money cards — voided ones never come back
  const [booth, setBooth] = useState<QueueOrder[] | null>(DEMO ? demoBooth() : null)
  const { open: preorderOpen, config } = usePreorder()
  useCrewPage('Hasil')

  const load = useCallback(async () => {
    if (!pin || DEMO) return
    setState('loading')
    const r = await fetchResults(pin)
    if (r === 'pin') {
      setState('pin')
      setPin(null)
      return
    }
    if (!r) return setState('error')
    const q = await fetchQueue(pin)
    if (Array.isArray(q)) setBooth(q.filter((o) => o.src === 'booth'))
    setData(r)
    setAt(Date.now())
    setState('idle')
  }, [pin])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  if (!BACKEND && !DEMO) return <Shell><Empty title="Belum tersambung" text="VITE_BACKEND_URL belum diisi — lihat apps-script/README.md." /></Shell>
  if (!pin) return <Shell><PinGate title="Hasil Pletok" wrong={state === 'pin'} onOk={setPin} /></Shell>

  return (
    <Shell>
      <CrewNav at="hasil" />
      {/* the admins learned "/hasil = settings" — point them to where the switches went */}
      <a href={'/config' + window.location.search} className="mb-6 flex items-center gap-3 rounded-3xl bg-terracotta p-4 text-cream shadow-[0_6px_0_#6e3418]">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream/15"><Settings2 className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold leading-tight">Cari pengaturan? Sekarang di /config</span>
          <span className="font-cond text-sm italic text-cream/80">Menu habis, harga, buka/tutup feedback, pre-order — semuanya pindah ke sana</span>
        </span>
        <ArrowRight className="size-5 shrink-0" />
      </a>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.3em] text-terracotta">{EVENT.table} · {EVENT.name}</p>
          <h1 className="font-display text-4xl font-bold leading-none">Hasil Feedback</h1>
          <p className="mt-1.5 font-cond text-base italic text-brown-soft">
            {state === 'error' ? 'Gagal ambil data — coba lagi' : at ? `Diperbarui ${hhmm(at)} · otomatis tiap 30 detik` : 'Mengambil data…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void load()} icon={<RefreshCw className={`size-4 ${state === 'loading' ? 'animate-spin' : ''}`} />}>Muat ulang</Btn>
          {data && <Btn onClick={() => downloadCsv(data.responses)} icon={<Download className="size-4" />}>Unduh CSV</Btn>}
          {data && <Btn href={data.sheetUrl} icon={<ExternalLink className="size-4" />} solid>Buka Google Sheet</Btn>}
        </div>
      </header>

      {data && (
        <Money
          orders={data.orders ?? []}
          booth={booth}
          holders={data.money ?? { bca: '', qris: '', tunai: '' }}
          bcaName={config.bca?.holder ?? ''}
          save={async (money) => {
            const ok = DEMO ? (await wait(800), true) : await saveMoneyHolders(pin, money)
            if (ok) setData((d) => (d ? { ...d, money } : d))
            return ok
          }}
        />
      )}

      {data?.orders && (
        <Orders
          orders={data.orders}
          preorderOpen={preorderOpen}
          loadProof={(id) => (DEMO ? wait(700).then(() => ({ image: DRINKS[0].image, name: 'Contoh bukti.jpg', url: '#' })) : fetchProof(pin, id))}
          update={async (id, patch) => {
            if (DEMO) {
              await wait(1200)
              setData((d) => {
                if (!d) return d
                const next = Math.max(0, ...(d.orders ?? []).map((o) => Number(o.code.match(/(\d+)$/)?.[1]) || 0)) + 1
                return { ...d, orders: d.orders?.map((o) => (o.id === id ? { ...o, ...patch, code: o.code || (patch.status === 'process' || patch.status === 'done' ? pickupCode(o.name, next) : '') } : o)) }
              })
              return true
            }
            const ok = await updateOrder(pin, id, patch)
            if (ok) void load()
            return ok
          }}
        />
      )}
      {data && <Summary data={data} />}
    </Shell>
  )
}

/* ------------------------------------------------------------------ money */

type Pot = keyof MoneyHolders
const POTS: Array<{ id: Pot; label: string; Icon: typeof Landmark; where: string }> = [
  { id: 'bca', label: 'Transfer BCA', Icon: Landmark, where: 'rekening BCA' },
  { id: 'qris', label: 'QRIS', Icon: QrCode, where: 'GoPay Merchant' },
  { id: 'tunai', label: 'Tunai', Icon: Banknote, where: 'kotak uang' },
]
/** booth rows say 'Tunai' / 'QRIS' / 'Transfer BCA'; pre-orders say 'BCA' / 'QRIS' */
const potOf = (pay: string): Pot => (/qris/i.test(pay) ? 'qris' : /bca/i.test(pay) ? 'bca' : 'tunai')

/**
 * Where the money is: everything paid (verified pre-orders + booth sales that weren't cancelled),
 * split by the pot it landed in, each with the crew member who holds it — so settling up after
 * the event is one look, not a hunt through three apps.
 */
function Money({ orders, booth, holders, bcaName, save }: { orders: Order[]; booth: QueueOrder[] | null; holders: MoneyHolders; bcaName: string; save: (m: MoneyHolders) => Promise<boolean> }) {
  const po = orders.filter((o) => o.status === 'process' || o.status === 'done')
  const sums = POTS.map((p) => {
    const a = po.filter((o) => potOf(o.pay) === p.id)
    const b = (booth ?? []).filter((o) => potOf(o.pay) === p.id)
    const pre = a.reduce((t, o) => t + o.total, 0)
    const walk = b.reduce((t, o) => t + o.total, 0)
    return { ...p, pre, walk, sum: pre + walk, n: a.length + b.length }
  })
  const total = sums.reduce((t, p) => t + p.sum, 0)
  const missing = POTS.filter((p) => !holders[p.id].trim())

  return (
    <Card
      className="mt-8"
      title={<span className="flex items-center gap-2"><Coins className="size-5 text-terracotta" /> Uang masuk</span>}
      meta={booth ? 'Pre-order terverifikasi + penjualan booth (yang dibatalkan tidak dihitung)' : 'Penjualan booth belum termuat — angka booth menyusul'}
    >
      {missing.length > 0 && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl px-4 py-3 font-display text-sm text-brown" style={{ background: `${WAIT}55` }}>
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <b>Tulis nama crew yang pegang uangnya</b> — belum ada untuk {missing.map((p) => p.label).join(', ')}. Biar jelas siapa yang setor & bagi hasil nanti.
          </span>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl bg-brown p-5 text-cream">
          <span className="flex items-center gap-2 font-cond text-sm italic text-cream/70"><Wallet className="size-4" /> Total sekarang</span>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">{rupiah(total)}</p>
          <p className="mt-1.5 font-cond text-xs italic text-cream/70">{sums.reduce((t, p) => t + p.n, 0)} transaksi · semua akun</p>
        </div>
        {sums.map((p) => (
          <div key={p.id} className="rounded-3xl border border-brown/10 bg-cream/80 p-5">
            <span className="flex items-center gap-2 font-cond text-sm italic text-brown-soft"><p.Icon className="size-4 text-terracotta" /> {p.label}</span>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums leading-none">{rupiah(p.sum)}</p>
            <p className="mt-1.5 font-cond text-xs italic text-brown/55">
              {p.n} transaksi · pre-order {rupiah(p.pre)} · booth {rupiah(p.walk)}
              {p.id === 'bca' && bcaName && ` · rek a.n. ${bcaName}`}
            </p>
            <Holder pot={p} holders={holders} save={save} />
          </div>
        ))}
      </div>
    </Card>
  )
}

/** "dipegang oleh" — typed in place, saved to the Sheet on Enter / leaving the field */
function Holder({ pot, holders, save }: { pot: { id: Pot; where: string }; holders: MoneyHolders; save: (m: MoneyHolders) => Promise<boolean> }) {
  const saved = holders[pot.id]
  const [draft, setDraft] = useState(saved)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  useEffect(() => setDraft(saved), [saved])
  const commit = async () => {
    const v = draft.trim()
    if (v === saved || state === 'saving') return
    setState('saving')
    setState((await save({ ...holders, [pot.id]: v })) ? 'idle' : 'error')
  }
  const empty = !draft.trim()
  return (
    <label className="mt-3 block">
      <span className="font-cond text-xs italic text-brown/55">Dipegang oleh ({pot.where})</span>
      <span className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: state === 'saving' || draft.trim() !== saved ? `${WAIT}66` : empty ? `${WAIT}33` : 'rgb(90 46 26 / 0.06)', boxShadow: empty ? `inset 0 0 0 2px ${WAIT}` : undefined }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 60))}
          onBlur={() => void commit()}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          placeholder="Tulis nama crew…"
          className="min-w-0 flex-1 bg-transparent font-display text-sm font-semibold outline-none placeholder:font-normal placeholder:text-brown/45"
        />
        {state === 'saving' && <Loader2 className="size-4 animate-spin" />}
        {state === 'idle' && !empty && draft.trim() === saved && <Check className="size-4 text-leaf" />}
      </span>
      {state === 'error' && <span className="font-cond text-xs italic text-terracotta">Gagal menyimpan — cek sinyal, lalu coba lagi</span>}
    </label>
  )
}

/* ------------------------------------------------------------------ orders */

/** 0812… / +62812… / 812… → 62812… for wa.me */
const waLink = (wa: string, text: string) => {
  let d = wa.replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}
/** when & where — every message ends with it */
// plain ">" bullets: emoji arrive as "�" on some phones through a wa.me link
const PICKUP = `> Ambil di ${EVENT.table}, ${EVENT.place} · ${EVENT.campus}\n> ${EVENT.dateLabel}, ${EVENT.timeLabel}`
/** the order's own live status page — /c/KODECEK opens it straight away, no searching */
// every message carries it: the page shows the order (and the code, big) — no searching, and the
// cashier can read it straight off the phone. Built from the private kode cek, never the PLT number.
// full https:// so every chat app turns it into a tappable link
const statusLink = (o: Order) => (o.ref ? `\n\nCek status & kode ambilmu di sini:\n${SITE_URL}/c/${o.ref}` : '')
/** the receipt, line by line — monospace in WhatsApp so the prices stay readable */
const receipt = (o: Order) =>
  [
    '*STRUK PRE-ORDER PLETOK*',
    '```',
    ...o.lines.map((l) => `${l.qty}x ${l.name} — ${rupiah(l.price * l.qty)}`),
    ...(o.promo ? [`Promo — -${rupiah(o.promo)}`] : []),
    `TOTAL — ${rupiah(o.total)}`,
    '```',
    `> Kode ambil: *${o.code}*`,
    ...(o.ref ? [`> Kode cek: ${o.ref}`] : []),
    `> Atas nama: ${o.name}`,
    `> Dipesan: ${dayTime(o.at)} WIB`,
    ...(o.pay ? [`> Bayar: ${o.pay}${o.sender ? ` (a.n. ${o.sender})` : ''}`] : []),
    '> Status: LUNAS',
  ].join('\n')
const codeMessage = (o: Order) =>
  `Halo kak ${o.name}! Pembayaran pre-order Pletok kamu sudah kami terima.\n\n${receipt(o)}${statusLink(o)}\n\n${PICKUP}\n\nTunjukkan kode ini (atau halaman di link) + sebutkan nama ya. Makasih!`
/** the WhatsApp button on every other status — the code (or kode cek before it's paid) and the pickup */
const contactMessage = (o: Order) =>
  o.status === 'hold'
    ? `Halo kak ${o.name}! Dari Pletok, soal pre-order kamu: ${o.summary} (${rupiah(o.total)})${o.ref ? `, kode cek *${o.ref}*` : ''}.\n\nKami lagi cek transfernya — begitu masuk, kode ambilmu kami kirim di sini.\n\n${PICKUP}${statusLink(o)}`
    : o.status === 'rejected'
      ? `Halo kak ${o.name}! Dari Pletok, soal pre-order kamu: ${o.summary} (${rupiah(o.total)})${o.ref ? `, kode cek *${o.ref}*` : ''}.\n\nTransfernya belum kami temukan — boleh kirim bukti transfernya di sini?\n\n${PICKUP}${statusLink(o)}`
      : `Halo kak ${o.name}! Dari Pletok, soal pre-order *${o.code}*: ${o.summary}.\n\n${PICKUP}${statusLink(o)}`

type Patch = { status?: OrderStatus; sent?: boolean; pay?: PreorderPay }
/** same as nextCode_ in Code.gs — for the demo only */
const pickupCode = (_name: string, n: number) => `PLT-${String(n).padStart(3, '0')}`
type Proof = { image: string; name: string; url: string }
const STATUS_LABEL: Record<OrderStatus, string> = { hold: 'Hold', process: 'Process', done: 'Diambil', rejected: 'Ditolak' }
const STATUS_TONE: Record<OrderStatus, string> = { hold: 'bg-[#e8b53a] text-brown', process: 'bg-leaf text-cream', done: 'bg-brown/10 text-brown/60', rejected: 'bg-terracotta/15 text-terracotta' }

/**
 * Pre-orders as a queue. A new order is on HOLD until someone finds the transfer (BCA mutasi)
 * and taps Verifikasi — that hands out its pickup code and moves it to PROCESS. While pre-order
 * is still open the holds sit on top (to check); once it's closed, PROCESS goes on top (to make).
 */
function Orders({ orders, update, preorderOpen, loadProof }: { orders: Order[]; update: (id: string, patch: Patch) => Promise<boolean>; preorderOpen: boolean; loadProof: (id: string) => Promise<Proof | null> }) {
  const [viewing, setViewing] = useState<Order | null>(null)
  // tapped here, not confirmed by the Sheet yet → yellow
  const [pending, setPending] = useState<Record<string, Patch>>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  useEffect(() => {
    setPending((p) => {
      const left = Object.fromEntries(
        Object.entries(p).filter(([id, patch]) => {
          const o = orders.find((x) => x.id === id)
          return o && ((patch.status && o.status !== patch.status) || (patch.sent !== undefined && o.sent !== patch.sent) || (patch.pay && o.pay !== patch.pay))
        }),
      )
      return Object.keys(left).length === Object.keys(p).length ? p : left
    })
  }, [orders])
  const view = (o: Order): Order => ({ ...o, ...pending[o.id] })
  const act = async (o: Order, patch: Patch) => {
    setPending((p) => ({ ...p, [o.id]: { ...p[o.id], ...patch } }))
    setFailed(null)
    if (!(await update(o.id, patch))) {
      setPending(({ [o.id]: _, ...rest }) => rest)
      setFailed(o.code || o.name)
    }
  }

  const all = orders.map(view)
  const count = (st: OrderStatus) => all.filter((o) => o.status === st).length
  const paid = all.filter((o) => o.status === 'process' || o.status === 'done')
  const unsent = all.filter((o) => o.status === 'process' && !o.sent).length
  // cups to make: verified orders only, split by what's still waiting for pickup
  const prep = DRINKS.map((d) => {
    const cups = (os: Order[]) => os.reduce((a, o) => a + o.lines.reduce((b, l) => b + l.qty * (PREORDER_ITEMS.find((i) => i.id === l.id)?.drinks.filter((x) => x === d.id).length ?? 0), 0), 0)
    return { d, total: cups(paid), left: cups(paid.filter((o) => o.status === 'process')) }
  })
  const rank: Record<OrderStatus, number> = preorderOpen ? { hold: 0, process: 1, done: 2, rejected: 3 } : { process: 0, hold: 1, done: 2, rejected: 3 }
  const needle = q.trim().toLowerCase()
  const list = all
    .filter((o) => filter === 'all' || o.status === filter)
    // just digits ("7", "007") → that pickup code, so the cashier types only the number
    .filter((o) => !needle || (/^\d{1,4}$/.test(needle) ? Number(o.code.match(/(\d+)$/)?.[1]) === Number(needle) : `${o.code} ${o.ref} ${o.name} ${o.wa} ${o.sender}`.toLowerCase().includes(needle)))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.at - b.at)

  return (
    <Card
      className="mt-4"
      title={
        <span className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-terracotta" /> Daftar pre-order
        </span>
      }
      meta={failed ? `Gagal menyimpan ${failed} — coba lagi` : preorderOpen ? 'Pre-order masih buka · Hold di atas: cek mutasi BCA / notif GoPay Merchant (QRIS), lalu Verifikasi' : 'Pre-order tutup · Process di atas: yang harus dibuat & diambil'}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile Icon={Hourglass} label="Perlu dicek (hold)" value={count('hold')} sub={`${orders.length} pesanan · ${count('rejected')} ditolak`} />
        <Tile Icon={Wallet} label="Sudah dibayar" value={rupiah(paid.reduce((a, o) => a + o.total, 0))} sub={`${paid.length} terverifikasi · ${unsent} kode belum dikirim`} />
        <div className="rounded-3xl border border-brown/10 bg-cream/80 p-5">
          <span className="font-cond text-sm italic text-brown-soft">Cup yang perlu disiapkan (sudah bayar)</span>
          <ul className="mt-2 space-y-1">
            {prep.map(({ d, total, left }) => (
              <li key={d.id} className="flex items-baseline justify-between gap-2 font-display text-sm">
                <span className="font-semibold">{d.short}</span>
                <span className="tabular-nums">
                  <b className="text-lg">{left}</b> <span className="font-cond italic text-brown/55">sisa dari {total}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'hold', 'process', 'done', 'rejected'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-2 font-display text-sm font-semibold ${filter === f ? 'bg-brown text-cream' : 'bg-cream-deep/70 text-brown/70'}`}>
              {f === 'all' ? 'Semua' : STATUS_LABEL[f]} <span className="tabular-nums opacity-60">{f === 'all' ? all.length : count(f)}</span>
            </button>
          ))}
        </div>
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-full bg-cream-deep/70 px-4 py-2.5">
          <Search className="size-4 text-brown/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode (007), nama, nomor…" className="w-full bg-transparent font-cond outline-none" />
        </label>
        <Btn onClick={() => downloadOrders(all)} icon={<Download className="size-4" />}>Unduh CSV</Btn>
      </div>

      {list.length === 0 ? (
        <p className="py-8 text-center font-cond italic text-brown/55">{orders.length ? 'Tidak ada yang cocok' : 'Belum ada pre-order'}</p>
      ) : (
        <ul className="mt-3 divide-y divide-brown/10">
          {list.map((o) => {
            const syncing = o.id in pending
            const faded = (o.status === 'done' || o.status === 'rejected') && !syncing
            return (
              <motion.li layout key={o.id} transition={spring.snappy} className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl py-3 ${faded ? 'opacity-55' : ''}`} style={syncing ? { boxShadow: `inset 3px 0 0 ${WAIT}` } : undefined}>
                <div className="min-w-0 flex-1 basis-64 pl-2">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display font-semibold">
                    <span className={`rounded-full px-2.5 py-0.5 font-cond text-xs font-semibold uppercase tracking-wider ${STATUS_TONE[o.status]}`} style={syncing ? { background: WAIT, color: '#5a2e1a' } : undefined}>
                      {syncing && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                      {STATUS_LABEL[o.status]}
                    </span>
                    {o.code && <span className="rounded-md bg-brown px-1.5 py-0.5 font-cond text-sm tracking-wide text-cream">{o.code}</span>}
                    {o.name}
                    <span className="font-cond text-sm font-normal italic text-brown/55">{dayTime(o.at)}</span>
                  </p>
                  <p className="mt-0.5 font-cond text-brown-soft">{o.summary}</p>
                  <p className="font-cond text-sm italic text-brown/60">
                    {/* the customer picks it; tap to fix it when they paid the other way */}
                    <button type="button" onClick={() => void act(o, { pay: o.pay === 'QRIS' ? 'BCA' : 'QRIS' })} title="Ganti BCA / QRIS" className="rounded-full border border-brown/20 px-2 py-0.5 font-display text-xs font-semibold not-italic text-brown">
                      {o.pay === 'QRIS' ? 'QRIS' : 'BCA'} ⇄
                    </button>
                    {o.ref && ` · kode cek ${o.ref}`}
                    {!!o.promo && <b className="font-semibold not-italic text-leaf"> · promo −{rupiah(o.promo)}</b>}
                    {o.sender && ` · pengirim: ${o.sender}`}
                    {o.status === 'process' && (o.sent ? ' · kode sudah dikirim' : ' · kode BELUM dikirim')}
                  </p>
                  {o.note && <p className="font-cond text-sm italic text-terracotta">“{o.note}”</p>}
                </div>
                <span className="font-display font-bold tabular-nums">{rupiah(o.total)}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {o.proof ? (
                    <ActBtn onClick={() => setViewing(o)} icon={<ImageIcon className="size-4" />}>Bukti</ActBtn>
                  ) : (
                    (o.status === 'hold' || o.status === 'rejected') && <span className="font-cond text-sm italic text-brown/45">belum upload bukti</span>
                  )}
                  {o.status === 'hold' && (
                    <>
                      <ActBtn solid onClick={() => void act(o, { status: 'process' })} icon={<Check className="size-4" strokeWidth={3} />}>Verifikasi</ActBtn>
                      <ActBtn onClick={() => void act(o, { status: 'rejected' })} icon={<X className="size-4" />}>Tolak</ActBtn>
                    </>
                  )}
                  {o.status === 'process' && (
                    <>
                      {o.code && (
                        <a href={waLink(o.wa, codeMessage(o))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-3.5 py-2 font-display text-sm font-semibold text-cream">
                          <Send className="size-4" /> Kirim kode
                        </a>
                      )}
                      <ActBtn on={o.sent} onClick={() => void act(o, { sent: !o.sent })} icon={<Check className="size-4" strokeWidth={3} />}>{o.sent ? 'Terkirim' : 'Tandai terkirim'}</ActBtn>
                      <ActBtn onClick={() => void act(o, { status: 'done' })} icon={<PackageCheck className="size-4" />}>Diambil</ActBtn>
                    </>
                  )}
                  {o.status === 'done' && <ActBtn onClick={() => void act(o, { status: 'process' })} icon={<Undo2 className="size-4" />}>Batal diambil</ActBtn>}
                  {o.status === 'rejected' && <ActBtn onClick={() => void act(o, { status: 'hold' })} icon={<Undo2 className="size-4" />}>Cek ulang</ActBtn>}
                  {o.status !== 'process' && (
                    <a href={waLink(o.wa, contactMessage(o))} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${o.name}`} className="grid size-9 place-items-center rounded-full border-2 border-leaf/40 text-leaf">
                      <MessageCircle className="size-4" />
                    </a>
                  )}
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
      <AnimatePresence>{viewing && <ProofViewer key={viewing.id} order={viewing} load={loadProof} onClose={() => setViewing(null)} />}</AnimatePresence>
    </Card>
  )
}

/** the transfer screenshot, fetched with the PIN — the Drive file itself stays private */
function ProofViewer({ order, load, onClose }: { order: Order; load: (id: string) => Promise<Proof | null>; onClose: () => void }) {
  const [p, setP] = useState<Proof | null | 'none'>(null)
  useEffect(() => {
    void load(order.id).then((r) => setP(r ?? 'none'))
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [order.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-cream" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={spring.snappy}>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-display font-bold">{order.name} · {rupiah(order.total)}</p>
            <p className="truncate font-cond text-sm italic text-brown/60">{p && p !== 'none' ? p.name : 'Bukti transfer'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 shrink-0 place-items-center rounded-full bg-brown/10"><X className="size-4" /></button>
        </div>
        <div className="grid min-h-60 flex-1 place-items-center overflow-auto bg-brown/5">
          {p === null ? <Loader2 className="size-6 animate-spin text-brown/50" /> : p === 'none' ? <p className="p-6 font-cond italic text-brown/60">Gagal memuat bukti — coba lagi</p> : <img src={p.image} alt={`Bukti transfer ${order.name}`} className="max-h-[70vh] w-full object-contain" />}
        </div>
        {p && p !== 'none' && p.url !== '#' && (
          <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 font-display text-sm font-semibold text-terracotta">
            <ExternalLink className="size-4" /> Buka di Google Drive
          </a>
        )}
      </motion.div>
    </motion.div>
  )
}

function ActBtn({ children, onClick, icon, solid, on }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; solid?: boolean; on?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-sm font-semibold ${solid ? 'bg-brown text-cream' : on ? 'bg-leaf/15 text-leaf ring-2 ring-leaf/40' : 'border-2 border-brown/15 text-brown'}`}
    >
      {icon} {children}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ the summary */

function Summary({ data }: { data: Results }) {
  const rs = data.responses
  const rated = rs.filter((r) => r.rating)
  const avg = rated.length ? rated.reduce((a, r) => a + r.rating!, 0) / rated.length : null
  const ratingCounts = [1, 2, 3, 4, 5].map((n) => rated.filter((r) => r.rating === n).length)
  const withFav = rs.filter((r) => r.favorites.trim())
  const favCounts = DRINKS.map((d) => ({ label: d.short, img: d.image, n: withFav.filter((r) => r.favorites.split(', ').includes(d.short)).length })).sort((a, b) => b.n - a.n)
  const topFav = Math.max(0, ...favCounts.map((f) => f.n))
  const lovesAll = withFav.filter((r) => DRINKS.every((d) => r.favorites.split(', ').includes(d.short))).length
  const contacts = rs.filter((r) => r.consent && r.contact.trim())
  const boothScans = data.scans.filter((s) => s.target === 'link' || s.target === 'ig').length

  return (
    <>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile Icon={MessageCircleHeart} label="feedback masuk" value={rs.length} />
        <Tile Icon={Star} label="rating rata-rata" value={avg === null ? '–' : avg.toFixed(1)} unit={avg === null ? '' : '/ 5'} />
        <Tile Icon={ScanLine} label="scan QR booth" value={boothScans} sub={boothScans ? `${pct(rs.length, boothScans)}% lanjut isi feedback` : undefined} />
        <Tile Icon={Users} label="mau dihubungi lagi" value={contacts.length} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Seberapa enak?" meta={`${rated.length} jawaban`}>
          <ColumnChart
            bars={ratingCounts.map((n, i) => ({ label: RATING_LABELS[i], sub: String(i + 1), n }))}
            total={rated.length}
            tip={(b) => `${b.sub} · ${b.label}: ${b.n} orang (${pct(b.n, rated.length)}%)`}
          />
        </Card>

        <Card title="Menu favorit" meta={`${withFav.length} jawaban · bisa pilih lebih dari satu`}>
          <div className="flex flex-col gap-3 pt-1">
            {favCounts.map((f) => (
              <HBar key={f.label} label={f.label} img={f.img} n={f.n} share={pct(f.n, withFav.length)} top={f.n > 0 && f.n === topFav} />
            ))}
          </div>
          {lovesAll > 0 && <p className="mt-4 font-cond text-sm italic text-brown-soft">{lovesAll} orang suka semua menu</p>}
        </Card>
      </div>

      <Card title="Feedback masuk per 15 menit" meta="jam WIB" className="mt-4">
        <Timeline responses={rs} />
      </Card>

      <h2 className="mt-10 font-display text-2xl font-bold">Jawaban tertulis</h2>
      <p className="font-cond text-base italic text-brown-soft">Feedback-Capture Grid — terbaru di atas</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {GRID.map(({ key, title, sub, Icon }) => {
          const items = rs.filter((r) => r[key].trim()).sort((a, b) => b.at - a.at)
          return (
            <Card key={key} title={<span className="flex items-center gap-2"><Icon className="size-5 text-terracotta" /> {title} <span className="font-cond text-base font-normal italic text-brown-soft">{sub}</span></span>} meta={`${items.length} jawaban`}>
              {items.length ? (
                <ul className="-mx-1 flex max-h-80 flex-col gap-2 overflow-y-auto px-1">
                  {items.map((r, i) => (
                    <li key={i} className="rounded-2xl bg-cream-deep/60 px-4 py-3">
                      <p className="whitespace-pre-line font-display text-[0.95rem] leading-snug">{r[key]}</p>
                      <p className="mt-1 font-cond text-xs italic text-brown/50">{r.name || 'Anonim'} · {dayTime(r.at)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-cond italic text-brown/45">Belum ada jawaban</p>
              )}
            </Card>
          )
        })}
      </div>

      <SecurityCard events={data?.security ?? []} />

      <Card title="Boleh dihubungi" meta={`${contacts.length} orang · rahasia tim`} className="mt-4">
        {contacts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left font-display text-sm">
              <thead className="font-cond text-xs uppercase italic tracking-wider text-brown/50">
                <tr><th className="pb-2 font-semibold">Nama</th><th className="pb-2 font-semibold">Kontak</th><th className="pb-2 font-semibold">Rating</th><th className="pb-2 font-semibold">Waktu</th></tr>
              </thead>
              <tbody>
                {contacts.map((r, i) => (
                  <tr key={i} className="border-t border-brown/10">
                    <td className="py-2 pr-3">{r.name || '–'}</td>
                    <td className="py-2 pr-3 font-semibold">{r.contact}</td>
                    <td className="py-2 pr-3">{r.rating ?? '–'}</td>
                    <td className="py-2 text-brown/60">{dayTime(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-cond italic text-brown/45">Belum ada</p>
        )}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ charts (plain HTML, one hue) */

interface ColBar {
  label: string
  sub: string
  n: number
}

/** vertical bars on a shared baseline; count on top, hover for the full sentence */
function ColumnChart({ bars, total, tip }: { bars: ColBar[]; total: number; tip: (b: ColBar) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...bars.map((b) => b.n))
  return (
    <div className="relative">
      <div className="relative flex h-48 items-end gap-[2px] border-b border-brown/20" onPointerLeave={() => setHover(null)}>
        {/* recessive gridlines at half and full */}
        {[0.5, 1].map((g) => (
          <span key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-brown/10" style={{ bottom: `${g * 100}%` }} />
        ))}
        {bars.map((b, i) => (
          <div
            key={b.label}
            className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end px-[6%]"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="mb-1 font-display text-sm font-semibold tabular-nums text-brown">{b.n || ''}</span>
            <motion.span
              className="w-full max-w-16 rounded-t-[4px]"
              style={{ background: BAR, opacity: hover === null || hover === i ? 1 : 0.45 }}
              initial={{ height: 0 }}
              animate={{ height: `${(b.n / max) * 82}%` }}
              transition={spring.glide}
            />
            {hover === i && <Tooltip>{tip(b)}</Tooltip>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {bars.map((b) => (
          <div key={b.label} className="flex-1 text-center leading-tight">
            <span className="block font-display text-sm font-semibold">{b.sub}</span>
            <span className="block font-cond text-xs italic text-brown/55">{b.label}</span>
          </div>
        ))}
      </div>
      {!total && <p className="absolute inset-x-0 top-16 text-center font-cond italic text-brown/45">Belum ada rating</p>}
    </div>
  )
}

/** one row of a checkbox question: picture, name, bar (% of people who answered), count */
function HBar({ label, img, n, share, top }: { label: string; img: string; n: number; share: number; top: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <div className="relative flex items-center gap-3" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <img src={img} alt="" className="h-10 w-8 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 font-display font-semibold">
            {label}
            {/* every drink tied for first gets it */}
            {top && <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-cond text-xs font-semibold italic text-cream"><Crown className="size-3" /> Favorit</span>}
          </span>
          <span className="font-display text-sm tabular-nums text-brown-soft">
            {n} <span className="text-brown/45">· {share}%</span>
          </span>
        </div>
        <div className="mt-1 h-3 rounded-[4px] bg-brown/[0.07]">
          <motion.div className="h-full rounded-[4px]" style={{ background: BAR }} initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={spring.glide} />
        </div>
      </div>
      {hover && <Tooltip>{`${label}: dipilih ${n} orang — ${share}% dari yang menjawab`}</Tooltip>}
    </div>
  )
}

/** feedback per 15 min across the event (stretches if answers came in outside the hours) */
function Timeline({ responses }: { responses: Response[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const step = BUCKET_MIN * 60_000
  const buckets = useMemo(() => {
    const times = responses.map((r) => r.at)
    const from = Math.floor(Math.min(EVENT.open.getTime(), ...times) / step) * step
    const to = Math.ceil(Math.max(EVENT.close.getTime() + 30 * 60_000, ...times) / step) * step
    const out: Array<{ at: number; n: number }> = []
    // a test row from days earlier would stretch this into hundreds of empty bars — cap it
    for (let t = Math.max(from, to - 48 * step); t < to; t += step) out.push({ at: t, n: times.filter((x) => x >= t && x < t + step).length })
    return out
  }, [responses, step])
  const max = Math.max(1, ...buckets.map((b) => b.n))

  return (
    <div>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-brown/20">
        {[0.5, 1].map((g) => (
          <span key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-brown/10" style={{ bottom: `${g * 100}%` }} />
        ))}
        {buckets.map((b, i) => (
          <div key={b.at} className="relative flex h-full flex-1 items-end" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <motion.span
              className="w-full rounded-t-[4px]"
              style={{ background: BAR, opacity: hover === null || hover === i ? 1 : 0.45, minHeight: b.n ? 4 : 0 }}
              initial={{ height: 0 }}
              animate={{ height: `${(b.n / max) * 92}%` }}
              transition={spring.glide}
            />
            {hover === i && <Tooltip>{`${hhmm(b.at)}–${hhmm(b.at + step)} · ${b.n} feedback`}</Tooltip>}
          </div>
        ))}
      </div>
      {/* hour ticks only — every bar would be unreadable */}
      <div className="mt-1.5 flex gap-[2px]">
        {buckets.map((b) => (
          <span key={b.at} className="flex-1 text-center font-cond text-xs italic text-brown/55">
            {new Date(b.at).getUTCMinutes() === 0 ? hhmm(b.at).slice(0, 2) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function Tooltip({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-brown px-3 py-1.5 font-display text-xs font-semibold text-cream shadow-lg">
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ bits */

/** a CSV that Excel / Google Sheets / Docs open cleanly (BOM for Excel's UTF-8) */
function saveCsv(file: string, head: string[], rows: unknown[][]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const blob = new Blob(['\ufeff' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${file}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

const downloadCsv = (rs: Response[]) =>
  saveCsv(
    'pletok-feedback',
    ['Waktu', 'Rating', 'Menu favorit', 'Like', 'Wishes', 'Questions', 'Ideas', 'Nama', 'Kontak', 'Boleh dihubungi', 'Sumber'],
    rs.map((r) => [dayTime(r.at), r.rating ?? '', r.favorites, r.like, r.wish, r.question, r.idea, r.name, r.consent ? r.contact : '', r.consent ? 'ya' : 'tidak', r.source]),
  )

const downloadOrders = (os: Order[]) =>
  saveCsv(
    'pletok-preorder',
    ['Waktu', 'Kode', 'Kode cek', 'Nama', 'WhatsApp', 'Pesanan', 'Total (Rp)', 'Catatan', 'Status', 'Bayar via', 'Nama rekening pengirim', 'Kode terkirim', 'Promo (Rp)'],
    os.map((o) => [dayTime(o.at), o.code, o.ref, o.name, o.wa, o.summary, o.total * 1000, o.note, STATUS_LABEL[o.status], o.pay, o.sender, o.sent ? 'ya' : '', (o.promo ?? 0) * 1000]),
  )

/** wrong PINs and visits to the fake /admin — the newest first */
function SecurityCard({ events }: { events: SecurityEvent[] }) {
  const hour = events.filter((e) => e.at > Date.now() - 3600_000).length
  return (
    <Card
      title={<span className="flex items-center gap-2"><ShieldAlert className={`size-5 ${hour ? 'text-terracotta' : 'text-leaf'}`} /> Keamanan</span>}
      meta={hour ? `${hour} kejadian 1 jam terakhir` : 'aman — tab "Keamanan" di Sheet'}
      className={`mt-4 ${hour ? 'border-terracotta/40' : ''}`}
    >
      {events.length ? (
        <ul className="flex flex-col divide-y divide-brown/10 font-display text-sm">
          {events.slice(0, 15).map((e, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
              <span className={`font-semibold ${e.what.startsWith('Coba') ? 'text-terracotta' : ''}`}>{e.what}</span>
              <span className="text-brown-soft">{e.from}</span>
              <span className="font-cond italic text-brown/55">{e.detail}</span>
              <span className="ml-auto text-brown/55">{dayTime(e.at)}</span>
              <span className="w-full truncate font-cond text-xs italic text-brown/45">{e.ua}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-cond italic text-brown/55">Belum ada yang coba-coba. PIN salah & yang buka /admin palsu bakal muncul di sini.</p>
      )}
    </Card>
  )
}

function demoBooth(): QueueOrder[] {
  const pays = ['Tunai', 'QRIS', 'Tunai', 'Transfer BCA', 'QRIS', 'Tunai']
  return pays.map((pay, i) => ({ src: 'booth', id: `b${i}`, code: `B-00${i + 1}`, name: '', at: Date.now() - i * 600_000, total: [20, 35, 18, 52, 20, 40][i], pay, note: '', done: i > 2, lines: [] }))
}

function demoResults(): Results {
  const open = EVENT.open.getTime()
  const words = {
    like: ['Jahenya hangat banget, pas!', 'Lychee-nya seger parah', 'Kemasannya lucu', 'Booth-nya rame dan ramah'],
    wish: ['Es-nya kebanyakan', 'Antriannya agak lama', 'Pengen ada ukuran besar'],
    question: ['Ini beneran 0% alkohol?', 'Jual online juga nggak?'],
    idea: ['Rasa mangga!', 'Paket buat ber-4', 'Kolab sama kopi'],
  }
  const favs = ['Original', 'Lychee Sparkling', 'Yakult', 'Original, Yakult', 'Original, Lychee Sparkling, Yakult', 'Lychee Sparkling']
  const responses = Array.from({ length: 46 }, (_, i) => {
    const pick = <T,>(a: T[]) => a[(i * 7 + a.length) % a.length]
    return {
      at: open + ((i * 37) % 170) * 60_000 + (i % 3) * 20_000,
      rating: [5, 4, 5, 3, 4, 5, 2, 4, 5, 4][i % 10],
      favorites: pick(favs),
      like: i % 2 ? pick(words.like) : '',
      wish: i % 3 === 0 ? pick(words.wish) : '',
      question: i % 5 === 0 ? pick(words.question) : '',
      idea: i % 4 === 0 ? pick(words.idea) : '',
      name: i % 3 ? `Pengunjung ${i + 1}` : '',
      contact: i % 4 === 1 ? `@contoh${i}` : '',
      consent: i % 4 === 1,
      source: 'link',
    }
  })
  const names = ['Nadia', 'Raka', 'Salsa', 'Bima', 'Citra', 'Dimas', 'Aurel', 'Fikri']
  const orders: Order[] = names.map((name, i) => {
    const lines = [PREORDER_ITEMS[i % 6], ...(i % 3 ? [] : [PREORDER_ITEMS[(i + 2) % 6]])].map((it, j) => ({ id: it.id, name: it.name, qty: 1 + ((i + j) % 2), price: it.price }))
    const status: OrderStatus = (['done', 'done', 'process', 'process', 'process', 'hold', 'hold', 'rejected'] as const)[i]
    return {
      at: open - (30 - i * 3) * 3_600_000,
      code: status === 'process' || status === 'done' ? pickupCode(name, i + 1) : '',
      proof: i % 4 === 3 ? '' : '#',
      id: `demo-${i}`,
      ref: ['K7Q2MX', 'PA4R8N', 'ZT3WQE', 'M9HD2K', 'C5YB7R', 'W2NJ6T', 'H8EX3P', 'R4VM9G'][i],
      status,
      pay: 'BCA',
      sender: i % 3 === 0 ? `${name.toUpperCase()} PUTRA` : '',
      sent: i < 3,
      name,
      wa: `0812${String(10000000 + i * 1234567).slice(0, 8)}`,
      summary: lines.map((l) => `${l.qty}× ${l.name}`).join(', '),
      total: lines.reduce((a, l) => a + l.qty * l.price, 0),
      note: i % 4 === 1 ? 'Less sugar ya kak' : '',
      lines,
    }
  })
  return { sheetUrl: '#', responses, orders, scans: Array.from({ length: 128 }, (_, i) => ({ at: open + i * 80_000, target: 'link' })) }
}
