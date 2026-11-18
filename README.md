# Pletok — Betawi, Full of Flavor

Animated menu site for **Pletok**, a modern take on *bir pletok* (Betawi's alcohol-free spiced drink), built for our booth at **BINUS Festival**.

| | |
|---|---|
| **When** | Rabu, 25 November 2026 · 13.00 – 16.00 WIB |
| **Where** | Balkon Lantai 2, BINUS Anggrek · **Meja 9** |
| **Instagram** | [@pletok._](https://www.instagram.com/pletok._/) |

Frontend only — no backend, no database. One laptop at the booth runs the desktop screen; visitors open the same site on their phones.

---

## Quick start

```bash
bun install
bun run dev       # http://localhost:5173
bun run build     # type-check + production build → dist/
bun run preview   # serve the built dist/
```

**Backend (feedback, scans, sold-out sync):** a Google Sheet + Apps Script — setup in [`apps-script/README.md`](apps-script/README.md). Put its web-app URL in `.env.local` (ignored by git) and in Vercel's environment variables:

```bash
VITE_BACKEND_URL=https://script.google.com/macros/s/…/exec
```

Without it the site still works; feedback waits in each phone's outbox.

---

## Assets we own

### Images — `src/assets/`
| File | What it is | Used for |
|---|---|---|
| `cup-original.png` | Pletok Original cup on a wooden coaster with ginger, cinnamon, lemongrass (background removed) | Menu, bundles, grand opening, closing |
| `cup-lychee.png` | Pletok Lychee Sparkling cup with lychees | same |
| `cup-yakult.png` | Pletok Yakult cup with a Yakult bottle | same |
| `logo.png` | Original raster Pletok logo (wordmark + sprout + "Betawi, full of flavor.") | Source only — the site draws the vector version below |

### Logo (vector) — `src/data/`
| File | What it is |
|---|---|
| `logoPaths.ts` | The logo traced to SVG paths, one path per part: **P, L, E, T, O, K** and the **tagline** |
| `logo.ts` | Logo layout: box sizes, leaf position, brand brown `#6a371c` |
| `src/components/Sprout.tsx` | The two-leaf sprout redrawn by hand as SVG (left leaf, right leaf, veins, stem), so it can grow and wiggle |

### Other
| File | What it is |
|---|---|
| `public/favicon.svg`, `favicon.ico` | Tab icon — the Pletok sprout in cream on a brown tile |
| `src/components/Ornament.tsx` | Decorations redrawn as SVG from our poster: batik corner, 4-petal spice star, leaf, sunburst dashes |
| `src/components/InstagramIcon.tsx` | Instagram glyph |

### Fonts (bundled, so they work on bad wifi)
| Font | Used for |
|---|---|
| **Fredoka** 400–700 | Headings, prices, numbers |
| **Caveat** 600–700 | Handwritten lines ("Tradisi Abadi, Jiwa Muda", "hemat 3K") |
| **Barlow Condensed** italic 500–600 | Labels and ingredient lines |

### Colors
| Name | Hex |
|---|---|
| Cream (background) | `#F5EBDD` |
| Brown (text) | `#5A2E1A` |
| Terracotta (prices, accents) | `#A8572A` |
| Leaf green | `#5E7B3A` |
| Lychee pink | `#E9827F` |
| Yakult cream | `#F1D3A8` |

### Menu & content — `src/data/`
| File | Contents |
|---|---|
| `menu.ts` | **Drinks:** Original 18K · Lychee Sparkling 20K · Yakult 20K — **Bundles:** Duo Klasik 35K (38K) · Duo Segar 35K (38K) · Trio Kalcer 52K (58K) — ingredients, notes, tagline |
| `event.ts` | Date, opening/closing time, last-call length (30 min), place, table, Instagram, feedback link |
| `story.ts` | History of bir pletok (Batavia origin, why it's halal, where the name comes from) with sources |

To change a price, time or place, edit only these files. Everything else reads from them.

---

## How the site behaves

### Two screens, one site
- **Laptop (booth screen):** wide screen with a mouse → `DesktopKiosk` / `PreOpenStage`
- **Phone:** everything else → `MobileSite`, a scrolling menu + story page

Force one with `?view=desktop` or `?view=mobile`.

### The day, phase by phase (desktop)
| Time | Screen |
|---|---|
| 2+ days before | **Preview dashboard** — full menu + QR, "8 hari lagi" instead of a timer (so we can set up and test) |
| From the day before (or < 23 h) | **Countdown stage** — logo, big flip-clock, the three drinks, wind-blown leaves |
| 5 → 2 min before | The camera slowly **zooms into the logo** |
| Last 10 s | **Grand opening** — countdown, "INTRODUCING", logo, "0% alkohol / 100% halal", a tour of each drink and the bundles, "Resmi dibuka!" |
| Right after | The booth **builds itself up** on screen (blueprint → cards), then the open menu |
| 13.00 – 15.30 | **Open** — menu, bundles, QR card, small timer pill |
| 15.30 – 16.00 | **Last call** — the timer pill turns red and pulses |
| 16.00 | **Closing** — leaves flood the screen, zoom into the leaf, "Terima kasih!" |

On phones a small "dynamic island" pill shows the countdown during pre-open.

### Sold out & prices (/config → Menu hari ini)
From any crew phone on `/config` (PIN), mark a drink SOLD and it gets a stamp + grey-out everywhere; every bundle containing it goes SOLD automatically. To keep a bundle on sale, tap its cups on /config to swap them (e.g. Duo Klasik → 2 Original — the "was" price recalculates) or press *isi asli* to undo. When **every** drink is SOLD during open/last call, the booth switches to the **"Ludes terjual!"** thank-you (we don't restock); The sold-out screen counts down to the official close; to call it a day early, press *Tutup sekarang* on /config and the closing show plays on the booth screen. *Restock semua* brings everything back (and reopens). Changes are saved in the Sheet; the booth screen follows within ~10 s and phones within ~30 s. A control stays yellow until the Sheet has it. *Harga menu* changes a drink or bundle price everywhere (bundle "was" prices and savings recalc; a bundle that's no longer cheaper drops its strike and *hemat*). Anyone looking when a change lands sees the digits roll, and a Dynamic-Island capsule drops in at the top on phones saying what changed (on the booth screen it's compact: the clock pill itself swells into a short notice, or a small pill in the top-right corner when the clock isn't on screen) (*Harga diperbarui*, *Original habis*, *Ludes terjual!*, *Pre-order dibuka*, *Feedback ditutup*, *Offline*…). Going fully sold out shows *Ludes terjual!* in the island for 2 s before the thank-you stage takes over. On phones the bottom bar is the same kind of capsule with up to three buttons (Feedback, Pre-order, Instagram) that grow in and fold away as you switch them. **Signal bars** (menu section on phones, the clock pill on the booth screen, *Menu hari ini* on /config) are measured from the real round trip to the Sheet: ≤1.8 s = 4 bars, ≤3.5 s = 3, ≤7 s = 2, slower or failing = 1, offline = 0.

### Easter egg
Tap the logo's leaf or **"Kenapa namanya Pletok?"** → a 3D glass gets stirred and knocked: *PLE! … TOK!* Visitors can tap the glass to knock it themselves, and read the three stories behind the name.

---

## Booth crew controls

| Keys | What it does |
|---|---|
| **A + B** | Open the **Kontrol Booth** panel (touch: long-press the bottom-left corner) |
| **A + G** | **Tarik perhatian!** — a loud 7-second show (PSST! HAUS? SINI! → cups → "Cobain di Meja 9!") to pull people in |
| **A + T** | **Spam hype** — every press pops a sticker (PLE! TOK! HALAL! MEJA 9!) or a cup with a burst; mash or hold it for more |
| **A + F** | Full screen on/off — while full screen, the laptop **won't sleep** |
| **Esc** | Skip the grand opening |

**Kontrol Booth panel:**
- **Fase** — force Pre-open / Open / Last call / Closed, or **Auto** (follows the schedule)
- **Waktu** — jump the clock: Jam asli, H-3, H-1, −6 menit, −3 menit, −15 detik, Buka +5m, Last call, Tutup, Sudah tutup; nudge ±1 m / ±1 jam; or type an exact WIB time
- **Adegan** — play the grand opening or the intro again; full screen

Everything runs on one shared clock, so changing the time moves every countdown, phase and animation together. Settings survive a refresh.

> **Before the event:** open A + B and set **Auto** + **Jam asli** so the booth follows the real schedule. Turn off macOS Low Power Mode and test the QR with a real phone.

**Serving past 16.00?** Force **Last call** (or nudge the clock back) so the closing animation waits.

### Kasir, pickup & security (one crew PIN for all)

- **/cashier** — booth till: tap the menu, pick **Tunai / QRIS / BCA** (BCA shows the account from /config), see the change, then **Lunas** → a **B-001** number goes straight to pickup. Today's sales with totals per method; a wrong sale can be cancelled (tap twice) until it's picked up.
- **/pickup** — every paid order in one queue: verified pre-orders (PLT-…) and booth sales (B-…), oldest first, refreshed every 5 s, new ones glow. Cups-to-make tally on top, type the digits or a name to find one, **Sudah diambil** (with undo).
- **Security** — a wrong PIN is answered 3 s late, one guess at a time, and logged; **/admin**, /login, /wp-admin… are a decoy login that logs the visit and, after 3 tries, shows "Ketahuan 😏". Everything shows in /hasil → **Keamanan** and the Sheet's "Keamanan" tab.

### Debug URLs
| URL | Shows |
|---|---|
| `?nointro` | Skip the intro |
| `?phase=open` | Jump to a phase (`pre-open`, `open`, `last-call`, `closed`) |
| `?now=2026-11-25T12:59:57%2B07:00` | Start the clock at that moment (`%2B` = `+`) — this one plays the grand opening |

---

## SEO & sharing

Live at **https://pletok.hiyokun.dev** (set in `vite.config.ts` as `SITE_URL`; override with a `SITE_URL` env var for another deploy).

| What | Where |
|---|---|
| Title, description, keywords, canonical | `index.html` |
| Link previews (WhatsApp, Instagram, LINE, Facebook, X) — 1200×630 card | `public/og-image.jpg` |
| Event structured data (date, place, menu prices) for Google | JSON-LD in `index.html` |
| App icons + "Add to Home Screen" | `public/favicon.svg`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`, `manifest.webmanifest` |
| `robots.txt` + `sitemap.xml` | written at build time by the `pletok-seo` plugin in `vite.config.ts` |
| Text for crawlers without JavaScript | `<noscript>` block in `index.html` |

Check a preview after deploying: [opengraph.xyz](https://www.opengraph.xyz/), Google's [Rich Results Test](https://search.google.com/test/rich-results).

## Analytics (free)

Vercel **Web Analytics** + **Speed Insights** (`src/main.tsx`, `src/lib/analytics.ts`). Enable both in the Vercel project dashboard → *Analytics* / *Speed Insights*.

On the free plan Vercel shows: visitors, page views, referrers, countries, devices, browsers, OS. It doesn't show custom events, so **clicks are recorded as page views**:

| In the "Pages" list | Meaning |
|---|---|
| `/klik/instagram` | Instagram link tapped |
| `/klik/feedback` | feedback form opened |
| `/klik/easter-egg` | "Kenapa namanya Pletok?" opened |
| `/klik/kartu-original` (…) | a menu card flipped on mobile |
| `/dari/<name>` | arrived through a tagged link, e.g. `pletok.hiyokun.dev/?src=wa-angkatan` |

Use a different `?src=` per group or broadcast to see which one brought the most people.

**One QR → `/link`:** every QR (booth card, closing, sold-out) opens the links page — **Kasih feedback** on top, then Instagram, then the menu. Add more links (TikTok, photos…) in `LINKS` in `src/data/event.ts`. Each visit = one scan (Vercel `/link` page views + a row in the Sheet's *Scans* tab). Old `/go/ig` and `/go/feedback` links still work and forward.

**Feedback form → `/feedback`:** follows the Feedback-Capture Grid — rating, favourite drink, **Like / Wishes / Questions / Ideas**, optional name + contact (kept only with the consent tick). Answers go to an outbox on the phone first and retry until the Sheet confirms, so bad signal never loses one; duplicates are skipped by ID. On the booth laptop (booth-device toggle on) the form resets itself for the next person. Export from the Sheet: .xlsx / .csv / .pdf, or **Pletok → Buat laporan Google Docs**.

**Feedback window:** the form (and every feedback button/link) is hidden before we open, open from 13.00, and hides again **25 min after closing** (16.25). **Only admins** can override it — on **`/config`** (crew PIN) → *Form feedback: Auto / Buka / Tutup*, from any phone, anywhere. The switch is saved in the Sheet (not on a device), so every phone follows within ~30 s and nobody at the booth can flip it. Someone already halfway through the form keeps it until they send. Sending plays a paper-plane animation: it loops while the answer is on its way, flies off when it's delivered, then "Makasih!".

**Results page → `/hasil` (crew PIN):** a Google-Forms-style summary, live from the Sheet every 30 s — headline numbers, rating chart, favourite drinks (% of people, ties all get the *Favorit* badge), answers per 15 min, every Like / Wishes / Questions / Ideas answer, the contact list, **Unduh CSV** and **Buka Google Sheet**, plus the pre-order list. Linked from the A + B panel; a button and tab at the top lead to `/config` for every setting. Locally, `/hasil?demo` shows sample data (dev only).

**Pre-order with payment check:** a customer picks items, leaves name + WhatsApp (and the name on their bank account if it differs), and gets the payment screen — total, BCA account (set on `/config` → *Rekening BCA*; QRIS shows as *segera*) and a random **kode cek**. The order sits on **HOLD** without a pickup code. On `/hasil`, someone checks the BCA mutasi and taps **Verifikasi** → it gets the next pickup code (`PLT-001`, `PLT-002`…; at the booth just type the digits, e.g. `7`, in the /hasil search), moves to **PROCESS**, and the customer's page flips to the code by itself (it checks every 10 s and says so). On the hold screen the customer can **Upload bukti transfer**: the screenshot is shrunk on the phone, saved in a private Drive folder *Pletok · Bukti transfer pre-order* renamed to `Nama (KODECEK) tanggal jam.jpg`, and a **Bukti** button on /hasil shows it. **Kirim kode** opens WhatsApp with the code typed out; **Tandai terkirim** records that it went out; **Diambil** at the booth; **Tolak** if the transfer never shows. While pre-order is open the holds sit on top (to check); after it closes, process goes on top (to make). Customers find their order on any phone from the *Sudah pesan? Cek pesanan* button on /preorder: the kode cek, or WhatsApp number + name together (the PLT number never opens an order — it's easy to guess). WhatsApp messages from /hasil carry the code, where and when to pick up (plain `>` lines; emoji break in wa.me links) and — in every message — a short status link `pletok.hiyokun.dev/c/KODECEK` that opens the order's live page (with the pickup code, big) straight away. **Promo pemesan pertama** (`/config` → Pre-order): switch it on, set how many people (10) and the discount per order (a flat amount in thousands or a %, max 50%); the row shows slots used and the most it can cost. /preorder shows a green banner with the slots left and the button shows the price after the promo. The Sheet decides who gets it at the moment the order is written (one per WhatsApp number; a rejected order frees its slot), so a screen that's ~30 s behind can never give away an extra slot — the payment screen shows the confirmed total, and anyone who just missed it is told before they pay. Promo orders are marked on /hasil and in the CSV (*Promo (Rp)* column in the Sheet). The promo also shows, live, at the very top of the phone landing page (a breathing green card with a shine and a *Terbatas* tag, tap → /preorder; once it scrolls away a second live activity — 🎁 + slots left — splits off the Dynamic Island, iOS-style, and merges back when you scroll up), on `/link` above the buttons, and on the booth screen's *Scan buat pre-order!* card ("sisa 4 slot!"); while slots are left, pages check the Sheet every ~8 s so the number counts down on its own and disappears when the last slot goes. **Attention show from a phone** (`/config` → *Attention show (A+G)*): pick a 15/30/60 s delay and press *Putar*; the booth screen plays the same show as A+G when the countdown ends (the delay gives it time to pick the order up), *Batal* cancels. **Bersihkan data** (bottom of `/config`): tick Pre-order / Feedback / Scan & klik / Bukti transfer, type HAPUS, and the Sheet copies each tab to a *Backup …* tab before emptying it (screenshots go to Drive's trash). Menu, prices and pre-order settings stay. Customers' phones drop orders the Sheet no longer has on their next check. **No refund & no cancel** is shown under the order form and again on the payment screen. The WhatsApp field has a fixed +62; 08…, 62… and +62… are all reformatted to the same number.

**Closing screen ("Hari ini di Meja 9"):** QR scans, feedback count, people OK to be contacted, average rating and favourite menu (ties show every leader, e.g. "Original & Yakult") — live from the Sheet (they show *segera* until it's connected), plus the real sell-out order from /hasil. Website visitor totals are only in the Vercel dashboard.

**Booth laptop:** turn on *"Laptop booth — jangan dihitung"* in the A + B panel so it doesn't count itself.

## Tech

- **React 19 + TypeScript + Vite**
- **Tailwind CSS 4** — styling and color tokens (`src/index.css`)
- **motion** — all UI animation
- **ogl** — WebGL particles (`ParticleField`) and the 3D glass (`StirScene`)
- **uqr** — QR code data; we draw the code ourselves with the logo in the middle
- **lucide-react** — icons

### Folder map
```
src/
  App.tsx              picks the screen for the current phase, plays intro / grand opening / closing
  views/               whole screens
    DesktopKiosk.tsx     booth screen (preview, open, last call) + blueprint build-up
    PreOpenStage.tsx     countdown stage, logo zoom
    GrandOpening.tsx     the opening ceremony
    ClosingSequence.tsx  closing animation + thank you
    MobileSite.tsx       phone site
  components/          reusable pieces
    LogoRig, Sprout, LogoPiece   the animated logo
    ParticleField                the one particle system (leaf, spice, fizz, sparkle, burst)
    WindLeaves                   physics leaves (wind, gusts, whirlwinds, cursor)
    QrCanvas                     the QR code + QR-pattern background
    StirScene, PletokEgg         3D glass easter egg
    PhaseControl                 the A + B crew panel
    PhaseIsland                  phone countdown pill
    Countdown, EventStatus, DrinkSpotlight, CupCard, BundleCard, PriceTag, …
  hooks/
    useEventPhase   the shared clock + phase (and crew overrides)
    useFullscreen   full screen + keep-awake
    useIsDesktop, useViewport
  data/              menu, event, story, logo shapes
  lib/               shared animation presets, small event bus
```

### Notes
- Respects the device's **reduce motion** setting (fewer particles, calmer motion).
- Particles pause when off screen; the frame rate is kept smooth on a MacBook Air M1.
- The real QR code never animates while shown, so it always scans.
