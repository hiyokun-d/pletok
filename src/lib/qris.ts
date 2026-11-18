/*
 * QRIS without a payment gateway: the GoPay Merchant sticker's static code, turned into a
 * one-off code with the amount already filled in. The buyer scans it in any bank / e-wallet app
 * and only has to confirm — no typing the total. The money goes to the same GoPay Merchant
 * account as the sticker; the crew checks the "pembayaran masuk" notification there.
 */

/** the static QRIS from the GoPay Merchant sticker (NusaWare_Pletok · NMID ID1026642206290) */
export const QRIS_STATIC =
  '00020101021126610014COM.GO-JEK.WWW01189360091437455276630210G7455276630303UMI51440014ID.CO.QRIS.WWW0215ID10266422062900303UMI5204581253033605802ID5915NusaWare_Pletok6013JAKARTA BARAT61051153062140703A0111036216304D8D5'
export const QRIS_MERCHANT = 'NusaWare_Pletok'
export const QRIS_NMID = 'ID1026642206290'

/** CRC-16/CCITT-FALSE, as QRIS (EMVCo) wants it: 4 upper-case hex digits */
export function crc16(s: string) {
  let crc = 0xffff
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** top-level tag → value, in order (QRIS is "TT LL value" repeated) */
function parse(s: string) {
  const out: Array<[string, string]> = []
  for (let i = 0; i < s.length; ) {
    const len = Number(s.slice(i + 2, i + 4))
    out.push([s.slice(i, i + 2), s.slice(i + 4, i + 4 + len)])
    i += 4 + len
  }
  return out
}
const tlv = (tag: string, v: string) => tag + String(v.length).padStart(2, '0') + v

/** the sticker's code with `rupiah` baked in (full rupiah, not thousands) */
export function qrisWithAmount(rupiah: number, base = QRIS_STATIC) {
  const fields = parse(base).filter(([t]) => t !== '54' && t !== '63')
  const body = fields
    // 11 = static (pay any amount) → 12 = dynamic (this amount)
    .map(([t, v]) => (t === '01' ? tlv(t, '12') : tlv(t, v)))
    // the amount sits right after the currency (53), before the country (58)
    .flatMap((f) => (f.startsWith('53') ? [f, tlv('54', String(Math.round(rupiah)))] : [f]))
    .join('')
  return body + '6304' + crc16(body + '6304')
}
