import { motion } from 'motion/react'
import { useEffect } from 'react'
import { ArrowUpRight, Headset, MapPin, MessageCircleHeart, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { ADMIN_NAME, ADMIN_WA, EVENT, LINKS } from '../data/event'
import { DRINKS, TAGLINE } from '../data/menu'
import { logScan } from '../lib/backend'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'
import { usePreorder } from '../hooks/usePreorder'
import { PromoBanner } from '../components/OrderTracker'
import { InstagramIcon } from '../components/InstagramIcon'
import { WindLeaves } from '../components/WindLeaves'
import logo from '../assets/logo.png'
import { spring } from '../lib/motion'

let counted = false

/** 6285930460492 → +62 859-3046-0492 */
const prettyWa = (wa: string) => `+${wa.slice(0, 2)} ${wa.slice(2, 5)}-${wa.slice(5, 9)}-${wa.slice(9)}`
// the admin doubles as customer service (same number as on /preorder) — a chat opens with a hello
const CS_HREF = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent('Halo Pletok! Aku mau tanya…')}`
const csName = ADMIN_NAME.charAt(0) + ADMIN_NAME.slice(1).toLowerCase()

const ICONS = { preorder: ShoppingBag, feedback: MessageCircleHeart, instagram: InstagramIcon }

/**
 * Where the booth QR lands (/link): every link we have, feedback first. Opening it counts as
 * one scan — Vercel sees the /link page view, the Google Sheet gets a "Scans" row.
 */
export function LinksPage() {
  const feedback = useFeedbackOpen().open
  const { open: preorder, config: poConfig, promoLeft } = usePreorder()
  const promoLive = preorder && !!poConfig.promo?.on && promoLeft > 0
  const links = [
    // pre-order sits on top while it's open (from the day an admin switches it on until H-1)
    ...(preorder ? [{ kind: 'preorder' as const, label: 'Pre-order Pletok', sub: 'Pesan sekarang, ambil di booth — tanpa antre', href: '/preorder' }] : []),
    ...LINKS.filter((l) => l.kind !== 'feedback' || feedback),
  ]
  useEffect(() => {
    // once per page load (React may run effects twice in dev), and not when someone taps back here
    if (counted) return
    counted = true
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type !== 'back_forward' && nav?.type !== 'reload') logScan('link')
  }, [])

  return (
    <main className="paper relative min-h-dvh overflow-hidden px-5 pb-12 pt-10 text-brown">
      <WindLeaves count={10} opacity={0.5} />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <motion.img src={logo} alt="Pletok" className="w-52" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.pop} />
        <p className="mt-2 font-script text-2xl text-terracotta">{TAGLINE}</p>
        <p className="mt-1 flex items-center gap-1.5 font-cond text-base italic text-brown-soft">
          <MapPin className="size-4" /> {EVENT.table} · {EVENT.place}, {EVENT.campus}
        </p>

        {promoLive && poConfig.promo && (
          <motion.div className="mt-6 w-full" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.snappy, delay: 0.1 }}>
            <PromoBanner promo={poConfig.promo} left={promoLeft} href="/preorder" />
          </motion.div>
        )}

        <div className="mt-7 flex w-full flex-col gap-3">
          {links.map((l, i) => {
            const Icon = ICONS[l.kind]
            const hero = i === 0
            return (
              <motion.a
                key={l.href}
                href={l.href}
                data-track={`link-${l.kind}`}
                className={`group flex items-center gap-4 rounded-3xl p-4 ${hero ? 'bg-terracotta text-cream shadow-[0_6px_0_#6e3418]' : 'border-2 border-brown/15 bg-cream/80'}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.snappy, delay: 0.15 + i * 0.08 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${hero ? 'bg-cream/15' : 'bg-brown/[0.07]'}`}>
                  <Icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold leading-tight">{l.label}</span>
                  <span className={`block truncate font-cond text-sm italic ${hero ? 'text-cream/80' : 'text-brown-soft'}`}>{l.sub}</span>
                </span>
                <ArrowUpRight className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </motion.a>
            )
          })}
          <motion.a
            href="/"
            data-track="link-menu"
            className="flex items-center gap-4 rounded-3xl border-2 border-brown/15 bg-cream/80 p-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.snappy, delay: 0.15 + links.length * 0.08 }}
          >
            <span className="flex shrink-0 -space-x-3">
              {DRINKS.map((d) => (
                <img key={d.id} src={d.image} alt="" className="h-12 w-auto object-contain" />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-display text-lg font-bold leading-tight">
                <UtensilsCrossed className="size-4" /> Menu & cerita Pletok
              </span>
              <span className="block font-cond text-sm italic text-brown-soft">harga, paket hemat, asal-usul</span>
            </span>
          </motion.a>
          {ADMIN_WA && (
            <motion.a
              href={CS_HREF}
              target="_blank"
              rel="noreferrer"
              data-track="link-cs"
              className="group flex items-center gap-4 rounded-3xl border-2 border-leaf/40 bg-cream/80 p-4"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.snappy, delay: 0.15 + (links.length + 1) * 0.08 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-leaf text-cream">
                <Headset className="size-6" />
                {/* "someone's here" dot */}
                <span className="absolute -right-0.5 -top-0.5 flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#8faa4f] opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full border-2 border-cream bg-[#8faa4f]" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-bold leading-tight">Customer Service</span>
                <span className="block truncate font-cond text-sm italic text-brown-soft">
                  WhatsApp {prettyWa(ADMIN_WA)}{ADMIN_NAME && ` · ${csName}`}
                </span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </motion.a>
          )}
        </div>

        <p className="mt-8 font-cond text-sm italic text-brown/45">
          {EVENT.name} · {EVENT.dateLabel}
        </p>
      </div>
    </main>
  )
}
