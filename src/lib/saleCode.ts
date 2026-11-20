import { BUNDLES, DRINKS } from '../data/menu'
import type { BoothLine, BoothPay, BoothReceipt, QueueOrder } from './backend'

/*
 * A booth sale packed into its receipt QR — so the sale travels phone to phone with no network.
 *
 *   https://pletok…/r/<sale id>#s=1|<at>|<pay>|<name>|<lines>|<sig>
 *
 * - the buyer's struk opens even when the Sheet is down (it shows the packed copy until the live one answers)
 * - a crew phone that scans it (in-page scanner, or the phone's own camera app → the link) can put
 *   the sale in its pickup queue and deliver it to the Sheet itself — same id, so it's never counted twice
 * - `sig` is an HMAC made with a key derived from the crew PIN: the buyer can read the payload but
 *   can't change it (more cups, a lower price) without the crew phone noticing
 * Short on purpose: the QR has to scan off a phone screen at arm's length.
 */

const DRINK_CODE: Record<string, string> = { original: 'o', lychee: 'l', yakult: 'y' }
const CODE_DRINK = Object.fromEntries(Object.entries(DRINK_CODE).map(([k, v]) => [v, k]))
const PAY_CODE: Record<BoothPay, string> = { tunai: 't', qris: 'q', bca: 'b' }
const CODE_PAY = Object.fromEntries(Object.entries(PAY_CODE).map(([k, v]) => [v, k])) as Record<string, BoothPay>
export const PAY_LABEL: Record<BoothPay, string> = { tunai: 'Tunai', qris: 'QRIS', bca: 'Transfer BCA' }

const slug = (name: string) => name.replace(/^Paket /, '').toLowerCase().replace(/\s+/g, '-')
const sameMix = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()

export interface PackedSale {
  id: string
  at: number
  pay: BoothPay
  name: string
  lines: BoothLine[]
}

/** the number a sale is called by before the Sheet gives it a B-number (same as /cashier shows) */
export const tempCode = (id: string) => '#' + id.slice(0, 4).toUpperCase()

/** a line's name rebuilt from its id + cups, exactly like /cashier writes it */
function lineName(id: string, drinks: string[]) {
  const d = DRINKS.find((x) => x.id === id)
  if (d) return d.name
  const b = BUNDLES.find((x) => slug(x.name) === id)
  if (!b) return id
  return sameMix(drinks, b.items) ? b.name : `${b.name} (${drinks.map((x) => DRINKS.find((y) => y.id === x)?.short ?? x).join(' + ')})`
}

const body = (s: PackedSale) =>
  [
    '1',
    Math.round(s.at / 1000).toString(36),
    PAY_CODE[s.pay],
    encodeURIComponent(s.name.slice(0, 24)),
    s.lines.map((l) => [l.id, l.qty, l.price, ...(l.drinks.length > 1 ? [l.drinks.map((d) => DRINK_CODE[d] ?? d).join('.')] : [])].join('*')).join(','),
  ].join('|')

/* ---- the seal: HMAC-SHA256 with a key stretched from the PIN (slow to guess, fast to use once) */
let keyFor: { pin: string; key: Promise<CryptoKey> } | null = null
function key(pin: string) {
  if (keyFor?.pin !== pin) {
    const enc = new TextEncoder()
    const key = crypto.subtle
      .importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
      .then((base) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('pletok-sale-v1'), iterations: 60_000, hash: 'SHA-256' }, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']))
    keyFor = { pin, key }
  }
  return keyFor.key
}
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf).slice(0, 9))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function seal(pin: string, id: string, text: string) {
  // crypto.subtle only exists on https / localhost — without it the sale still travels, unsealed
  if (!globalThis.crypto?.subtle) return ''
  try {
    return b64url(await crypto.subtle.sign('HMAC', await key(pin), new TextEncoder().encode(`${id}|${text}`)))
  } catch {
    return ''
  }
}

/** stretch the key once when a crew page opens, so the first receipt QR appears instantly */
export const warmSeal = (pin: string) => void (globalThis.crypto?.subtle && key(pin).catch(() => {}))

/** the receipt link with the sale inside it */
export async function receiptUrl(site: string, pin: string, s: PackedSale) {
  const text = body(s)
  return `${site}/r/${s.id}#s=${text}|${await seal(pin, s.id, text)}`
}

/** reads the `#s=…` part of a receipt link; null when it's missing or garbled */
export function unpack(id: string, hash: string): (PackedSale & { text: string; sig: string }) | null {
  try {
    const raw = hash.replace(/^#/, '')
    if (!raw.startsWith('s=')) return null
    const parts = raw.slice(2).split('|')
    if (parts[0] !== '1' || parts.length !== 6) return null
    const [, at36, pay, name, lines, sig] = parts
    const ls: BoothLine[] = lines.split(',').map((x) => {
      const [lid, qty, price, mix] = x.split('*')
      const drinks = mix ? mix.split('.').map((c) => CODE_DRINK[c] ?? c) : DRINKS.some((d) => d.id === lid) ? [lid] : (BUNDLES.find((b) => slug(b.name) === lid)?.items ?? [])
      return { id: lid, name: lineName(lid, drinks), qty: Math.max(1, Math.min(50, Number(qty) || 1)), price: Math.max(0, Math.min(500, Number(price) || 0)), drinks }
    })
    if (!ls.length || !CODE_PAY[pay]) return null
    return { id, at: parseInt(at36, 36) * 1000, pay: CODE_PAY[pay], name: decodeURIComponent(name), lines: ls, text: parts.slice(0, 5).join('|'), sig }
  } catch {
    return null
  }
}

/** 'ok' = made by a crew phone with this PIN · 'bad' = changed or forged · 'unsealed' = made without crypto (http) */
export async function verify(pin: string, s: { id: string; text: string; sig: string }): Promise<'ok' | 'bad' | 'unsealed'> {
  if (!s.sig) return 'unsealed'
  const want = await seal(pin, s.id, s.text)
  if (!want) return 'unsealed'
  return want === s.sig ? 'ok' : 'bad'
}

const totalOf = (s: PackedSale) => s.lines.reduce((t, l) => t + l.qty * l.price, 0)

/** for the buyer's struk while the Sheet can't be reached */
export const asReceipt = (s: PackedSale): BoothReceipt => ({
  code: tempCode(s.id),
  ref: '',
  name: s.name,
  at: s.at,
  total: totalOf(s),
  pay: PAY_LABEL[s.pay],
  lines: s.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
  status: 'process',
  readyAt: 0,
  doneAt: 0,
})

/** for the pickup queue, until the Sheet has it */
export const asQueueOrder = (s: PackedSale): QueueOrder => ({
  src: 'booth',
  id: s.id,
  code: tempCode(s.id),
  name: s.name,
  at: s.at,
  total: totalOf(s),
  pay: PAY_LABEL[s.pay],
  note: '',
  done: false,
  lines: s.lines,
})
