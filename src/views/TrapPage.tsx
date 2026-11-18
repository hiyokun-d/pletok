import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { ArrowRight, Eye, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { reportTrap } from '../lib/backend'

/*
 * /admin, /login, /wp-admin… — a decoy. It looks like a sign-in page, accepts nothing, and every
 * visit (and how many times they tried) goes to the "Keamanan" tab of the Sheet. What they type is
 * never sent anywhere — only the count. After a few tries it says hi.
 * The real crew pages are elsewhere and checked by the Sheet with the crew PIN.
 */

export const TRAP_PATH = /^\/(admin|administrator|wp-admin|wp-login\.php|login|signin|dashboard|panel|cpanel|phpmyadmin|admin\.php|backend|manage|root|superadmin)(\/.*)?$/i

const TRIES_BEFORE_REVEAL = 3

/** "Chrome · macOS" — enough to show them it was noticed */
function device(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'perangkat tak dikenal'
  return `${browser} · ${os}`
}

export function TrapPage() {
  const path = window.location.pathname
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)
  const [bad, setBad] = useState(false)
  const [at] = useState(() => new Date())
  const caught = tries >= TRIES_BEFORE_REVEAL

  useEffect(() => {
    document.title = 'Admin Login · Pletok'
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex'
    document.head.appendChild(m)
    reportTrap(path, 0)
    return () => m.remove()
  }, [path])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !user || !pass) return
    setBusy(true)
    setBad(false)
    // looks like it's checking…
    await new Promise((r) => window.setTimeout(r, 900 + Math.random() * 700))
    const n = tries + 1
    reportTrap(path, n)
    setTries(n)
    setPass('')
    setBusy(false)
    setBad(true)
  }

  return (
    <main className="paper grid min-h-dvh place-items-center px-4 py-10 text-brown">
      <AnimatePresence mode="wait">
        {!caught ? (
          <motion.form
            key="login"
            onSubmit={submit}
            className="w-full max-w-sm rounded-3xl border border-brown/10 bg-cream p-7 shadow-[0_20px_50px_-30px_rgb(90_46_26/0.6)]"
            initial={{ opacity: 0, y: 16 }}
            animate={bad ? { opacity: 1, y: 0, x: [0, -10, 9, -6, 4, 0] } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            transition={{ duration: 0.45 }}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-brown text-cream"><Lock className="size-5" /></span>
            <h1 className="mt-4 font-display text-2xl font-bold">Pletok Admin</h1>
            <p className="font-cond italic text-brown-soft">Masuk ke dashboard</p>
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username" autoComplete="off" className="mt-5 w-full rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta" />
            <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Password" autoComplete="off" className="mt-2 w-full rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta" />
            {bad && <p className="mt-2 font-cond text-sm italic text-terracotta">Username atau password salah.</p>}
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta py-3 font-display font-semibold text-cream">
              {busy && <Loader2 className="size-4 animate-spin" />} Masuk
            </button>
          </motion.form>
        ) : (
          <motion.div key="caught" className="w-full max-w-md text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.span
              className="mx-auto grid size-20 place-items-center rounded-3xl bg-terracotta text-cream shadow-[0_8px_0_#6e3418]"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: [0, -10, 10, -6, 0] }}
              transition={{ type: 'spring', stiffness: 300, damping: 12 }}
            >
              <Eye className="size-10" />
            </motion.span>
            <motion.h1
              className="mt-5 font-display text-5xl font-bold"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, x: [0, -3, 3, -2, 0] }}
              transition={{ delay: 0.25, duration: 0.5 }}
            >
              Ketahuan 😏
            </motion.h1>
            <motion.p className="mt-2 font-display text-lg text-brown-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              Ini bukan panel admin beneran — halaman ini jebakan, dan kamu barusan masuk ke dalamnya.
            </motion.p>

            <motion.ul
              className="mt-6 rounded-3xl border-2 border-dashed border-terracotta/40 bg-terracotta/5 p-5 text-left font-display"
              initial="hide"
              animate="show"
              variants={{ show: { transition: { delayChildren: 0.8, staggerChildren: 0.25 } } }}
            >
              <motion.li variants={{ hide: { opacity: 0 }, show: { opacity: 1 } }} className="mb-2 font-cond text-sm font-semibold uppercase italic tracking-[0.2em] text-terracotta">
                Tercatat di log keamanan tim Pletok
              </motion.li>
              {[
                ['Waktu', at.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'medium' }) + ' WIB'],
                ['Halaman', path],
                ['Perangkat', device(navigator.userAgent)],
                ['Percobaan login', `${tries}×`],
              ].map(([k, v]) => (
                <motion.li key={k} variants={{ hide: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }} className="flex justify-between gap-4 py-1">
                  <span className="text-brown-soft">{k}</span>
                  <span className="text-right font-semibold">{v}</span>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }}>
              <p className="mt-6 flex items-start gap-2 text-left font-display text-sm text-brown-soft">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-leaf" />
                Dapur tim Pletok dijaga PIN di server — tiap tebakan salah diperlambat dan dicatat. Jadi daripada ngoprek, mending ngepletok aja 🍹
              </p>
              <a href="/preorder" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-terracotta py-4 font-display text-lg font-semibold text-cream shadow-[0_6px_0_#6e3418]">
                Pre-order Pletok aja <ArrowRight className="size-5" />
              </a>
              <a href="/" className="mt-3 inline-block font-display text-sm text-brown-soft underline">Balik ke beranda</a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
