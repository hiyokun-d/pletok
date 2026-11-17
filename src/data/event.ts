export const EVENT = {
  name: 'BINUS Festival',
  open: new Date('2026-11-25T13:00:00+07:00'),
  close: new Date('2026-11-25T16:00:00+07:00'),
  lastCallMinutes: 30,
  dateLabel: 'Rabu, 25 November 2026',
  timeLabel: '13.00 – 16.00 WIB',
  place: 'Balkon Lantai 2',
  campus: 'BINUS Anggrek',
  table: 'Meja 9',
} as const

export const INSTAGRAM_URL = 'https://www.instagram.com/pletok._/'
export const INSTAGRAM_HANDLE = '@pletok._'

/** The deployed site — the QR codes point here so scans can be counted before forwarding */
export const SITE_URL = 'https://pletok.hiyokun.dev'

/**
 * The ONE booth QR: a links page (feedback on top, then our socials). Each visit is a scan —
 * counted in Vercel Analytics (/link) and in the Google Sheet. See src/views/LinksPage.tsx.
 */
export const QR_LINKS = `${SITE_URL}/link`

/** our own feedback form (src/views/FeedbackPage.tsx) → Google Sheet */
export const FEEDBACK_URL = '/feedback'

/** everything on the links page, top to bottom — add more (TikTok, photos…) here later */
export const LINKS = [
  { kind: 'feedback', label: 'Kasih feedback', sub: 'Like · Wishes · Questions · Ideas — 1 menit', href: FEEDBACK_URL },
  { kind: 'instagram', label: 'Instagram', sub: INSTAGRAM_HANDLE, href: INSTAGRAM_URL },
] as const
