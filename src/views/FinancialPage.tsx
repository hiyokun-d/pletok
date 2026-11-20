import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Banknote, Calculator, Check, Coins, CupSoda, Download, FileText, HandCoins, Landmark, Loader2, Plus, QrCode, RefreshCw, Scale, ShieldAlert, Target, Trash2, TrendingUp, Users, Wallet, X } from 'lucide-react'
import { BACKEND, crewPin, warm, fetchQueue, fetchResults, makeFinanceReport, saveClosing, saveFinance, type ClosingCount, type CostLine, type FinanceConfig, type MoneyHolders, type Order, type QueueOrder } from '../lib/backend'
import { DEFAULT_FINANCE, KAS, POT_IDS, byHour, heldIn, idr, salesOf, settle, summarize, type Pot, type Summary } from '../lib/finance'
import { DRINKS } from '../data/menu'
import { EVENT } from '../data/event'
import { csvBlob, saveFile } from '../lib/download'
import { spring } from '../lib/motion'
import { Btn, Card, CrewNav, DEMO, Empty, PinGate, Shell, Tile, WAIT, hhmm, useCrewPage, wait } from './adminUi'
import { BAR, ColumnChart, HBar } from './HasilPage'

/**
 * /financial — the money side of the day, for the crew (same PIN). Live from the Sheet like /hasil:
 *   - omzet, laba kotor (after the HPP of every cup sold), laba bersih (after everything spent) and
 *     how far we are from "balik modal"
 *   - the day hour by hour, the drink mix, bundles vs singles, the promo's cost, target vs actual
 *   - closing: each money holder counts what they really have; the page compares it with the system
 *   - bagi hasil: who paid for what out of pocket, who holds the money, the fewest transfers to settle
 *   - the report: CSV, or a Google Doc in Drive
 * The cost numbers start from BEC_VENTURE and are edited here; they're saved as script properties,
 * so the Sheet never gets an extra tab.
 */

const REFRESH_MS = 30_000
const POTS: Record<Pot, { label: string; Icon: typeof Landmark; where: string }> = {
  tunai: { label: 'Tunai', Icon: Banknote, where: 'kotak uang' },
  bca: { label: 'Transfer BCA', Icon: Landmark, where: 'rekening BCA' },
  qris: { label: 'QRIS', Icon: QrCode, where: 'GoPay Merchant' },
}
const digits = (v: string) => Number(v.replace(/\D/g, '').slice(0, 10)) || 0

