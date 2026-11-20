import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { ChevronDown, Heart, Info, MapPin, Sparkles, TriangleAlert } from 'lucide-react'
import { DRINK_PROFILE, type Drink } from '../data/menu'
import { spring } from '../lib/motion'

const TASTE = [
  ['manis', 'Manis'],
  ['rempah', 'Rempah'],
  ['segar', 'Segar'],
  ['lembut', 'Lembut'],
] as const

/**
 * Under each drink card on the phone: "Kenalan lebih dekat" folds out where it comes from, how it
 * tastes start to finish, what it's good for, a rough nutrition estimate and the honest too-much list.
 * Closed by default so the menu stays a quick scroll.
 */
export function DrinkDetails({ drink }: { drink: Drink }) {
  const [open, setOpen] = useState(false)
  const p = DRINK_PROFILE[drink.id]
  return (
    <div className="-mt-3 px-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 font-display text-base font-semibold text-brown"
        style={{ background: `${drink.accent}1a` }}
      >
        <span className="flex items-center gap-2"><Sparkles className="size-4" style={{ color: drink.accent }} /> Kenalan lebih dekat</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy}><ChevronDown className="size-5" /></motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 px-2 pb-2 pt-4 font-display text-[0.95rem] leading-relaxed text-brown/90">
              <p className="font-script text-xl leading-snug text-brown-soft">{p.feel}</p>

              <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
                {TASTE.map(([k, label]) => (
                  <div key={k} className="contents">
                    <span className="font-cond text-sm font-semibold uppercase italic tracking-wider text-brown/60">{label}</span>
                    <span className="flex gap-1" role="img" aria-label={`${label} ${p.taste[k]} dari 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className="h-2 flex-1 rounded-full" style={{ background: n <= p.taste[k] ? drink.accent : 'rgb(90 46 26 / 0.1)' }} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>

              <Part Icon={MapPin} title="Asal-usul" accent={drink.accent}>
                <p>{p.origin}</p>
              </Part>

              <Part Icon={Sparkles} title="Sensasinya" accent={drink.accent}>
                <ol className="flex flex-col gap-1.5">
                  {p.sensation.map((s, i) => (
                    <li key={s} className="flex gap-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full font-cond text-xs font-bold text-cream" style={{ background: drink.accent }}>{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </Part>

              <Part Icon={Heart} title="Kenapa enak diminum" accent={drink.accent}>
                <ul className="flex flex-col gap-1">
                  {p.benefits.map((b) => <li key={b} className="flex gap-2"><span className="font-bold text-leaf">＋</span>{b}</li>)}
                </ul>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.goodFor.map((g) => <span key={g} className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: `${drink.accent}1f` }}>{g}</span>)}
                </div>
              </Part>

              <Part Icon={Info} title="Gizi per cup (perkiraan)" accent={drink.accent}>
                <dl className="grid grid-cols-2 gap-2">
                  {[
                    ['Energi', p.gizi.kkal],
                    ['Gula', p.gizi.gula],
                    ['Kafein', p.gizi.kafein],
                    ['Alkohol', p.gizi.alkohol],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-cream-deep/70 px-3 py-2">
                      <dt className="font-cond text-xs font-semibold uppercase italic tracking-wider text-brown/55">{k}</dt>
                      <dd className="font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-sm">{p.gizi.lain}</p>
                <p className="mt-1 font-cond text-xs italic text-brown/50">Perkiraan dari resep kami (cup 8 oz), bukan hasil uji lab.</p>
              </Part>

              <Part Icon={TriangleAlert} title="Kalau kebanyakan" accent="#c2410c">
                <ul className="flex flex-col gap-1">
                  {p.tooMuch.map((t) => <li key={t} className="flex gap-2"><span className="text-terracotta">•</span>{t}</li>)}
                </ul>
                <p className="mt-2 text-sm text-brown/70">{p.heads}</p>
              </Part>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Part({ Icon, title, accent, children }: { Icon: typeof Info; title: string; accent: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 flex items-center gap-2 font-cond text-sm font-semibold uppercase italic tracking-widest" style={{ color: accent }}>
        <Icon className="size-4" /> {title}
      </p>
      {children}
    </section>
  )
}
