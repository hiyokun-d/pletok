/**
 * Pletok backend — lives inside the team's Google Sheet (Extensions → Apps Script).
 * Setup steps are in apps-script/README.md.
 *
 *   POST {type:'feedback', ...}  → a row in "Feedback"     (anyone)
 *   POST {type:'scan', target}   → a row in "Scans"        (anyone)
 *   POST {type:'menu', pin, state} → saves the sold-out state (crew PIN only)
 *   POST {type:'preorder', ...}  → a row in "Preorder", on hold (no pickup code yet) + a kode cek
 *   POST {type:'preorder-lookup', ids} / {type:'preorder-find', ref | wa+name} → the customer's own orders
 *   POST {type:'preorder-status', pin, id, status?, sent?} → verify (hands out PLT-001, PLT-002…), picked up, rejected
 *   POST {type:'preorder-pay', id, pay:'BCA'|'QRIS'} → how the customer is paying (only while on hold)
 *   POST {type:'money-holders', pin, money:{bca,qris,tunai}} → who holds each pot of money (/hasil)
 *   POST {type:'preorder-proof', id, image} → the transfer screenshot into Drive, named after the customer
 *   POST {type:'preorder-proof-get', pin, id} → that screenshot, for /hasil
 *   POST {type:'wipe', pin, what:['orders','booth','feedback','scans','security','proofs']} → clear test data (backs up first)
 *   POST {type:'pin', pin} → is this the crew PIN (one PIN for /hasil, /config, /cashier, /pickup)
 *   POST {type:'booth-order' | 'booth-void', pin, …} → a walk-in sale in "Kasir" (B-001, B-002…)
 *   POST {type:'booth-check', pin, ids} → which of the cashier phone's saved sales the Sheet already has
 *   POST {type:'queue', pin} / {type:'pickup', pin, src, id, done} → the pickup counter's list, handed over
 *   POST {type:'trap', path, ua, tries} → someone tried the fake /admin page ("Keamanan" tab)
 *   POST {type:'incident', page, downFor, fails} → a phone couldn't reach us and just got back ("Keamanan" + email)
 * Something broken (a crash, the lock too busy) is logged in "Keamanan" and emailed to the admins —
 * at most one email per 15 min. Run setupAlerts once (▶ Run) to allow the emails and get a test one.
 * Every wrong PIN is logged in "Keamanan" and answered 3 s late (one at a time).
 *   GET  ?stats=1                → numbers for the closing screen + current menu state
 *
 * Exports: the data is just a Sheet — File → Download (.xlsx / .csv / .pdf), or
 * menu "Pletok → Buat laporan Google Docs" for a report grouped by the feedback grid.
 */

const FEEDBACK_COLS = ['Waktu', 'ID', 'Rating', 'Menu favorit', 'Like (yang disukai)', 'Wishes (kritik & saran)', 'Questions (pertanyaan)', 'Ideas (ide)', 'Nama', 'Kontak (IG/WA/email)', 'Boleh dihubungi', 'Sumber', 'Perangkat']
const SCAN_COLS = ['Waktu', 'Tujuan', 'Perangkat']
const DRINK_NAMES = { original: 'Original', lychee: 'Lychee Sparkling', yakult: 'Yakult' }

/* ---- pre-order: the Sheet is the source of truth for what's on sale and what it costs */
const ORDER_COLS = ['Waktu', 'Kode', 'ID', 'Nama', 'WhatsApp', 'Pesanan', 'Total (Rp)', 'Catatan', 'Status', 'Detail (JSON)', 'Bayar via', 'Nama rekening pengirim', 'Kode terkirim', 'Kode cek', 'Bukti transfer', 'Promo (Rp)']
// an order waits ("hold") until an admin finds the transfer, then gets its pickup code ("process").
// The Status column keeps words a person reading the Sheet understands.
const STATUS = { hold: 'menunggu verifikasi', process: 'diproses', done: 'selesai', rejected: 'ditolak' }
const statusOf_ = (v) => {
  const t = String(v)
  if (t === 'baru') return 'process' // before verification existed, every order got its code straight away
  const k = Object.keys(STATUS).filter((k) => STATUS[k] === t)[0]
  return k || 'hold'
}
// a column added later: write its header into an older sheet
function orderSheet_() {
  const sh = sheet_('Preorder', ORDER_COLS)
  if (sh.getLastColumn() < ORDER_COLS.length) {
    sh.getRange(1, 1, 1, ORDER_COLS.length).setValues([ORDER_COLS]).setFontWeight('bold').setBackground('#5a2e1a').setFontColor('#f5ebdd')
  }
  return sh
}
const orderRows_ = (sh) => (sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, ORDER_COLS.length).getValues())
// the private "kode cek" a customer types on any phone (or opens as /c/KODE) to find their order
const REF_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function newRef_(rows) {
  const used = rows.map((r) => String(r[13]))
  for (;;) {
    let ref = ''
    for (let i = 0; i < 6; i++) ref += REF_ABC.charAt(Math.floor(Math.random() * REF_ABC.length))
    if (used.indexOf(ref) === -1) return ref
  }
}
const digits_ = (wa) => {
  const d = String(wa).replace(/\D/g, '')
  return d.startsWith('62') ? '0' + d.slice(2) : d.startsWith('8') ? '0' + d : d
}
const loose_ = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '')
// what the customer's phone may know about an order: the pickup code only once it's paid
function orderPublic_(r) {
  const st = statusOf_(r[8])
  return { id: String(r[2]), ref: String(r[13] || ''), status: st, code: st === 'process' || st === 'done' ? String(r[1]) : '', total: Number(r[6]) / 1000, name: String(r[3]), at: new Date(r[0]).getTime(), lines: JSON.parse(String(r[9]) || '[]'), proof: !!r[14], promo: Number(r[15]) / 1000 || 0, pay: payOf_(r[10]) }
}
// pre-orders are paid by BCA transfer or the GoPay Merchant QRIS
const payOf_ = (v) => (String(v).toUpperCase() === 'QRIS' ? 'QRIS' : 'BCA')
// who holds each pot of money — names only, crew-only (never in the public stats)
function moneyHolders_() {
  const raw = PropertiesService.getScriptProperties().getProperty('MONEY')
  const m = raw ? JSON.parse(raw) : {}
  return { bca: String(m.bca || ''), qris: String(m.qris || ''), tunai: String(m.tunai || '') }
}
// next pickup code: PLT- + a running number, so the cashier only types the digits ("007").
// It counts every code ever given (older "nama-003" style too), so it never repeats. Being easy to
// guess, it never unlocks an order lookup — that's the kode cek's job.
const nextCode_ = (rows) => 'PLT-' + ('00' + (rows.reduce((m, r) => Math.max(m, Number((String(r[1]).match(/(\d+)$/) || [])[1]) || 0), 0) + 1)).slice(-3)