export function FinancialPage() {
  const [pin, setPin] = useState(DEMO ? 'demo' : crewPin)
  // starts on the copy the other crew pages preloaded, then refreshes
  const [first] = useState(() => (DEMO ? null : warm('results')))
  const [orders, setOrders] = useState<Order[] | null>(DEMO ? [] : (first?.data.orders ?? null))
  const [booth, setBooth] = useState<QueueOrder[] | null>(() => (DEMO ? demoBooth() : (warm('queue')?.data.filter((o) => o.src === 'booth') ?? null)))
  const [finance, setFinance] = useState<FinanceConfig | null>(DEMO ? DEFAULT_FINANCE : first ? (first.data.finance ?? DEFAULT_FINANCE) : null)
  const [closing, setClosing] = useState<Partial<Record<Pot, ClosingCount>>>(first?.data.closing ?? {})
  const [holders, setHolders] = useState<MoneyHolders>(DEMO ? { tunai: 'Nabil', bca: 'Calvin', qris: 'Elisha' } : (first?.data.money ?? { bca: '', qris: '', tunai: '' }))
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'pin'>('idle')
  const [at, setAt] = useState<number | undefined>(DEMO ? Date.now() : first?.at)
  useCrewPage('Financial')

  const load = useCallback(async () => {
    if (!pin || DEMO) return
    setState('loading')
    const [r, q] = await Promise.all([fetchResults(pin), fetchQueue(pin)])
    if (r === 'pin' || q === 'pin') {
      setState('pin')
      setPin(null)
      return
    }
    if (!r) return setState('error')
    setOrders(r.orders ?? [])
    setFinance(r.finance ?? DEFAULT_FINANCE)
    setClosing(r.closing ?? {})
    setHolders(r.money ?? { bca: '', qris: '', tunai: '' })
    // the booth list is a separate call — keep the last good one if only this part failed
    if (Array.isArray(q)) setBooth(q.filter((o) => o.src === 'booth'))
    setAt(Date.now())
    setState('idle')
  }, [pin])
  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  const f = finance ?? DEFAULT_FINANCE
  const sales = useMemo(() => salesOf(orders ?? [], booth ?? []), [orders, booth])
  const s = useMemo(() => summarize(sales, f), [sales, f])

  if (!BACKEND && !DEMO) return <Shell><Empty title="Belum tersambung" text="VITE_BACKEND_URL belum diisi — lihat apps-script/README.md." /></Shell>
  if (!pin) return <Shell><PinGate title="Financial Pletok" wrong={state === 'pin'} onOk={setPin} /></Shell>

  return (
    <Shell>
      <CrewNav at="financial" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.3em] text-terracotta">{EVENT.table} · {EVENT.name}</p>
          <h1 className="font-display text-4xl font-bold leading-none">Financial</h1>
          <p className="mt-1.5 font-cond text-base italic text-brown-soft">
            {state === 'error' ? 'Gagal ambil data — angka di bawah dari pengambilan terakhir' : at ? `Diperbarui ${hhmm(at)} · otomatis tiap 30 detik${booth ? '' : ' · penjualan booth belum termuat'}` : 'Mengambil data…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void load()} icon={<RefreshCw className={`size-4 ${state === 'loading' ? 'animate-spin' : ''}`} />}>Muat ulang</Btn>
        </div>
      </header>

      {!orders ? (
        <p className="mt-10 flex items-center gap-2 font-cond italic text-brown/55"><Loader2 className="size-4 animate-spin" /> Memuat angka…</p>
      ) : (
        <>
          <Headline s={s} f={f} />
          <BreakEven s={s} />
          <Flow s={s} f={f} hours={byHour(sales)} />
          <Closing
            s={s}
            closing={closing}
            holders={holders}
            save={async (pot, counted, by) => {
              if (DEMO) {
                await wait(600)
                setClosing((c) => ({ ...c, [pot]: counted === null ? undefined : { counted, by, at: Date.now() } }))
                return true
              }
              const r = await saveClosing(pin, pot, counted, by)
              if (r) setClosing(r)
              return !!r
            }}
          />
          <Settle f={f} s={s} closing={closing} holders={holders} />
          <Costs
            f={f}
            save={async (next) => {
              const ok = DEMO ? (await wait(800), true) : await saveFinance(pin, next)
              if (ok) setFinance(next)
              return ok
            }}
          />
          <Report f={f} s={s} sales={sales.length} hours={byHour(sales)} closing={closing} holders={holders} pin={pin} />
        </>
      )}
    </Shell>
  )
}

/* ------------------------------------------------------------------ the headline */

function Headline({ s, f }: { s: Summary; f: FinanceConfig }) {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-3xl bg-brown p-5 text-cream">
        <span className="flex items-center gap-2 font-cond text-sm italic text-cream/70"><Wallet className="size-4" /> Omzet</span>
        <p className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">{idr(s.omzet)}</p>
        <p className="mt-1.5 font-cond text-xs italic text-cream/70">{s.n} transaksi · rata-rata {idr(s.avgTicket)} · target {idr(f.target.omzet)}</p>
      </div>
      <Tile Icon={CupSoda} label="Cup terjual" value={s.cupsTotal} unit={`/ ${f.target.cups}`} sub={`${f.target.cups ? Math.round((s.cupsTotal / f.target.cups) * 100) : 0}% dari target · ${s.bundles} paket, ${s.singles} satuan`} />
      <Tile Icon={TrendingUp} label="Laba kotor (− HPP)" value={idr(s.labaKotor)} sub={`HPP cup terjual ${idr(s.hppUsed)}`} />
      <Tile Icon={Scale} label="Laba bersih (− semua biaya)" value={idr(s.labaBersih)} sub={`biaya ${idr(s.spent)} · sisa stok senilai ${idr(Math.max(0, s.sisaStok))}`} />
    </div>
  )
}

