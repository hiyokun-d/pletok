import type { DrinkId } from './menu'

/**
 * The BINUS Festival day, frozen: everything the recap page (views/RecapSite) and /gallery show.
 * Written down here on purpose — the page stays whole with the Google Sheet unplugged.
 * Taken from the Sheet on 25 Nov 2026 after closing. Nothing about money, and no customer names,
 * numbers or order codes: the repo is public.
 */
export const RECAP = {
  /** cups handed over — bundles counted per cup */
  cups: 66,
  /** paid orders: walk-in at the booth + pre-orders picked up */
  orders: 54,
  boothOrders: 33,
  preorders: 21,
  feedbacks: 36,
  rating: 4.2,
  rated: 31,
  fiveStars: 13,
  scans: 106,
  /** the last cup of each drink, WIB — everything was gone 13 minutes before closing */
  soldOut: [
    { id: 'original', at: '15.46' },
    { id: 'lychee', at: '15.46' },
    { id: 'yakult', at: '15.47' },
  ] as Array<{ id: DrinkId; at: string }>,
  soldOutAt: '15.47',
  /** cups per drink, bundles split into their cups */
  perDrink: { lychee: 33, original: 18, yakult: 15 } as Record<DrinkId, number>,
  /** what people picked as their favourite in the feedback form */
  favoriteVotes: { lychee: 24, yakult: 10, original: 2 } as Record<DrinkId, number>,
  /** walk-in cups per hour at the booth */
  hours: [
    { h: '12.00', cups: 2 },
    { h: '13.00', cups: 11 },
    { h: '14.00', cups: 13 },
    { h: '15.00', cups: 11 },
  ],
}

export interface CrewMember {
  name: string
  /** what to call them on the card */
  short: string
  role: string
  what: string
  /** easter egg: hovering (or tapping) the name peeks at this site */
  site?: { url: string; label: string }
}
export const CREW: CrewMember[] = [
  { name: 'Calvin Dywen', short: 'Calvin', role: 'Kasir & Admin Pre-order', what: 'Pegang kasir, cek pembayaran, sekaligus admin WA yang balesin semua chat pre-order.' },
  { name: 'Elisha Anastasia Irawan', short: 'Elisha', role: 'Barista', what: 'Yang racik di balik meja. Takaran tiap cup dia yang jaga.' },
  { name: 'Kristama', short: 'Kristama', role: 'Barista', what: 'Partner racik Elisha. Es, rempah, soda, tetap pas walau antrean panjang.' },
  { name: 'Nabiel Rafif Utomo', short: 'Nabiel', role: 'Promotor', what: 'Paling depan. Ngajak ngobrol semua yang lewat, terus ngingetin isi feedback.' },
  {
    name: 'Muh Daffa Dwi Syahreza',
    short: 'hiyo',
    role: 'Developer & Pickup',
    what: 'Bikin website ini, terus pas hari H jaga meja pickup: cek kode, panggil nama, kasih cup.',
    site: { url: 'https://hiyokun.dev', label: 'hiyokun.dev' },
  },
]

/** from the developer, for every customer */
export const DEV_NOTE = { quote: 'Keep that smile, it looks really good on you.', by: 'hiyo', role: 'Developer Pletok' }

