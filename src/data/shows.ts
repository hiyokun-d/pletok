/** the attention shows (components/AttentionShow), in the order /config lists them — A+G on the booth picks one at random */
export const SHOWS = [
  { name: 'Psst! Haus?', hint: 'Kata besar + cangkir jatuh' },
  { name: 'Lawang Betawi', hint: 'Tok tok! Pintu ukir terbuka 3D' },
  { name: 'Pita berjalan', hint: 'Tulisan raksasa lewat miring' },
  { name: 'Kartu rahasia', hint: 'Tiga kartu dibalik satu-satu' },
  { name: 'Lampu sorot', hint: 'Sorot mencari cangkir di gelap' },
] as const
export const SHOW_COUNT = SHOWS.length