/* ---- proof of transfer: screenshots go into one Drive folder, renamed after the customer */
function proofFolder_() {
  const props = PropertiesService.getScriptProperties()
  const id = props.getProperty('PROOF_FOLDER')
  if (id) {
    try {
      return DriveApp.getFolderById(id)
    } catch (e) {
      /* deleted — make a new one */
    }
  }
  const f = DriveApp.createFolder('Pletok · Bukti transfer pre-order')
  props.setProperty('PROOF_FOLDER', f.getId())
  return f
}
/** run once from the editor (▶ Run → setupProofFolder): asks for Drive permission and makes the folder */
function setupProofFolder() {
  Logger.log('Folder bukti transfer: ' + proofFolder_().getUrl())
}
const fileId_ = (url) => (String(url).match(/[-\w]{25,}/) || [''])[0]
// prices in thousands (18 = Rp18.000); the admin can change them on /hasil
const PREORDER_ITEMS = {
  original: { name: 'Pletok Original', price: 18 },
  lychee: { name: 'Pletok Lychee Sparkling', price: 20 },
  yakult: { name: 'Pletok Yakult', price: 20 },
  'duo-klasik': { name: 'Paket Duo Klasik', price: 35 },
  'duo-segar': { name: 'Paket Duo Segar', price: 35 },
  'trio-kalcer': { name: 'Paket Trio Kalcer', price: 52 },
}
// H-1: orders close at the end of 24 Nov (WIB) at the latest — the admin can only move it earlier,
// never into the event day (pre-order runs 18–24 Nov, 7 days)
const PREORDER_CUTOFF = new Date('2026-11-24T23:59:00+07:00').getTime()

function preorderConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty('PREORDER')
  const saved = raw ? JSON.parse(raw) : {}
  const items = {}
  Object.keys(PREORDER_ITEMS).forEach((id) => {
    const s = (saved.items || {})[id] || {}
    items[id] = { on: s.on !== false, price: Number(s.price) > 0 ? Number(s.price) : PREORDER_ITEMS[id].price }
  })
  const bca = saved.bca || {}
  return { enabled: !!saved.enabled, cutoff: Math.min(Number(saved.cutoff) || PREORDER_CUTOFF, PREORDER_CUTOFF), items: items, bca: { number: String(bca.number || ''), holder: String(bca.holder || '') }, promo: promoOf_(saved.promo) }
}

/* ---- "first N orders" promo: the Sheet decides at the moment the order is written, so a stale
   screen can never give away more than the slots. One per WhatsApp number; a rejected order frees its slot. */
function promoOf_(p) {
  p = p || {}
  return { on: !!p.on, slots: Math.max(1, Math.min(200, Math.round(Number(p.slots) || 10))), mode: p.mode === 'pct' ? 'pct' : 'rp', value: Math.max(0, Math.min(p.mode === 'pct' ? 50 : 100, Math.round(Number(p.value) || 0))) }
}
const promoTaken_ = (rows) => rows.filter((r) => Number(r[15]) > 0 && statusOf_(r[8]) !== 'rejected')
/** discount in thousands for an order of `total` (thousands) as {off, why: '' | 'off' | 'full' | 'used'} — why tells the customer what happened when there's no discount */
function promoCheck_(promo, rows, total, wa) {
  if (!promo.on || !promo.value) return { off: 0, why: 'off' }
  const taken = promoTaken_(rows)
  if (taken.some((r) => digits_(r[4]) === digits_(wa))) return { off: 0, why: 'used' }
  if (taken.length >= promo.slots) return { off: 0, why: 'full' }
  const off = promo.mode === 'pct' ? Math.round((total * promo.value) / 100) : promo.value
  return { off: Math.max(0, Math.min(off, total - 1)), why: '' }
}
/* someone who ordered, didn't pay yet and orders again (changed their mind, lost the page) keeps their
   promo: it moves off the old unpaid order — that one goes back to the normal pre-order total */