export interface Review {
  rating: number | null
  drink: DrinkId | null
  text: string
}
/** what customers wrote in "yang kamu suka" — anonymous, lightly tidied */
export const LOVES: Review[] = [
  { rating: 5, drink: 'lychee', text: 'Lychee nya enak banget and balancee. Ngak ada jujur udh enakk' },
  { rating: 5, drink: 'yakult', text: 'Rasanya pas gak ada yang menutupi tiap rasa lain' },
  { rating: 5, drink: 'yakult', text: 'Menurut saya, kemasan sangat menarik dan rasanya jg mantap' },
  { rating: null, drink: 'lychee', text: 'Websitenya clean,fluid, minumannya segee' },
  { rating: null, drink: 'yakult', text: 'Aku suka rasanya kaya minum jamu tapi sehat' },
  { rating: 5, drink: 'lychee', text: 'Websitenya keren sih dan bagus banget, nothing to improve' },
  { rating: 4, drink: 'lychee', text: 'Booth nya gacor, rasanya segar' },
  { rating: 4, drink: 'lychee', text: 'seger bgt' },
  { rating: 4, drink: 'lychee', text: 'Aftertastenya menarik' },
  { rating: 5, drink: 'lychee', text: 'Desain unik, rasa enak' },
  { rating: 4, drink: 'lychee', text: 'Kemasannya bagus lucu' },
  { rating: null, drink: 'yakult', text: 'Rasanya menyegarkan' },
  { rating: 4, drink: 'yakult', text: 'rasanya unik' },
  { rating: null, drink: null, text: 'herbal terasa' },
  { rating: 4, drink: 'lychee', text: 'Soda dr sparkling' },
  { rating: 3, drink: 'lychee', text: 'Pelayanan baik' },
  { rating: 3, drink: 'lychee', text: 'booth nya menarik' },
  { rating: 4, drink: 'original', text: 'rasanya sehat' },
  { rating: 5, drink: 'lychee', text: 'Rasanya yang menarik dan menekan' },
  { rating: 5, drink: 'yakult', text: 'mantap' },
  { rating: 5, drink: 'lychee', text: 'Lechi' },
  { rating: 4, drink: 'lychee', text: 'Kemasan' },
]

/** what they hope for next time — the to-do list if Pletok opens again */
export const WISHES = [
  'Semoga jadi bisnis beneran',
  'Semoga nggak cuma berakhir jadi project',
  'Lebih banyak varian rasa',
  'Ukuran minuman yang lebih gede',
  'Lebih dingin',
  'Sedotannya terlalu tinggi',
  'Rempahnya bisa dibikin lebih ringan',
  'Murahin dong',
]
/** flavours and ideas people threw at us */
export const IDEAS = ['Matcha', 'Blueberry', 'Cherry fizz', 'Tropical', 'Kombinasi kopi', 'Promo upsize', 'Versi makanan', 'Disajikan hangat', 'Collab sama Tixit', 'Collab sama STAM']

/** "terbuat dari apa?" came up again and again — the answer, right on the page */
export const FAQ = [
  { q: 'Pletok itu apa sih?', a: 'Minuman rempah khas Betawi dari zaman Batavia. Namanya bir, tapi 0% alkohol dan halal. Katanya "pletok" itu bunyi es yang dikocok di bambu.' },
  { q: 'Terbuat dari apa aja?', a: 'Jahe, kayu manis, cengkeh, serai. Yang Lychee Sparkling ditambah leci sama soda, yang Yakult ya ditambah Yakult.' },
  { q: 'Bakal buka lagi?', a: 'Belum ada jadwal. Kalau ada, kabarnya duluan di IG @pletok._' },
]

export interface Moment {
  when: string
  title: string
  text: string
}
/** the road to the day, and the day itself */
export const JOURNEY: Moment[] = [
  { when: 'Ide', title: 'Dari rempah Betawi', text: 'Bir pletok jarang banget diminum anak muda. Jadi kami bikin tiga versi: Original, Lychee Sparkling, Yakult.' },
  { when: '17 Nov', title: 'Website & menu online', text: 'Satu QR di meja buat menu, feedback, sama IG. Semua dari HP.' },
  { when: '18 Nov', title: 'Pre-order pertama masuk', text: 'Promo 10 pemesan pertama langsung habis. Total 21 pre-order diambil di hari H.' },
  { when: '25 Nov · 13.00', title: 'Grand opening', text: 'Countdown di layar, kain batik jatuh, pintu Lawang kebuka. Antrean pertama langsung dateng.' },
  { when: '14.00', title: 'Jam paling ramai', text: '13 cup dalam sejam dari booth aja. Satu kode pickup per pesanan, gak ada yang ketuker.' },
  { when: '15.47', title: 'Ludes semua', text: 'Original sama Lychee habis 15.46, Yakult nyusul semenit kemudian. 13 menit sebelum tutup.' },
  { when: '16.00', title: 'Tutup', text: '36 feedback, rata-rata 4,2. Webnya aman dari buka sampai tutup.' },
]

