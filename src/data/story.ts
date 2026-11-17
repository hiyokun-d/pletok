export interface StoryFact {
  kicker: string
  title: string
  body: string
  en: string
}

export const STORY: StoryFact[] = [
  {
    kicker: 'Batavia, masa kolonial',
    title: 'Bir yang nggak bikin mabuk',
    body: 'Orang Belanda di Batavia suka minum bir dan anggur. Masyarakat Betawi yang religius bikin tandingannya sendiri: minuman rempah yang hangat, halal, dan 100% tanpa alkohol.',
    en: 'A halal, alcohol-free answer to colonial-era beer.',
  },
  {
    kicker: 'Asal kata "bir"',
    title: "Dari bi'run — mata air",
    body: "Salah satu versi menyebut kata \"bir\" berasal dari bahasa Arab bi'run, artinya sumber mata air. Versi lain bilang namanya meniru bir Eropa — tapi isinya rempah semua.",
    en: '"Bir" may come from the Arabic bi\'run, a spring of water.',
  },
  {
    kicker: 'Asal kata "pletok"',
    title: 'Pletak-pletok!',
    body: 'Konon namanya dari bunyi "pletok" saat penjual mengocok & mengaduk minuman berisi es di dalam tabung bambu. Ada juga yang bilang dari bunyi kapulaga yang pecah waktu direbus.',
    en: 'Named after the "pletok" sound of shaking it with ice in a bamboo tube.',
  },
  {
    kicker: 'Rahasia warna merah',
    title: 'Kayu secang',
    body: 'Warna merah khasnya datang dari serutan kayu secang — bukan pewarna. Rempah lainnya: jahe, serai, kayu manis, cengkeh, dan daun pandan.',
    en: 'Its red hue comes naturally from sappanwood.',
  },
  {
    kicker: 'Jamu-nya Betawi',
    title: 'Menghangatkan badan',
    body: 'Seperti jamu, bir pletok diminum untuk menghangatkan tubuh dan menjaga stamina. Sekarang diakui sebagai warisan budaya takbenda — dan kami bikin versi yang lebih kekinian.',
    en: 'A warming herbal tonic, now recognized as intangible cultural heritage.',
  },
]

export const SOURCES = [
  { label: 'Wikipedia — Bir pletok', url: 'https://en.wikipedia.org/wiki/Bir_pletok' },
  { label: 'RRI Voice of Indonesia', url: 'https://rri.co.id/voice-of-indonesia/culinary/2759727/bir-pletok-highlights-jakartas-betawi-herbal-drink-tradition' },
  { label: 'Good News From Indonesia', url: 'https://www.goodnewsfromindonesia.id/2022/11/14/bir-pletok-bir-tradisional-halal-asal-indonesia' },
  { label: 'Alodokter', url: 'https://www.alodokter.com/bir-pletok-warisan-kuliner-betawi-yang-hangat-dan-menyegarkan' },
]