function promoReclaim_(sh, rows, wa) {
  rows.forEach((r, i) => {
    if (Number(r[15]) > 0 && statusOf_(r[8]) === 'hold' && !r[14] && digits_(r[4]) === digits_(wa)) {
      sh.getRange(i + 2, 7).setValue(Number(r[6]) + Number(r[15]))
      sh.getRange(i + 2, 16).setValue(0)
      r[6] = Number(r[6]) + Number(r[15])
      r[15] = 0
    }
  })
}


/* ---- the booth's own sales (/cashier), separate from pre-orders so /hasil and the promo stay as they are */
const BOOTH_COLS = ['Waktu', 'Kode', 'ID', 'Nama', 'Pesanan', 'Total (Rp)', 'Bayar', 'Status', 'Detail (JSON)', 'Catatan', 'Diambil']
const BOOTH_STATUS = { process: 'diproses', done: 'selesai', void: 'batal' }
const boothSheet_ = () => sheet_('Kasir', BOOTH_COLS)
const boothRows_ = (sh) => (sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, BOOTH_COLS.length).getValues())

/* ---- one crew PIN (CREW_PIN) opens every crew page. A wrong one is written to "Keamanan" and answered
   3 s late — while holding the script lock, so guesses go one at a time: trying every 6-digit PIN
   would take weeks, not minutes. */
const SECURITY_COLS = ['Waktu', 'Kejadian', 'Dari', 'Perangkat', 'Detail']
function allowed_(b) {
  if (b.pin && String(b.pin) === PropertiesService.getScriptProperties().getProperty('CREW_PIN')) return true
  securityLog_('PIN salah', clip_(b.type, 30), b.ua, b.pin ? String(b.pin).length + ' digit' : 'kosong')
  Utilities.sleep(3000)
  return false
}
/** at most 60 rows per 10 minutes, so nobody can flood the Sheet through it */
function securityLog_(what, from, ua, detail) {
  const cache = CacheService.getScriptCache()
  const n = Number(cache.get('sec-n') || 0)
  if (n >= 60) return
  cache.put('sec-n', String(n + 1), 600)
  sheet_('Keamanan', SECURITY_COLS).appendRow([new Date(), what, clip_(from, 60), clip_(ua, 200), clip_(detail, 120)])
}

/* ---- when something breaks: a row in "Keamanan" + an email (at most one per 15 min, so an outage
   doesn't flood the inbox). Who gets it: script property ALERT_EMAIL (comma-separated for several
   admins), else the Sheet's owner. */
function alertAdmin_(what, detail) {
  try {
    securityLog_(what, 'sistem', '', clip_(detail, 120))
  } catch (e) {
    /* the Sheet itself may be what's broken */
  }
  const cache = CacheService.getScriptCache()
  if (cache.get('alerted')) return
  cache.put('alerted', '1', 900)
  try {
    const to = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL') || Session.getEffectiveUser().getEmail()
    const when = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMM HH.mm')
    MailApp.sendEmail(to, 'Pletok: ' + what + ' (' + when + ' WIB)', detail + '\n\nPembeli tetap aman: pesanan & feedback tersimpan di HP mereka dan masuk otomatis begitu sistem pulih.\nCek: Apps Script → Executions. Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl())
  } catch (e) {
    /* emails not allowed yet — run setupAlerts once */
  }
}
/** run once from the editor (▶ Run → setupAlerts): allows the alert emails and sends a test */
function setupAlerts() {
  const to = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL') || Session.getEffectiveUser().getEmail()
  MailApp.sendEmail(to, 'Pletok: tes peringatan', 'Kalau email ini masuk, peringatan gangguan Pletok sudah aktif.')
  Logger.log('Tes terkirim ke ' + to)
}

function sheet_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sh = ss.getSheetByName(name)
  if (!sh) {
    sh = ss.insertSheet(name)
    sh.appendRow(cols)
    sh.setFrozenRows(1)
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#5a2e1a').setFontColor('#f5ebdd')
  }
  return sh
}

const json_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
const clip_ = (v, n) => String(v == null ? '' : v).slice(0, n || 2000)

