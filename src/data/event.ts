/**
 * The event, as the crew set it on /config ("Acara"). The defaults below are the BINUS Festival day;
 * when Pletok opens again, change it on /config — every screen follows, no recoding. Saved in the
 * synced menu state (hooks/useMenu), and on this device, so it holds even with the Sheet unplugged.
 */
export interface EventSettings {
  name: string
  /** YYYY-MM-DD, WIB */
  date: string
  /** HH:MM, WIB */
  open: string
  close: string
  place: string
  campus: string
  table: string
  /** after closing: the recap page (numbers, crew, reviews, gallery) instead of the plain thank-you */
  recap: boolean
}
export const EVENT_DEFAULTS: EventSettings = {
  name: "BINUS Festival",
  date: "2026-11-25",
  open: "13:00",
  close: "16:00",
  place: "Balkon Lantai 2",
  campus: "BINUS Anggrek",
  table: "Meja 9",
  recap: true,
};

export interface EventInfo extends Omit<EventSettings, "open" | "close"> {
  open: Date
  close: Date
  lastCallMinutes: number
  /** "Rabu, 25 November 2026" */
  dateLabel: string
  /** "13.00 – 16.00 WIB" */
  timeLabel: string
}

const at = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`)
function build(s: EventSettings): EventInfo {
  const open = at(s.date, s.open)
  const close = at(s.date, s.close)
  // a typo on /config never takes the site down: fall back to the defaults' times
  const ok = !Number.isNaN(open.getTime()) && !Number.isNaN(close.getTime()) && close > open
  const o = ok ? open : at(EVENT_DEFAULTS.date, EVENT_DEFAULTS.open)
  const c = ok ? close : at(EVENT_DEFAULTS.date, EVENT_DEFAULTS.close)
  const dateLabel = o.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const hm = (d: Date) => d.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace(":", ".")
  return { ...s, open: o, close: c, lastCallMinutes: 30, dateLabel, timeLabel: `${hm(o)} – ${hm(c)} WIB` }
}

let settings: EventSettings = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("pletok:menu") ?? "null")?.event as Partial<EventSettings> | undefined
    return { ...EVENT_DEFAULTS, ...saved }
  } catch {
    return EVENT_DEFAULTS
  }
})()

/** read anywhere, always current: /config changes it in place */
export const EVENT: EventInfo = build(settings)

export const eventSettings = () => settings
/** a newer copy from /config (or the Sheet) → every reader of EVENT sees it on its next render */
export function applyEvent(next: Partial<EventSettings> | undefined) {
  const merged = { ...EVENT_DEFAULTS, ...next }
  if (JSON.stringify(merged) === JSON.stringify(settings)) return false
  settings = merged
  Object.assign(EVENT, build(settings))
  return true
}

export const INSTAGRAM_URL = "https://www.instagram.com/pletok._/";
export const INSTAGRAM_HANDLE = "@pletok._";
/** admin WhatsApp for pre-order questions, e.g. '6281234567890' — empty shows the placeholder note */
export const ADMIN_WA = "6285930460492";
export const ADMIN_NAME = "CALVIN";
/** +62 859-3046-0492 — how the admin's number is shown */
export const ADMIN_WA_PRETTY = ADMIN_WA ? `+${ADMIN_WA.slice(0, 2)} ${ADMIN_WA.slice(2, 5)}-${ADMIN_WA.slice(5, 9)}-${ADMIN_WA.slice(9)}` : "";
/** "Calvin" */
export const ADMIN_FIRST = ADMIN_NAME ? ADMIN_NAME.charAt(0) + ADMIN_NAME.slice(1).toLowerCase() : "admin";
/** a WhatsApp chat with the admin, message already typed */
export const adminChat = (text: string) => `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(text)}`;

/** The deployed site — the QR codes point here so scans can be counted before forwarding */
export const SITE_URL = "https://pletok.hiyokun.dev";

/**
 * The ONE booth QR: a links page (feedback on top, then our socials). Each visit is a scan —
 * counted in Vercel Analytics (/link) and in the Google Sheet. See src/views/LinksPage.tsx.
 */
export const QR_LINKS = `${SITE_URL}/link`;

/** our own feedback form (src/views/FeedbackPage.tsx) → Google Sheet */
export const FEEDBACK_URL = "/feedback";

/** everything on the links page, top to bottom — add more (TikTok, photos…) here later */
export const LINKS = [
  {
    kind: "feedback",
    label: "Kasih feedback",
    sub: "Like · Wishes · Questions · Ideas — 1 menit",
    href: FEEDBACK_URL,
  },
  {
    kind: "instagram",
    label: "Instagram",
    sub: INSTAGRAM_HANDLE,
    href: INSTAGRAM_URL,
  },
] as const;