/** one bar from 0 to "everything spent" — the moment omzet crosses it, the day has paid for itself */
function BreakEven({ s }: { s: Summary }) {
  const p = s.spent ? Math.min(1, s.omzet / s.spent) : 1
  const cupsLeft = Math.ceil(s.toBep / s.perCup)
  const done = s.toBep === 0
  return (
    <Card className="mt-4" title={<span className="flex items-center gap-2"><Target className="size-5 text-terracotta" /> Balik modal</span>} meta={`modal ${idr(s.modal)} + biaya lain ${idr(s.ops)}`}>
      <div className="relative h-6 overflow-hidden rounded-[6px] bg-brown/[0.07]" role="img" aria-label={`Omzet ${idr(s.omzet)} dari ${idr(s.spent)} yang dikeluarkan (${Math.round(p * 100)}%)`}>
        <motion.div className="h-full rounded-[6px]" style={{ background: done ? 'var(--color-leaf, #5e7b3a)' : BAR }} initial={{ width: 0 }} animate={{ width: `${p * 100}%` }} transition={spring.glide} />
      </div>
      <p className="mt-3 font-display text-lg">
        {done ? (
          <>
            <b className="text-leaf">Sudah balik modal!</b> Semua yang dikeluarkan tertutup — tiap cup sekarang untung bersih.
          </>
        ) : (
          <>
            Kurang <b>{idr(s.toBep)}</b> lagi ≈ <b>{cupsLeft} cup</b> <span className="font-cond italic text-brown-soft">(dengan rata-rata {idr(s.perCup)} per cup)</span>
          </>
        )}
      </p>
    </Card>
  )
}

/* ------------------------------------------------------------------ how the day went */

