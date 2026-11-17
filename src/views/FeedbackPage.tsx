import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, CloudOff, Frown, Heart, HelpCircle, Laugh, Lightbulb, Meh, Send, Smile, SmilePlus, Sparkles, ThumbsUp } from 'lucide-react'
import { DRINKS, type DrinkId } from '../data/menu'
import { EVENT, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../data/event'
import { BACKEND, enqueue, pendingCount } from '../lib/backend'
import { isBoothDevice } from '../lib/analytics'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'
import { trackClick } from '../lib/analytics'
import { ParticleField } from '../components/ParticleField'
import { PaperPlane } from '../components/PaperPlane'
import { InstagramIcon } from '../components/InstagramIcon'
import { Sprout } from '../components/Sprout'
import { spring } from '../lib/motion'

/** the Feedback-Capture Grid, one box each */
const GRID = [
  { key: 'like', title: 'Like', hint: 'Apa yang kamu suka? Rasa, kemasan, booth, apa aja.', Icon: ThumbsUp, tint: '#5e7b3a' },
  { key: 'wish', title: 'Wishes', hint: 'Kritik & saran — apa yang harusnya lebih baik?', Icon: Sparkles, tint: '#a8572a' },
  { key: 'question', title: 'Questions', hint: 'Ada yang bikin penasaran atau bingung?', Icon: HelpCircle, tint: '#c98a3c' },
  { key: 'idea', title: 'Ideas', hint: 'Ide rasa baru, promo, kolaborasi?', Icon: Lightbulb, tint: '#e9827f' },
] as const
type GridKey = (typeof GRID)[number]['key']

/** 1–5, cool to warm: the chosen face fills with its colour and pops */
const FACES = [
  { Icon: Frown, label: 'Kurang', tint: '#7a4a33' },
  { Icon: Meh, label: 'Biasa', tint: '#a8572a' },
  { Icon: Smile, label: 'Enak', tint: '#c98a3c' },
  { Icon: SmilePlus, label: 'Enak bgt', tint: '#5e7b3a' },
  { Icon: Laugh, label: 'Juara!', tint: '#e9827f' },
]
/** the plane loops at least this long, so a fast send still reads as "on its way" */
const MIN_FLIGHT_MS = 1600
/** a booth tablet resets for the next person by itself */
const BOOTH_RESET_MS = 8000

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export function FeedbackPage() {
  const [rating, setRating] = useState(0)
  // more than one favourite is fine — and all of them earns a little celebration
  const [favorites, setFavorites] = useState<DrinkId[]>([])
  // all of them picked → the cups clink right there in the card (no takeover)
  const [cheers, setCheers] = useState<{ key: number; pts: Array<[number, number]> }>()
  const favGrid = useRef<HTMLDivElement>(null)
  const lovesAll = favorites.length === DRINKS.length
  const [text, setText] = useState<Record<GridKey, string>>({ like: '', wish: '', question: '', idea: '' })
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [consent, setConsent] = useState(false)
  const [hp, setHp] = useState('')
  const [sent, setSent] = useState<null | 'ok' | 'queued'>(null)
  // paper plane: loops while sending, flies off when done, then the thank-you shows
  const [flight, setFlight] = useState<null | 'flying' | 'away'>(null)
  const [result, setResult] = useState<'ok' | 'queued'>('ok')
  const booth = isBoothDevice()
  const { open } = useFeedbackOpen()

  const filled = rating > 0 || favorites.length > 0 || Object.values(text).some((t) => t.trim())

  const submit = async () => {
    if (!filled || flight) return
    setFlight('flying')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const started = performance.now()
    const src = new URLSearchParams(window.location.search).get('src') ?? (booth ? 'booth' : 'web')
    await enqueue({
      type: 'feedback',
      id: newId(),
      at: Date.now(),
      rating,
      favorites,
      ...text,
      name: name.trim(),
      // contact details are only kept with the person's OK
      contact: consent ? contact.trim() : '',
      consent: consent && !!contact.trim(),
      source: src,
      ua: navigator.userAgent,
      hp,
    })
    trackClick('feedback-terkirim')
    await new Promise((r) => window.setTimeout(r, Math.max(0, MIN_FLIGHT_MS - (performance.now() - started))))
    setResult(pendingCount() === 0 ? 'ok' : 'queued')
    setFlight('away')
  }

  const reset = () => {
    setRating(0)
    setFavorites([])
    setText({ like: '', wish: '', question: '', idea: '' })
    setName('')
    setContact('')
    setConsent(false)
    setSent(null)
    setFlight(null)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (!sent || !booth) return
    const t = window.setTimeout(reset, BOOTH_RESET_MS)
    return () => window.clearTimeout(t)
  }, [sent, booth])

  return (
    <main className="paper min-h-dvh px-5 pb-16 pt-8 text-brown">
      <AnimatePresence mode="wait">
        {flight ? (
          <motion.section key="flight" className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PaperPlane
              state={flight}
              onGone={() => {
                setFlight(null)
                setSent(result)
              }}
            />
            <motion.p className="font-display text-xl font-semibold text-brown-soft" animate={{ opacity: flight === 'flying' ? [0.5, 1, 0.5] : 0 }} transition={flight === 'flying' ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }}>
              Mengirim pesanmu…
            </motion.p>
          </motion.section>
        ) : !open && !sent ? (
          <motion.section key="closed" className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <BackButton className="fixed left-5 top-6" />
            <Sprout state="grow" className="h-auto w-16" />
            <h1 className="mt-4 font-display text-3xl font-bold">Form feedback lagi tutup</h1>
            <p className="mt-3 font-display text-lg text-brown-soft">
              Dibuka saat booth buka — {EVENT.dateLabel}, {EVENT.timeLabel} di {EVENT.table}. Sampai ketemu!
            </p>
            <a href={INSTAGRAM_URL} className="mt-6 inline-flex items-center gap-2 rounded-full bg-brown px-6 py-3.5 font-display font-semibold text-cream shadow-[0_5px_0_#3a1c0f]">
              <InstagramIcon /> Follow {INSTAGRAM_HANDLE}
            </a>
          </motion.section>
        ) : sent ? (
          <motion.section key="thanks" className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <ParticleField preset="burst" overrides={{ shape: 'leaf', count: 90 }} points={[[window.innerWidth / 2, window.innerHeight * 0.35]]} burstKey={1} />
            {sent === 'queued' && (
              <motion.span className="grid size-16 place-items-center rounded-full bg-cream-deep text-brown-soft" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.pop}>
                <CloudOff className="size-8" />
              </motion.span>
            )}
            <motion.h1 className="mt-4 font-script text-6xl font-bold" initial={{ y: 30, opacity: 0, rotate: -6 }} animate={{ y: 0, opacity: 1, rotate: -3 }} transition={spring.pop}>
              Makasih!
            </motion.h1>
            <p className="mt-3 font-display text-lg text-brown-soft">
              {sent === 'ok'
                ? `Masukanmu sudah kami terima — bakal kami baca satu per satu.${lovesAll ? ' Dan makasih sudah jatuh cinta sama semua menu kami!' : ''}`
                : 'Sinyalnya lagi susah, tapi masukanmu sudah tersimpan di HP ini dan terkirim otomatis begitu sinyal balik. Boleh buka halaman ini lagi nanti ya.'}
            </p>
            {booth ? (
              <button onClick={reset} className="mt-6 rounded-full bg-brown px-6 py-3.5 font-display font-semibold text-cream shadow-[0_5px_0_#3a1c0f]">
                Giliran berikutnya →
              </button>
            ) : (
              <a href={INSTAGRAM_URL} className="mt-6 inline-flex items-center gap-2 rounded-full bg-brown px-6 py-3.5 font-display font-semibold text-cream shadow-[0_5px_0_#3a1c0f]">
                <InstagramIcon /> Follow {INSTAGRAM_HANDLE}
              </a>
            )}
          </motion.section>
        ) : (
          <motion.form
            key="form"
            className="mx-auto flex max-w-2xl flex-col gap-7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <BackButton />
            <header className="-mt-3 flex items-center gap-3">
              <Sprout state="grow" className="h-auto w-12" />
              <div>
                <h1 className="font-display text-3xl font-bold leading-none">Feedback Pletok</h1>
                <p className="mt-1 font-cond text-base italic text-brown-soft">Cukup semenit — tiap jawabanmu bikin Pletok makin enak.</p>
              </div>
            </header>

            <Field label="Seberapa enak?">
              <div className="flex justify-between gap-2">
                {FACES.map(({ Icon, label, tint }, i) => {
                  const on = rating === i + 1
                  return (
                    <motion.button
                      type="button"
                      key={label}
                      whileTap={{ scale: 0.85 }}
                      aria-label={`${i + 1} dari 5 — ${label}`}
                      onClick={() => setRating(i + 1)}
                      className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3 transition-colors"
                      style={{ background: on ? tint : 'rgb(236 220 197 / 0.8)', boxShadow: on ? `0 4px 0 ${tint}99` : 'none' }}
                    >
                      <motion.span animate={on ? { scale: [1, 1.35, 1], rotate: [0, -12, 0] } : { scale: 1 }} transition={{ duration: 0.4 }}>
                        <Icon className="size-8" strokeWidth={on ? 2.4 : 1.8} style={{ color: on ? '#f5ebdd' : rating ? '#5a2e1a55' : tint }} />
                      </motion.span>
                      <span className={`font-cond text-xs font-semibold italic ${on ? 'text-cream' : 'text-brown/60'}`}>{label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </Field>

            <Field label="Menu favorit kamu — boleh lebih dari satu">
              <ParticleField preset="burst" overrides={{ shape: 'sparkle', count: 36, burstSpeed: [160, 420], gravity: 500 }} points={cheers?.pts} burstKey={cheers?.key} />
              <div ref={favGrid} className="grid grid-cols-3 gap-2">
                {DRINKS.map((d, i) => {
                  const on = favorites.includes(d.id)
                  const side = i - (DRINKS.length - 1) / 2
                  return (
                    <motion.button
                      type="button"
                      key={d.id}
                      aria-pressed={on}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        const next = on ? favorites.filter((f) => f !== d.id) : [...favorites, d.id]
                        setFavorites(next)
                        if (!on && next.length === DRINKS.length) {
                          const r = favGrid.current?.getBoundingClientRect()
                          if (r) setCheers({ key: Date.now(), pts: [[r.left + r.width / 2, r.top + r.height * 0.35]] })
                          trackClick('suka-semua')
                        }
                      }}
                      className={`relative flex flex-col items-center rounded-2xl p-2 transition-colors ${on ? 'bg-brown text-cream' : 'bg-cream-deep/80'}`}
                    >
                      {on && (
                        <motion.span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-terracotta" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.pop}>
                          <Check className="size-3.5" strokeWidth={3} />
                        </motion.span>
                      )}
                      <motion.img
                        // a new key replays the clink each time all three get picked again
                        key={lovesAll ? `cheers-${cheers?.key}` : on ? 'on' : 'off'}
                        src={d.image}
                        alt=""
                        className="h-20 w-auto object-contain"
                        animate={lovesAll ? { x: [0, side * -16, 0], y: [0, -10, 0], rotate: [0, side * -16, 0] } : on ? { y: [0, -8, 0], rotate: [0, -6, 0] } : {}}
                        transition={{ duration: lovesAll ? 0.55 : 0.35, ease: 'easeOut' }}
                      />
                      <span className="mt-1 text-center font-display text-sm font-semibold leading-tight">{d.short}</span>
                    </motion.button>
                  )
                })}
              </div>
              <AnimatePresence>
                {lovesAll && (
                  <motion.p
                    className="mt-2 flex items-center justify-center gap-1.5 font-script text-2xl text-terracotta"
                    initial={{ opacity: 0, y: -6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={spring.pop}
                  >
                    <Heart className="size-5 fill-lychee text-lychee" /> Suka semuanya? Makasih, pecinta Pletok!
                  </motion.p>
                )}
              </AnimatePresence>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              {GRID.map(({ key, title, hint, Icon, tint }) => (
                <label key={key} className="flex flex-col rounded-3xl border-2 bg-cream/70 p-4" style={{ borderColor: `${tint}55` }}>
                  <span className="flex items-center gap-2 font-display text-lg font-bold" style={{ color: tint }}>
                    <Icon className="size-5" /> {title}
                  </span>
                  <span className="font-cond text-sm italic text-brown-soft">{hint}</span>
                  <textarea
                    rows={3}
                    maxLength={1500}
                    value={text[key]}
                    onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
                    className="mt-2 w-full resize-none rounded-2xl bg-cream-deep/60 p-3 font-display text-base outline-none focus:ring-2"
                    style={{ ['--tw-ring-color' as string]: tint }}
                  />
                </label>
              ))}
            </div>

            <Field label="Kenalan yuk (opsional)">
              <div className="flex flex-col gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Nama" autoComplete="name" className="rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta" />
                <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={160} placeholder="IG / WhatsApp / email" className="rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta" />
                <label className="flex items-start gap-3 rounded-2xl p-1 font-display text-sm text-brown-soft">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#a8572a]" />
                  Boleh dihubungi tim Pletok soal promo & event berikutnya. Kontak cuma disimpan kalau ini dicentang, dan nggak dibagikan ke siapa pun.
                </label>
              </div>
            </Field>

            {/* bots fill every field; people never see this one */}
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] size-px opacity-0" aria-hidden />

            {/* stays in reach while scrolling; the cream fade keeps it off the text boxes */}
            <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-cream from-60% to-transparent px-5 pb-4 pt-6">
              <motion.button
                type="submit"
                disabled={!filled}
                whileTap={{ scale: 0.95 }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-4 font-display text-lg font-semibold text-cream shadow-[0_6px_0_#6e3418] disabled:bg-[#cfa98f] disabled:shadow-none"
              >
                <Send className="size-5" /> {filled ? 'Kirim feedback' : 'Pilih atau isi satu dulu, ya'}
              </motion.button>
            </div>
            {!BACKEND && <p className="-mt-6 text-center font-cond text-sm italic text-brown/50">mode uji — belum tersambung ke Google Sheet, jawaban disimpan di perangkat ini</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  )
}

/** back to where they came from (the links page, usually) — or to /link on a fresh open */
function BackButton({ className = '' }: { className?: string }) {
  const back = () => {
    const fromUs = document.referrer && new URL(document.referrer).origin === window.location.origin
    if (fromUs && window.history.length > 1) window.history.back()
    else window.location.href = '/link'
  }
  return (
    <button type="button" onClick={back} className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-cream-deep/80 px-3.5 py-2 font-display text-sm font-semibold text-brown ${className}`}>
      <ArrowLeft className="size-4" /> Kembali
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-terracotta">{label}</p>
      {children}
    </section>
  )
}