export interface Media {
  kind: 'photo' | 'video'
  /** /gallery/<file> — photos: <file>.webp (+ -sm.webp), videos: <file>.mp4 with a <file>.webp poster */
  file: string
  w: number
  h: number
  caption: string
}
export const MEDIA: Media[] = [
  { kind: 'photo', file: 'booth-team-1', w: 1200, h: 1600, caption: 'Tim lengkap di Meja 9' },
  { kind: 'video', file: 'clip-first-sip', w: 720, h: 1280, caption: 'Tegukan pertama' },
  { kind: 'photo', file: 'crowd-1', w: 1800, h: 1012, caption: 'Rame-rame di depan booth' },
  { kind: 'video', file: 'clip-booth-screen', w: 464, h: 832, caption: 'Layar booth: hari ini di Meja 9' },
  { kind: 'photo', file: 'selfie-1', w: 1800, h: 1012, caption: 'Selfie dulu sebelum buka' },
  { kind: 'video', file: 'clip-pickup', w: 720, h: 1280, caption: 'Meja pickup' },
  { kind: 'photo', file: 'crowd-2', w: 1800, h: 1012, caption: 'Pelanggan jadi teman' },
  { kind: 'video', file: 'clip-rush', w: 576, h: 1024, caption: 'Jam sibuk' },
  { kind: 'photo', file: 'booth-team-2', w: 1200, h: 1600, caption: 'Pose andalan' },
  { kind: 'video', file: 'clip-promo', w: 576, h: 1024, caption: 'Ngajak mampir' },
  { kind: 'photo', file: 'crowd-3', w: 1800, h: 1012, caption: 'Satu frame, banyak senyum' },
  { kind: 'photo', file: 'selfie-2', w: 1800, h: 1012, caption: 'Masih semangat' },
  { kind: 'video', file: 'clip-team', w: 576, h: 1024, caption: 'Penutupan' },
  { kind: 'photo', file: 'booth-team-3', w: 1200, h: 1600, caption: 'Satu lagi!' },
  { kind: 'photo', file: 'booth-team-4', w: 1200, h: 1600, caption: 'Yang terakhir, beneran' },
]

/** the 9:16 story video made from the day (public/gallery) */
export const STORY_VIDEO = { file: 'pletok-story', w: 1080, h: 1920 }

export const mediaSrc = (m: Pick<Media, 'kind' | 'file'>, small = false) => `/gallery/${m.file}${m.kind === 'video' ? '.webp' : small ? '-sm.webp' : '.webp'}`
export const videoSrc = (file: string) => `/gallery/${file}.mp4`

/** the width of this item's picture when its long side is `long` px (videos: their poster, always portrait) */
const widthAt = (m: Pick<Media, 'w' | 'h'>, long: number) => (m.w >= m.h ? long : Math.round((long * m.w) / m.h))
/**
 * A grid thumbnail that picks its own size: the 400 px one on a small phone, the 720 px one on a
 * big screen or a sharp display — `sizes` says how wide it's shown.
 */
export const thumb = (m: Media, sizes: string) => ({
  src: `/gallery/${m.file}-xs.webp`,
  srcSet: `/gallery/${m.file}-xs.webp ${widthAt(m, 400)}w, ${mediaSrc(m, true)} ${widthAt(m, 720)}w`,
  sizes,
})
/** a photo opened full screen: 720 px on phones, the full one (up to 1800 px) on big screens */
export const full = (m: Media) => ({
  src: mediaSrc(m),
  srcSet: `${mediaSrc(m, true)} ${widthAt(m, 720)}w, ${mediaSrc(m)} ${m.w}w`,
  sizes: '100vw',
})