function doPost(e) {
  // many phones at once: one writer at a time so rows never collide. Too busy → a clean "busy" the
  // phone retries (waitLock would throw outside any guard and Google answers with an HTML error page)
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(25000)) {
    alertAdmin_('Server penuh', 'Terlalu banyak permintaan sekaligus — ada yang harus mengantre lebih dari 25 detik.')
    return json_({ ok: false, error: 'busy' })
  }
  let b = {}
  try {
    b = JSON.parse(e.postData.contents)
    const props = PropertiesService.getScriptProperties()
    const now = new Date()

    if (b.type === 'feedback') {
      if (b.hp) return json_({ ok: true }) // honeypot filled → a bot, pretend it worked
      const sh = sheet_('Feedback', FEEDBACK_COLS)
      // the phone retries until it hears back — skip an ID we already saved
      const ids = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat() : []
      if (ids.indexOf(b.id) === -1) {
        sh.appendRow([
          b.at ? new Date(b.at) : now, clip_(b.id, 64), Number(b.rating) || '', [].concat(b.favorites || b.favorite || []).map((id) => DRINK_NAMES[id]).filter(Boolean).join(', '),
          clip_(b.like), clip_(b.wish), clip_(b.question), clip_(b.idea),
          clip_(b.name, 120), clip_(b.contact, 160), b.consent ? 'ya' : 'tidak', clip_(b.source, 40), clip_(b.ua, 200),
        ])
      }
      return json_({ ok: true })
    }

    if (b.type === 'scan') {
      sheet_('Scans', SCAN_COLS).appendRow([now, clip_(b.target, 20), clip_(b.ua, 200)])
      return json_({ ok: true })
    }

    if (b.type === 'menu') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      props.setProperty('MENU', JSON.stringify({ state: b.state, at: Date.now() }))
      CacheService.getScriptCache().remove('stats')
      return json_({ ok: true })
    }

    // admin (/hasil): open / close the feedback form for every phone — 'auto' follows the schedule
    if (b.type === 'feedback-mode') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      if (['auto', 'open', 'closed'].indexOf(b.mode) === -1) return json_({ ok: false, error: 'mode' })
      props.setProperty('FEEDBACK_MODE', b.mode)
      CacheService.getScriptCache().remove('stats')
      return json_({ ok: true })
    }

    // a customer's pre-order — everything re-checked here, the phone only says what and how many
    if (b.type === 'preorder') {
      if (b.hp) return json_({ ok: true, status: 'hold', total: 0 })
      const cfg = preorderConfig_()
      // an order that waited on the phone through an outage still counts if it was sent before the
      // cut-off (up to 6 h late) — the customer did everything right
      const queuedAt = Number(b.queuedAt) || 0
      const inTime = Date.now() <= cfg.cutoff || (queuedAt && queuedAt <= cfg.cutoff && Date.now() - cfg.cutoff < 6 * 3600000)
      if (!cfg.enabled || !inTime) return json_({ ok: false, error: 'closed' })
      const name = clip_(b.name, 80).trim()
      const wa = String(b.wa || '').replace(/[^0-9+]/g, '')
      if (!name || wa.replace(/\D/g, '').length < 9) return json_({ ok: false, error: 'contact' })
      const lines = []
      let total = 0
      ;(b.items || []).forEach((it) => {
        const c = cfg.items[it.id]
        const qty = Math.floor(Number(it.qty))
        if (!c || !c.on || !(qty > 0) || qty > 20) return
        lines.push({ id: it.id, name: PREORDER_ITEMS[it.id].name, qty: qty, price: c.price })
        total += qty * c.price
      })
      if (!lines.length) return json_({ ok: false, error: 'empty' })

      const sh = orderSheet_()
      // a retry of the same order gets the first one back instead of a duplicate
      const rows = orderRows_(sh)
      const prev = rows.filter((r) => r[2] === b.id)[0]
      if (prev) return json_({ ok: true, status: statusOf_(prev[8]), total: Number(prev[6]) / 1000, ref: String(prev[13] || ''), promo: Number(prev[15]) / 1000 || 0 })
      // first-N promo, decided here (under the lock) — the total below is what they transfer
      if (cfg.promo.on) promoReclaim_(sh, rows, wa)
      const pc = promoCheck_(cfg.promo, rows, total, wa)
      const promo = pc.off
      const pay = total - promo
      // no pickup code yet: it waits on hold until an admin finds the transfer
      const ref = newRef_(rows)
      const late = queuedAt && Date.now() - queuedAt > 60000 ? '[masuk tertunda ' + Math.round((Date.now() - queuedAt) / 60000) + ' mnt] ' : ''
      sh.appendRow([now, '', clip_(b.id, 64), name, "'" + wa, lines.map((l) => l.qty + '× ' + l.name).join(', '), pay * 1000, late + clip_(b.note, 300), STATUS.hold, JSON.stringify(lines), 'BCA', clip_(b.sender, 80), '', ref, '', promo * 1000])
      if (promo) CacheService.getScriptCache().remove('stats') // slots left changes for everyone
      return json_({ ok: true, status: 'hold', total: pay, ref: ref, promo: promo, promoWhy: pc.why })
    }

    // the customer's phone asks how its orders are doing — by the private order id only;
    // the pickup code is only handed out once the payment is verified
    if (b.type === 'preorder-lookup') {
      const ids = (b.ids || []).slice(0, 10).map(String)
      const rows = orderRows_(orderSheet_()).filter((r) => ids.indexOf(String(r[2])) !== -1)
      return json_({ ok: true, orders: rows.map(orderPublic_) })
    }

    // "Cek pesanan" from any phone: the kode cek alone, or WhatsApp number + name together
    if (b.type === 'preorder-find') {
      const rows = orderRows_(orderSheet_())
      const typed = String(b.ref || '').trim()
      const ref = typed.toUpperCase().replace(/[^A-Z0-9]/g, '')
      let hits = []
      if (typed) hits = rows.filter((r) => String(r[13]) === ref)
      else {
        const wa = digits_(b.wa || '')
        const name = loose_(b.name || '')
        if (wa.length < 9 || !name) return json_({ ok: false, error: 'input' })
        hits = rows.filter((r) => digits_(r[4]) === wa && loose_(r[3]) === name)
      }
      return json_({ ok: true, orders: hits.slice(-5).map(orderPublic_) })
    }

    // the hold screen: the customer switched between BCA and QRIS — once it's verified it's the crew's call
    if (b.type === 'preorder-pay') {
      const sh = orderSheet_()
      const i = orderRows_(sh).map((r) => String(r[2])).indexOf(String(b.id))
      if (i === -1) return json_({ ok: false, error: 'id' })
      if (statusOf_(sh.getRange(i + 2, 9).getValue()) !== 'hold') return json_({ ok: false, error: 'status' })
      sh.getRange(i + 2, 11).setValue(payOf_(b.pay))
      return json_({ ok: true })
    }

    // admin (/hasil): the names of whoever holds the BCA account, the QRIS (GoPay Merchant) and the cash
    if (b.type === 'money-holders') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const m = b.money || {}
      props.setProperty('MONEY', JSON.stringify({ bca: clip_(m.bca, 60).trim(), qris: clip_(m.qris, 60).trim(), tunai: clip_(m.tunai, 60).trim() }))
      return json_({ ok: true })
    }

    // admin (/hasil): what's on sale, prices, open/closed, cut-off
    if (b.type === 'preorder-config') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const c = b.config || {}
      const items = {}
      Object.keys(PREORDER_ITEMS).forEach((id) => {
        const s = (c.items || {})[id] || {}
        items[id] = { on: s.on !== false, price: Math.max(1, Math.min(500, Math.round(Number(s.price) || PREORDER_ITEMS[id].price))) }
      })
      const bca = c.bca || {}
      props.setProperty('PREORDER', JSON.stringify({ enabled: !!c.enabled, cutoff: Math.min(Number(c.cutoff) || PREORDER_CUTOFF, PREORDER_CUTOFF), items: items, bca: { number: clip_(bca.number, 30).replace(/[^0-9 -]/g, ''), holder: clip_(bca.holder, 60) }, promo: promoOf_(c.promo) }))
      CacheService.getScriptCache().remove('stats')
      return json_({ ok: true })
    }

    // admin (/hasil): verify (hold → process, hands out the pickup code), picked up, rejected,
    // and "code sent on WhatsApp" — the order is found by its id
    if (b.type === 'preorder-status') {
      CacheService.getScriptCache().remove('stats') // a rejected promo order frees its slot
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const sh = orderSheet_()
      const rows = orderRows_(sh)
      const i = rows.map((r) => String(r[2])).indexOf(String(b.id))
      if (i === -1) return json_({ ok: false, error: 'id' })
      let code = String(rows[i][1])
      if (b.status) {
        if (!STATUS[b.status]) return json_({ ok: false, error: 'status' })
        if ((b.status === 'process' || b.status === 'done') && !code) {
          code = nextCode_(rows)
          sh.getRange(i + 2, 2).setValue(code)
        }
        sh.getRange(i + 2, 9).setValue(STATUS[b.status])
      }
      if (typeof b.sent === 'boolean') sh.getRange(i + 2, 13).setValue(b.sent ? 'ya' : '')
      if (b.pay) sh.getRange(i + 2, 11).setValue(payOf_(b.pay))
      return json_({ ok: true, code: code })
    }

    // the customer's transfer screenshot (from the hold screen): saved in Drive as "Nama (KODECEK) waktu.jpg"
    if (b.type === 'preorder-proof') {
      const sh = orderSheet_()
      const rows = orderRows_(sh)
      const i = rows.map((r) => String(r[2])).indexOf(String(b.id))
      if (i === -1) return json_({ ok: false, error: 'id' })
      const m = String(b.image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
      if (!m) return json_({ ok: false, error: 'image' })
      const bytes = Utilities.base64Decode(m[2])
      if (bytes.length > 6 * 1024 * 1024) return json_({ ok: false, error: 'size' })
      const r = rows[i]
      const stamp = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd HH.mm')
      const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg'
      const clean = String(r[3]).replace(/[\\/:*?"<>|]/g, '').trim() || 'Tanpa nama'
      const file = proofFolder_().createFile(Utilities.newBlob(bytes, m[1], clean + ' (' + (r[13] || 'pre-order') + ') ' + stamp + '.' + ext))
      // a new screenshot replaces the old one
      const old = fileId_(r[14])
      if (old) {
        try {
          DriveApp.getFileById(old).setTrashed(true)
        } catch (e) {
          /* already gone */
        }
      }
      sh.getRange(i + 2, 15).setValue(file.getUrl())
      return json_({ ok: true })
    }

    // admin (/hasil): show a screenshot without sharing the Drive file with anyone
    if (b.type === 'preorder-proof-get') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const r = orderRows_(orderSheet_()).filter((x) => String(x[2]) === String(b.id))[0]
      const id = r && fileId_(r[14])
      if (!id) return json_({ ok: false, error: 'none' })
      const blob = DriveApp.getFileById(id).getBlob()
      return json_({ ok: true, image: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()), name: blob.getName(), url: r[14] })
    }

    // /config "Bersihkan data": empties the chosen tabs after copying each to a backup tab,
    // and moves the transfer screenshots to Drive's trash (recoverable for 30 days)
    if (b.type === 'wipe') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const what = Array.isArray(b.what) ? b.what : []
      const ss = SpreadsheetApp.getActiveSpreadsheet()
      const stamp = Utilities.formatDate(now, 'Asia/Jakarta', 'dd MMM HH.mm')
      const tabs = { orders: () => orderSheet_(), booth: () => boothSheet_(), feedback: () => sheet_('Feedback', FEEDBACK_COLS), scans: () => sheet_('Scans', SCAN_COLS), security: () => sheet_('Keamanan', SECURITY_COLS) }
      const done = {}
      Object.keys(tabs).forEach((k) => {
        if (what.indexOf(k) === -1) return
        const sh = tabs[k]()
        const n = Math.max(0, sh.getLastRow() - 1)
        if (n) {
          sh.copyTo(ss).setName('Backup ' + sh.getName() + ' ' + stamp)
          sh.deleteRows(2, n)
        }
        done[k] = n
      })
      if (what.indexOf('proofs') !== -1) {
        let n = 0
        const files = proofFolder_().getFiles()
        while (files.hasNext()) {
          files.next().setTrashed(true)
          n++
        }
        done.proofs = n
      }
      return json_({ ok: true, done })
    }

    // which crew page this PIN opens: admin (everything), cashier (/cashier) or pickup (/pickup)
    if (b.type === 'pin') return json_({ ok: allowed_(b) })

    // a phone that couldn't reach us is back — how long it waited tells us an outage happened
    // (several phones report the same one: one row + one email per 5 min is enough)
    if (b.type === 'incident') {
      const cache = CacheService.getScriptCache()
      if (!cache.get('incident')) {
        cache.put('incident', '1', 300)
        const mins = Math.max(1, Math.round(Number(b.downFor) / 60000) || 1)
        alertAdmin_('Gangguan terdeteksi', 'Sebuah HP tidak bisa menghubungi sistem selama ±' + mins + ' menit (' + (Number(b.fails) || 0) + '× gagal) di ' + clip_(b.page, 40) + ' — sekarang sudah tersambung lagi.')
      }
      return json_({ ok: true })
    }

    // /admin and friends are a decoy — whoever pokes at them ends up in the "Keamanan" tab
    if (b.type === 'trap') {
      securityLog_('Coba buka admin palsu', clip_(b.path, 60), b.ua, Number(b.tries) ? Number(b.tries) + '× coba PIN' : 'buka halaman')
      return json_({ ok: true })
    }

    // /cashier: a walk-in sale at the booth — paid on the spot, straight into the pickup queue
    if (b.type === 'booth-order') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const sh = boothSheet_()
      const rows = boothRows_(sh)
      const prev = rows.filter((r) => String(r[2]) === String(b.id))[0]
      if (prev) return json_({ ok: true, code: String(prev[1]) })
      const lines = []
      ;(b.lines || []).forEach((l) => {
        const qty = Math.floor(Number(l.qty))
        const price = Math.round(Number(l.price))
        if (!(qty > 0) || qty > 50 || !(price > 0) || price > 500) return
        lines.push({ id: clip_(l.id, 40), name: clip_(l.name, 60), qty: qty, price: price, drinks: (Array.isArray(l.drinks) ? l.drinks : []).slice(0, 5).map((d) => clip_(d, 20)) })
      })
      if (!lines.length) return json_({ ok: false, error: 'empty' })
      const total = lines.reduce((t, l) => t + l.qty * l.price, 0)
      const code = 'B-' + ('00' + (rows.reduce((m, r) => Math.max(m, Number(String(r[1]).replace(/\D/g, '')) || 0), 0) + 1)).slice(-3)
      sh.appendRow([now, code, clip_(b.id, 64), clip_(b.name, 60), lines.map((l) => l.qty + '× ' + l.name).join(', '), total * 1000, b.pay === 'qris' ? 'QRIS' : b.pay === 'bca' ? 'Transfer BCA' : 'Tunai', BOOTH_STATUS.process, JSON.stringify(lines), clip_(b.note, 200)])
      return json_({ ok: true, code: code })
    }

    // /cashier: undo a sale typed by mistake (it leaves the pickup queue, the row stays as "batal")
    if (b.type === 'booth-void') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const sh = boothSheet_()
      const i = boothRows_(sh).map((r) => String(r[2])).indexOf(String(b.id))
      if (i === -1) return json_({ ok: false, error: 'id' })
      sh.getRange(i + 2, 8).setValue(BOOTH_STATUS.void)
      return json_({ ok: true })
    }

    // /cashier's own log: which of these sales do we already have (and as what)? — cancelled ones
    // included, so a sale voided here is never sent again as if it were missing
    if (b.type === 'booth-check') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 1000).map(String)
      const found = {}
      boothRows_(boothSheet_()).forEach((r) => {
        if (ids.indexOf(String(r[2])) !== -1) found[String(r[2])] = { code: String(r[1]), status: String(r[7]) }
      })
      return json_({ ok: true, found: found })
    }

    // /pickup + /cashier: everything that's paid — verified pre-orders and booth sales
    if (b.type === 'queue') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const po = orderRows_(orderSheet_())
        .filter((r) => ['process', 'done'].indexOf(statusOf_(r[8])) !== -1)
        .map((r) => ({ src: 'po', id: String(r[2]), code: String(r[1]), name: String(r[3]), at: new Date(r[0]).getTime(), total: Number(r[6]) / 1000, pay: payOf_(r[10]), note: String(r[7]), done: statusOf_(r[8]) === 'done', lines: JSON.parse(String(r[9]) || '[]') }))
      const booth = boothRows_(boothSheet_())
        .filter((r) => String(r[7]) !== BOOTH_STATUS.void)
        .map((r) => ({ src: 'booth', id: String(r[2]), code: String(r[1]), name: String(r[3]), at: new Date(r[0]).getTime(), total: Number(r[5]) / 1000, pay: String(r[6]), note: String(r[9]), done: String(r[7]) === BOOTH_STATUS.done, lines: JSON.parse(String(r[8]) || '[]') }))
      return json_({ ok: true, orders: po.concat(booth) })
    }

    // /pickup: handed over (or undo) — only orders that are already paid
    if (b.type === 'pickup') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      if (b.src === 'booth') {
        const sh = boothSheet_()
        const rows = boothRows_(sh)
        const i = rows.map((r) => String(r[2])).indexOf(String(b.id))
        if (i === -1 || String(rows[i][7]) === BOOTH_STATUS.void) return json_({ ok: false, error: 'id' })
        sh.getRange(i + 2, 8).setValue(b.done ? BOOTH_STATUS.done : BOOTH_STATUS.process)
        sh.getRange(i + 2, 11).setValue(b.done ? now : '')
      } else {
        const sh = orderSheet_()
        const rows = orderRows_(sh)
        const i = rows.map((r) => String(r[2])).indexOf(String(b.id))
        if (i === -1 || ['process', 'done'].indexOf(statusOf_(rows[i][8])) === -1) return json_({ ok: false, error: 'id' })
        sh.getRange(i + 2, 9).setValue(b.done ? STATUS.done : STATUS.process)
      }
      return json_({ ok: true })
    }

    // crew-only: every answer (incl. contacts) for the /hasil page — PIN in the body, never in a URL
    if (b.type === 'results') {
      if (!allowed_(b)) return json_({ ok: false, error: 'pin' })
      const ss = SpreadsheetApp.getActiveSpreadsheet()
      const fb = sheet_('Feedback', FEEDBACK_COLS)
      const sc = sheet_('Scans', SCAN_COLS)
      const rows = fb.getLastRow() > 1 ? fb.getRange(2, 1, fb.getLastRow() - 1, FEEDBACK_COLS.length).getValues() : []
      const scans = sc.getLastRow() > 1 ? sc.getRange(2, 1, sc.getLastRow() - 1, 2).getValues() : []
      const sec = sheet_('Keamanan', SECURITY_COLS)
      const secRows = sec.getLastRow() > 1 ? sec.getRange(Math.max(2, sec.getLastRow() - 49), 1, Math.min(50, sec.getLastRow() - 1), SECURITY_COLS.length).getValues() : []
      return json_({
        ok: true,
        sheetUrl: ss.getUrl(),
        money: moneyHolders_(),
        security: secRows.reverse().map((r) => ({ at: new Date(r[0]).getTime(), what: String(r[1]), from: String(r[2]), ua: String(r[3]), detail: String(r[4]) })),
        responses: rows.map((r) => ({
          at: new Date(r[0]).getTime(), rating: Number(r[2]) || null, favorites: String(r[3]),
          like: String(r[4]), wish: String(r[5]), question: String(r[6]), idea: String(r[7]),
          name: String(r[8]), contact: String(r[9]), consent: r[10] === 'ya', source: String(r[11]),
        })),
        scans: scans.map((r) => ({ at: new Date(r[0]).getTime(), target: String(r[1]) })),
        orders: orderRows_(orderSheet_()).map((r) => ({
          at: new Date(r[0]).getTime(), code: String(r[1]), id: String(r[2]), name: String(r[3]), wa: String(r[4]), summary: String(r[5]),
          total: Number(r[6]) / 1000, note: String(r[7]), status: statusOf_(r[8]), lines: JSON.parse(String(r[9]) || '[]'),
          pay: payOf_(r[10]), sender: String(r[11] || ''), sent: r[12] === 'ya', ref: String(r[13] || ''), proof: String(r[14] || ''), promo: Number(r[15]) / 1000 || 0,
        })),
      })
    }
    return json_({ ok: false, error: 'type' })
  } catch (err) {
    alertAdmin_('Error server', (b.type || '?') + ': ' + String(err))
    return json_({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

function doGet() {
  // a crowd of phones polls this — answer from a 10 s cache instead of re-reading the Sheet each time
  const cache = CacheService.getScriptCache()
  const hit = cache.get('stats')
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON)
  try {
    return stats_(cache)
  } catch (err) {
    // the Sheet is having a moment: the last good answer keeps every phone's menu working
    alertAdmin_('Error server', 'stats: ' + String(err))
    const last = cache.get('stats-last')
    return ContentService.createTextOutput(last || JSON.stringify({ error: String(err) })).setMimeType(ContentService.MimeType.JSON)
  }
}

function stats_(cache) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const fb = ss.getSheetByName('Feedback')
  const sc = ss.getSheetByName('Scans')
  const rows = fb && fb.getLastRow() > 1 ? fb.getRange(2, 1, fb.getLastRow() - 1, FEEDBACK_COLS.length).getValues() : []
  const scans = sc && sc.getLastRow() > 1 ? sc.getRange(2, 2, sc.getLastRow() - 1, 1).getValues().flat() : []

  const ratings = rows.map((r) => Number(r[2])).filter((n) => n > 0)
  const favs = {}
  rows.forEach((r) => {
    // "Original, Yakult" → one vote each
    Object.keys(DRINK_NAMES).forEach((id) => {
      if (String(r[3]).split(', ').indexOf(DRINK_NAMES[id]) !== -1) favs[id] = (favs[id] || 0) + 1
    })
  })
  const top = Math.max(0, ...Object.values(favs))
  // a tie keeps every leader ("Original & Yakult"), not whichever sorted first
  const favorites = top ? Object.keys(favs).filter((id) => favs[id] === top) : []
  const favorite = favorites[0] || null
  const menu = PropertiesService.getScriptProperties().getProperty('MENU')

  const out = JSON.stringify({
    feedbacks: rows.length,
    contacts: rows.filter((r) => r[10] === 'ya').length,
    rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    favorite,
    favorites,
    qrBooth: scans.filter((t) => t === 'link' || t === 'ig').length,
    qrFeedback: scans.filter((t) => t === 'feedback').length,
    menu: menu ? JSON.parse(menu) : null,
    feedbackMode: PropertiesService.getScriptProperties().getProperty('FEEDBACK_MODE') || 'auto',
    preorder: preorderConfig_(),
    // slots of the first-N promo still free (live: every promo order clears this cache)
    promoUsed: promoTaken_(orderRows_(orderSheet_())).length,
  })
  cache.put('stats', out, 10)
  cache.put('stats-last', out, 21600)
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON)
}

