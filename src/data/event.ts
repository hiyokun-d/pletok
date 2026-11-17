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

/** Feedback form is still being built — until VITE_FEEDBACK_URL is set we point to Instagram. */
export const FEEDBACK_URL: string = import.meta.env.VITE_FEEDBACK_URL || INSTAGRAM_URL
export const FEEDBACK_READY = Boolean(import.meta.env.VITE_FEEDBACK_URL)