function Flow({ s, f, hours }: { s: Summary; f: FinanceConfig; hours: ReturnType<typeof byHour> }) {
  const pay = POT_IDS.map((p) => ({ p, ...s.pots[p] }))
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card title={<span className="flex items-center gap-2"><TrendingUp className="size-5 text-terracotta" /> Omzet per jam</span>} meta="WIB · pre-order dihitung terpisah">
        <ColumnChart
          bars={hours.map((h) => ({ label: h.sub, sub: h.label, n: h.sum }))}
          total={s.omzet}
          empty="Belum ada penjualan"
          value={(b) => (b.n ? `${Math.round(b.n / 1000)}K` : '')}
          tip={(b) => {
            const h = hours.find((x) => x.label === b.sub)!
            return `${h.label}${h.key === 'pre' ? '' : ` ${h.sub}`}: ${idr(h.sum)} dari ${h.n} transaksi`
          }}
        />
      </Card>
      <Card title={<span className="flex items-center gap-2"><CupSoda className="size-5 text-terracotta" /> Cup per rasa</span>} meta={`${s.cupsTotal} cup · paket dihitung per isi`}>
        <div className="flex flex-col gap-3">
          {DRINKS.map((d) => (
            <HBar key={d.id} label={d.short} img={d.image} n={s.cups[d.id]} share={s.cupsTotal ? Math.round((s.cups[d.id] / s.cupsTotal) * 100) : 0} top={false} />
          ))}
        </div>
        <p className="mt-4 font-cond text-sm italic text-brown-soft">
          HPP/cup: {DRINKS.map((d) => `${d.short} ${idr(f.hpp[d.id] ?? 0)}`).join(' · ')}
          {s.promo > 0 && ` · promo pre-order yang diberikan ${idr(s.promo)}`}
        </p>
      </Card>
      <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><Coins className="size-5 text-terracotta" /> Masuk lewat</span>} meta="pre-order terverifikasi + booth (yang batal tidak dihitung)">
        <div className="grid gap-3 sm:grid-cols-3">
          {pay.map(({ p, sum, n, po, booth }) => {
            const { label, Icon } = POTS[p]
            return (
              <div key={p} className="rounded-2xl border border-brown/10 bg-cream/80 p-4">
                <span className="flex items-center gap-2 font-cond text-sm italic text-brown-soft"><Icon className="size-4 text-terracotta" /> {label}</span>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{idr(sum)}</p>
                <p className="font-cond text-xs italic text-brown/55">{n} transaksi · pre-order {idr(po)} · booth {idr(booth)}{s.omzet ? ` · ${Math.round((sum / s.omzet) * 100)}%` : ''}</p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ closing count */

/**
 * End of the day: each holder counts their pot (cash box, BCA mutasi, GoPay Merchant saldo) and
 * types it in. The difference from what the system expects shows right away, with the usual reasons.
 */
function Closing({ s, closing, holders, save }: { s: Summary; closing: Partial<Record<Pot, ClosingCount>>; holders: MoneyHolders; save: (pot: Pot, counted: number | null, by: string) => Promise<boolean> }) {
  const counted = POT_IDS.filter((p) => closing[p])
  const gap = counted.reduce((t, p) => t + (closing[p]!.counted - s.pots[p].sum), 0)
  return (
    <Card
      className="mt-4"
      title={<span className="flex items-center gap-2"><Calculator className="size-5 text-terracotta" /> Hitung kas (closing)</span>}
      meta={counted.length ? `${counted.length}/3 sudah dihitung · selisih total ${gap === 0 ? 'Rp0 — pas' : idr(gap)}` : 'isi setelah booth tutup — angka tersimpan di server'}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {POT_IDS.map((p) => (
          <CountPot key={p} pot={p} expected={s.pots[p].sum} count={closing[p]} holder={holders[p]} save={save} />
        ))}
      </div>
    </Card>
  )
}

const WHY: Record<Pot, { more: string; less: string }> = {
  tunai: { more: 'Ada penjualan yang belum diinput di /cashier, atau kembalian kurang diberikan.', less: 'Kembalian kelebihan, uang dipakai beli es/dll (catat di biaya), atau penjualan dicatat tunai padahal QRIS/BCA.' },
  bca: { more: 'Ada transfer yang belum diverifikasi di /hasil, atau transfer pribadi masuk ke rekening yang sama.', less: 'Mutasi belum masuk (cek lagi nanti), atau pre-order diverifikasi padahal transfernya belum ada.' },
  qris: { more: 'Ada pembayaran QRIS yang tidak diinput di /cashier.', less: 'Potongan MDR GoPay (biasanya kecil), saldo belum masuk, atau "lunas" ditekan sebelum notif masuk.' },
}

function CountPot({ pot, expected, count, holder, save }: { pot: Pot; expected: number; count?: ClosingCount; holder: string; save: (pot: Pot, counted: number | null, by: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(count ? count.counted.toLocaleString('id-ID') : '')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => setDraft(count ? count.counted.toLocaleString('id-ID') : ''), [count])
  const { label, Icon, where } = POTS[pot]
  const diff = count ? count.counted - expected : 0
  const commit = async () => {
    const raw = draft.trim()
    const next = raw ? digits(raw) : null
    if ((next ?? null) === (count?.counted ?? null) || busy) return
    setBusy(true)
    const ok = await save(pot, next, holder)
    setFailed(!ok)
    setBusy(false)
  }
  return (
    <div className="rounded-2xl border border-brown/10 bg-cream/80 p-4 font-display">
      <span className="flex items-center gap-2 font-cond text-sm italic text-brown-soft"><Icon className="size-4 text-terracotta" /> {label} · {holder || 'belum ada pemegang'}</span>
      <p className="mt-1 text-sm text-brown-soft">Menurut sistem <b className="tabular-nums text-brown">{idr(expected)}</b></p>
      <label className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: busy || draft.trim() !== (count ? count.counted.toLocaleString('id-ID') : '') ? `${WAIT}66` : 'rgb(90 46 26 / 0.06)' }}>
        <span className="text-sm text-brown-soft">Rp</span>
        <input
          value={draft}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(0, 10)
            setDraft(d ? Number(d).toLocaleString('id-ID') : '')
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          inputMode="numeric"
          placeholder={`isi hasil hitung ${where}`}
          aria-label={`Hasil hitung ${label}`}
          className="min-w-0 flex-1 bg-transparent text-lg font-bold tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-brown/40"
        />
        {busy ? <Loader2 className="size-4 animate-spin" /> : count && <Check className="size-4 text-leaf" />}
      </label>
      {failed && <p className="mt-1 font-cond text-xs italic text-terracotta">Gagal menyimpan — cek sinyal, lalu coba lagi</p>}
      <AnimatePresence initial={false}>
        {count && (
          <motion.div key="diff" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${diff === 0 ? 'bg-leaf/15 text-leaf' : 'text-brown'}`} style={diff === 0 ? undefined : { background: `${WAIT}40` }}>
              {diff === 0 ? (
                <><Check className="mr-1 inline size-4" /> Pas — cocok dengan sistem</>
              ) : (
                <>
                  <ShieldAlert className="mr-1 inline size-4" /> {diff > 0 ? 'Lebih' : 'Kurang'} <b className="tabular-nums">{idr(Math.abs(diff))}</b>
                  <span className="mt-0.5 block font-cond text-xs italic text-brown-soft">{diff > 0 ? WHY[pot].more : WHY[pot].less}</span>
                </>
              )}
            </p>
            <p className="mt-1 font-cond text-xs italic text-brown/55">dihitung {hhmm(count.at)}{count.by ? ` · ${count.by}` : ''}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ bagi hasil */

function Settle({ f, s, closing, holders }: { f: FinanceConfig; s: Summary; closing: Partial<Record<Pot, ClosingCount>>; holders: MoneyHolders }) {
  const r = useMemo(() => settle(f, holders, heldIn(s, closing)), [f, s, closing, holders])
  const estimated = POT_IDS.some((p) => !closing[p])
  return (
    <Card
      className="mt-4"
      title={<span className="flex items-center gap-2"><HandCoins className="size-5 text-terracotta" /> Reimburse & bagi hasil</span>}
      meta={estimated ? 'pakai angka sistem untuk kas yang belum dihitung' : 'dari hasil hitung kas'}
    >
      <p className="mb-3 font-display text-sm text-brown-soft">
        Yang nalangin biaya dapat uangnya kembali dulu. Sisanya ({r.profit >= 0 ? 'laba' : 'rugi'} <b className="text-brown">{idr(r.profit)}</b>) {f.crew.filter((c) => c.trim()).length ? `dibagi rata ke ${f.crew.filter((c) => c.trim()).length} crew` : `masuk ${KAS} — isi daftar crew di bawah kalau mau dibagi`}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left font-display text-sm">
          <thead className="font-cond italic text-brown/55">
            <tr>
              <th className="py-1.5 font-normal">Nama</th>
              <th className="py-1.5 text-right font-normal">Pegang uang</th>
              <th className="py-1.5 text-right font-normal">Nalangin</th>
              <th className="py-1.5 text-right font-normal">Bagian laba</th>
              <th className="py-1.5 text-right font-normal">Hasil akhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brown/10">
            {r.people.map((p) => (
              <tr key={p.name}>
                <td className="py-2 font-semibold">{p.name}</td>
                <td className="py-2 text-right tabular-nums">{p.holds ? idr(p.holds) : '—'}</td>
                <td className="py-2 text-right tabular-nums">{p.paid ? idr(p.paid) : '—'}</td>
                <td className="py-2 text-right tabular-nums">{p.share ? idr(p.share) : '—'}</td>
                <td className={`py-2 text-right font-bold tabular-nums ${p.net > 0 ? 'text-terracotta' : p.net < 0 ? 'text-leaf' : ''}`}>{p.net > 0 ? `serahkan ${idr(p.net)}` : p.net < 0 ? `terima ${idr(-p.net)}` : 'pas'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.transfers.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {r.transfers.map((t, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-brown/[0.06] px-4 py-2.5 font-display">
              <b>{t.from}</b> <ArrowRight className="size-4 text-terracotta" /> <b>{t.to}</b>
              <span className="ml-auto text-lg font-bold tabular-nums">{idr(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ costs (editable) */

/** the BEC_VENTURE numbers, editable by any crew phone — one "Simpan" for the lot */
function Costs({ f, save }: { f: FinanceConfig; save: (f: FinanceConfig) => Promise<boolean> }) {
  const [draft, setDraft] = useState(f)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => setDraft(f), [f])
  const dirty = JSON.stringify(draft) !== JSON.stringify(f)
  const commit = async () => {
    setBusy(true)
    const ok = await save({ ...draft, crew: draft.crew.map((c) => c.trim()).filter(Boolean) })
    setFailed(!ok)
    setBusy(false)
  }
  const setLines = (k: 'modal' | 'ops', lines: CostLine[]) => setDraft((d) => ({ ...d, [k]: lines }))
  return (
    <Card className="mt-4" title={<span className="flex items-center gap-2"><FileText className="size-5 text-terracotta" /> Biaya, HPP & target</span>} meta="awalnya dari BEC_VENTURE · ubah di sini kalau ada yang berubah">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-cond text-sm font-semibold uppercase italic tracking-[0.2em] text-brown/55">HPP per cup</p>
          <div className="grid grid-cols-3 gap-2">
            {DRINKS.map((d) => (
              <Money key={d.id} label={d.short} value={draft.hpp[d.id] ?? 0} onChange={(v) => setDraft((x) => ({ ...x, hpp: { ...x.hpp, [d.id]: v } }))} />
            ))}
          </div>
          <p className="mb-2 mt-4 font-cond text-sm font-semibold uppercase italic tracking-[0.2em] text-brown/55">Target</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-xl bg-brown/[0.06] px-3 py-2 font-display">
              <span className="block font-cond text-xs italic text-brown/55">Cup</span>
              <input value={draft.target.cups || ''} onChange={(e) => setDraft((x) => ({ ...x, target: { ...x.target, cups: digits(e.target.value) } }))} inputMode="numeric" className="w-full bg-transparent font-bold tabular-nums outline-none" />
            </label>
            <Money label="Omzet" value={draft.target.omzet} onChange={(v) => setDraft((x) => ({ ...x, target: { ...x.target, omzet: v } }))} />
          </div>
          <p className="mb-2 mt-4 flex items-center gap-1.5 font-cond text-sm font-semibold uppercase italic tracking-[0.2em] text-brown/55"><Users className="size-4" /> Crew yang bagi laba</p>
          <input
            value={draft.crew.join(', ')}
            onChange={(e) => setDraft((x) => ({ ...x, crew: e.target.value.split(',').map((c) => c.trimStart()).slice(0, 20) }))}
            placeholder="Nama, pisah pakai koma — kosong = laba masuk Kas tim"
            className="w-full rounded-xl bg-brown/[0.06] px-3 py-2.5 font-display text-sm outline-none focus:ring-2 focus:ring-terracotta"
          />
        </div>
        <div className="flex flex-col gap-4">
          <Lines title="Modal (bahan & cup)" lines={draft.modal} onChange={(l) => setLines('modal', l)} />
          <Lines title="Biaya lain (Quotation)" lines={draft.ops} onChange={(l) => setLines('ops', l)} />
        </div>
      </div>
      <AnimatePresence>
        {(dirty || failed) && (
          <motion.div key="save" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="sticky bottom-3 mt-4 flex flex-wrap items-center gap-2 rounded-2xl p-3 font-display text-brown shadow-lg" style={{ background: WAIT }}>
            <span className="flex-1 text-sm font-semibold">{failed ? 'Gagal menyimpan — cek sinyal, lalu coba lagi' : 'Ada perubahan yang belum disimpan'}</span>
            <button type="button" onClick={() => (setDraft(f), setFailed(false))} className="rounded-full border-2 border-brown/25 px-3.5 py-1.5 text-sm font-semibold">Batal</button>
            <button type="button" onClick={() => void commit()} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-brown px-4 py-1.5 text-sm font-semibold text-cream">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Simpan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function Money({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="rounded-xl bg-brown/[0.06] px-3 py-2 font-display">
      <span className="block font-cond text-xs italic text-brown/55">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-xs text-brown/55">Rp</span>
        <input value={value ? value.toLocaleString('id-ID') : ''} onChange={(e) => onChange(digits(e.target.value))} inputMode="numeric" placeholder="0" className="w-full min-w-0 bg-transparent font-bold tabular-nums outline-none" />
      </span>
    </label>
  )
}

function Lines({ title, lines, onChange }: { title: string; lines: CostLine[]; onChange: (l: CostLine[]) => void }) {
  const set = (i: number, p: Partial<CostLine>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...p } : l)))
  return (
    <div>
      <p className="mb-2 flex items-baseline justify-between font-cond text-sm font-semibold uppercase italic tracking-[0.2em] text-brown/55">
        {title} <span className="normal-case tracking-normal">{idr(lines.reduce((t, l) => t + (l.amount || 0), 0))}</span>
      </p>
      <ul className="flex flex-col gap-1.5">
        {lines.map((l, i) => (
          <li key={i} className="grid grid-cols-[1fr_6.5rem_auto] items-center gap-1.5 rounded-xl bg-brown/[0.06] px-2.5 py-1.5 font-display text-sm sm:grid-cols-[1fr_6.5rem_5.5rem_auto]">
            <span className="min-w-0">
              <input value={l.name} onChange={(e) => set(i, { name: e.target.value.slice(0, 60) })} placeholder="Nama" aria-label="Nama biaya" className="w-full bg-transparent font-semibold outline-none" />
              <input value={l.detail ?? ''} onChange={(e) => set(i, { detail: e.target.value.slice(0, 60) })} placeholder="keterangan" aria-label="Keterangan" className="w-full bg-transparent font-cond text-xs italic text-brown-soft outline-none" />
            </span>
            <span className="flex items-baseline gap-0.5 rounded-lg bg-cream/70 px-2 py-1">
              <span className="text-xs text-brown/55">Rp</span>
              <input value={l.amount ? l.amount.toLocaleString('id-ID') : ''} onChange={(e) => set(i, { amount: digits(e.target.value) })} inputMode="numeric" placeholder="0" aria-label={`Harga ${l.name}`} className="w-full min-w-0 bg-transparent text-right font-bold tabular-nums outline-none" />
            </span>
            <input value={l.by ?? ''} onChange={(e) => set(i, { by: e.target.value.slice(0, 40) })} placeholder="dibayar siapa" aria-label={`Yang bayar ${l.name}`} className="col-span-2 row-start-2 rounded-lg bg-cream/70 px-2 py-1 text-xs outline-none sm:col-span-1 sm:row-start-auto" />
            <button type="button" onClick={() => onChange(lines.filter((_, k) => k !== i))} aria-label={`Hapus ${l.name}`} className="grid size-7 place-items-center rounded-full text-brown/50 hover:bg-terracotta/10 hover:text-terracotta">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange([...lines, { name: '', amount: 0, detail: '', by: '' }])} className="mt-1.5 flex items-center gap-1 rounded-full border-2 border-dashed border-brown/20 px-3 py-1 font-display text-xs font-semibold text-brown-soft">
        <Plus className="size-3.5" /> Tambah baris
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ the report */

function Report({ f, s, sales, hours, closing, holders, pin }: { f: FinanceConfig; s: Summary; sales: number; hours: ReturnType<typeof byHour>; closing: Partial<Record<Pot, ClosingCount>>; holders: MoneyHolders; pin: string }) {
  const [doc, setDoc] = useState<'idle' | 'busy' | 'error' | string>('idle')
  const title = `Pletok — Laporan Keuangan ${EVENT.name}`
  const sections = () => {
    const r = settle(f, holders, heldIn(s, closing))
    return [
      {
        heading: 'Ringkasan',
        rows: [
          ['', 'Rp'],
          ['Omzet', idr(s.omzet)],
          ['HPP cup terjual', idr(s.hppUsed)],
          ['Laba kotor', idr(s.labaKotor)],
          ['Modal (bahan & cup)', idr(s.modal)],
          ['Biaya lain', idr(s.ops)],
          ['Laba bersih', idr(s.labaBersih)],
          ['Sisa stok (nilai HPP)', idr(Math.max(0, s.sisaStok))],
          ['Transaksi', String(sales)],
          ['Cup terjual / target', `${s.cupsTotal} / ${f.target.cups}`],
          ['Rata-rata per transaksi', idr(s.avgTicket)],
          ['Promo pre-order diberikan', idr(s.promo)],
        ],
      },
      { heading: 'Cup per rasa', rows: [['Rasa', 'Cup', 'HPP/cup', 'HPP total'], ...DRINKS.map((d) => [d.short, String(s.cups[d.id]), idr(f.hpp[d.id] ?? 0), idr(s.cups[d.id] * (f.hpp[d.id] ?? 0))])] },
      { heading: 'Omzet per jam (WIB)', rows: [['Jam', 'Transaksi', 'Omzet'], ...hours.map((h) => [h.key === 'pre' ? 'Pre-order' : `${h.label}${h.sub}`, String(h.n), idr(h.sum)])] },
      {
        heading: 'Kas per akun',
        rows: [['Akun', 'Pemegang', 'Menurut sistem', 'Dihitung', 'Selisih'], ...POT_IDS.map((p) => [POTS[p].label, holders[p] || '—', idr(s.pots[p].sum), closing[p] ? idr(closing[p]!.counted) : 'belum', closing[p] ? idr(closing[p]!.counted - s.pots[p].sum) : '—'])],
      },
      { heading: 'Modal', rows: [['Item', 'Keterangan', 'Harga', 'Dibayar oleh'], ...f.modal.map((l) => [l.name, l.detail ?? '', idr(l.amount), l.by || KAS])] },
      { heading: 'Biaya lain', rows: [['Item', 'Keterangan', 'Harga', 'Dibayar oleh'], ...f.ops.map((l) => [l.name, l.detail ?? '', idr(l.amount), l.by || KAS])] },
      {
        heading: 'Reimburse & bagi hasil',
        note: POT_IDS.some((p) => !closing[p]) ? 'Sebagian kas belum dihitung — memakai angka sistem.' : undefined,
        rows: [['Nama', 'Pegang uang', 'Nalangin', 'Bagian laba', 'Hasil akhir'], ...r.people.map((p) => [p.name, idr(p.holds), idr(p.paid), idr(p.share), p.net > 0 ? `serahkan ${idr(p.net)}` : p.net < 0 ? `terima ${idr(-p.net)}` : 'pas']), ...r.transfers.map((t) => [`${t.from} → ${t.to}`, '', '', '', idr(t.amount)])],
      },
    ]
  }
  const csv = () => {
    const rows: string[][] = [[title], [`Dibuat ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`]]
    sections().forEach((x) => rows.push([], [x.heading], ...(x.note ? [[x.note]] : []), ...x.rows))
    saveFile(`Pletok Laporan Keuangan ${new Date().toISOString().slice(0, 10)}.csv`, csvBlob(rows))
  }
  const gdoc = async () => {
    setDoc('busy')
    const url = DEMO ? (await wait(900), '#') : await makeFinanceReport(pin, `${title} · ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, sections())
    setDoc(url ?? 'error')
  }
  return (
    <Card className="mt-4" title={<span className="flex items-center gap-2"><Download className="size-5 text-terracotta" /> Laporan keuangan</span>} meta="semua angka di halaman ini, siap dikumpulkan">
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={csv} icon={<Download className="size-4" />}>Unduh CSV</Btn>
        <Btn onClick={() => void gdoc()} icon={doc === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} solid>
          Buat Google Doc
        </Btn>
        {/* a link to tap, not a popup — Safari blocks windows opened after waiting on the network */}
        {doc !== 'idle' && doc !== 'busy' && doc !== 'error' && (
          <a href={doc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-4 py-2.5 font-display text-sm font-semibold text-cream">
            <Check className="size-4" /> Buka laporannya
          </a>
        )}
        {doc === 'error' && (
          <span className="flex items-center gap-1.5 font-cond text-sm italic text-terracotta">
            <X className="size-4" /> Gagal — cek sinyal, atau Code.gs belum di-deploy versi baru
          </span>
        )}
      </div>
      <p className="mt-2 font-cond text-sm italic text-brown-soft">Google Doc tersimpan di Drive akun pemilik script — bukan di Sheet.</p>
    </Card>
  )
}

/* dev: /financial?demo — a believable afternoon without the Sheet */
function demoBooth(): QueueOrder[] {
  const day = new Date('2026-11-25T13:00:00+07:00').getTime()
  const kinds = [
    { id: 'original', name: 'Pletok Original', price: 18, drinks: ['original'] },
    { id: 'yakult', name: 'Pletok Yakult', price: 20, drinks: ['yakult'] },
    { id: 'lychee', name: 'Pletok Lychee Sparkling', price: 20, drinks: ['lychee'] },
    { id: 'duo-klasik', name: 'Paket Duo Klasik', price: 35, drinks: ['original', 'yakult'] },
    { id: 'trio-kalcer', name: 'Paket Trio Kalcer', price: 52, drinks: ['original', 'lychee', 'yakult'] },
  ]
  const pays = ['Tunai', 'QRIS', 'Tunai', 'Transfer BCA', 'QRIS']
  return Array.from({ length: 22 }, (_, i) => {
    const k = kinds[(i * 7) % kinds.length]
    const qty = i % 6 === 0 ? 2 : 1
    return { src: 'booth' as const, id: `d${i}`, code: `B-${String(i + 1).padStart(3, '0')}`, name: '', at: day + ((i * 37) % 170) * 60_000, total: k.price * qty, pay: pays[i % pays.length], note: '', done: true, lines: [{ ...k, qty }] }
  })
}
