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

**Feedback form:** the QR and the feedback button point to Instagram until the form is ready. When it is, put the link in `.env.local` (ignored by git) and rebuild:

```bash
VITE_FEEDBACK_URL=https://forms.gle/your-form
```

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
| `public/favicon.ico` | Browser tab icon |
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

### Easter egg
Tap the logo's leaf or **"Kenapa namanya Pletok?"** → a 3D glass gets stirred and knocked: *PLE! … TOK!* Visitors can tap the glass to knock it themselves, and read the three stories behind the name.

---

## Booth crew controls

| Keys | What it does |
|---|---|
| **A + B** | Open the **Kontrol Booth** panel (touch: long-press the bottom-left corner) |
| **A + F** | Full screen on/off — while full screen, the laptop **won't sleep** |
| **Esc** | Skip the grand opening |

**Kontrol Booth panel:**
- **Fase** — force Pre-open / Open / Last call / Closed, or **Auto** (follows the schedule)
- **Waktu** — jump the clock: Jam asli, H-3, H-1, −6 menit, −3 menit, −15 detik, Buka +5m, Last call, Tutup, Sudah tutup; nudge ±1 m / ±1 jam; or type an exact WIB time
- **Adegan** — play the grand opening or the intro again; full screen

Everything runs on one shared clock, so changing the time moves every countdown, phase and animation together. Settings survive a refresh.

> **Before the event:** open A + B and set **Auto** + **Jam asli** so the booth follows the real schedule. Turn off macOS Low Power Mode and test the QR with a real phone.

**Serving past 16.00?** Force **Last call** (or nudge the clock back) so the closing animation waits.

### Debug URLs
| URL | Shows |
|---|---|
| `?nointro` | Skip the intro |
| `?phase=open` | Jump to a phase (`pre-open`, `open`, `last-call`, `closed`) |
| `?now=2026-11-25T12:59:57%2B07:00` | Start the clock at that moment (`%2B` = `+`) — this one plays the grand opening |

---

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