/* ---------------------------------------------------------------- inside the Sheet */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pletok').addItem('Buat laporan Google Docs', 'makeReport').addToUi()
}

/** A Google Doc with every answer grouped by the Feedback-Capture Grid */
function makeReport() {
  const sh = sheet_('Feedback', FEEDBACK_COLS)
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, FEEDBACK_COLS.length).getValues() : []
  const doc = DocumentApp.create('Pletok — Laporan Feedback ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMM yyyy HH.mm'))
  const body = doc.getBody()
  body.appendParagraph('Pletok — Laporan Feedback').setHeading(DocumentApp.ParagraphHeading.TITLE)

  const ratings = rows.map((r) => Number(r[2])).filter((n) => n > 0)
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '-'
  body.appendParagraph(rows.length + ' feedback · rating rata-rata ' + avg + ' / 5')

  const grid = [
    ['Like — yang disukai', 4],
    ['Wishes — kritik & saran', 5],
    ['Questions — pertanyaan', 6],
    ['Ideas — ide', 7],
  ]
  grid.forEach(([title, col]) => {
    body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1)
    const items = rows.filter((r) => String(r[col]).trim())
    if (!items.length) body.appendParagraph('(belum ada)').setItalic(true)
    items.forEach((r) => body.appendListItem(String(r[col]).trim() + (r[8] ? ' — ' + r[8] : '')))
  })

  const contacts = rows.filter((r) => r[10] === 'ya' && String(r[9]).trim())
  body.appendParagraph('Boleh dihubungi (' + contacts.length + ')').setHeading(DocumentApp.ParagraphHeading.HEADING1)
  contacts.forEach((r) => body.appendListItem((r[8] || 'Tanpa nama') + ' — ' + r[9]))

  doc.saveAndClose()
  SpreadsheetApp.getUi().alert('Laporan dibuat di Google Drive:\n' + doc.getUrl())
}
