/**
 * Pletok backend — lives inside the team's Google Sheet (Extensions → Apps Script).
 * Setup steps are in apps-script/README.md.
 *
 *   POST {type:'feedback', ...}  → a row in "Feedback"     (anyone)
 *   POST {type:'scan', target}   → a row in "Scans"        (anyone)
 *   POST {type:'menu', pin, state} → saves the sold-out state (crew PIN only)
 *   GET  ?stats=1                → numbers for the closing screen + current menu state
 *
 * Exports: the data is just a Sheet — File → Download (.xlsx / .csv / .pdf), or
 * menu "Pletok → Buat laporan Google Docs" for a report grouped by the feedback grid.
 */

const FEEDBACK_COLS = ['Waktu', 'ID', 'Rating', 'Menu favorit', 'Like (yang disukai)', 'Wishes (kritik & saran)', 'Questions (pertanyaan)', 'Ideas (ide)', 'Nama', 'Kontak (IG/WA/email)', 'Boleh dihubungi', 'Sumber', 'Perangkat']
const SCAN_COLS = ['Waktu', 'Tujuan', 'Perangkat']
const DRINK_NAMES = { original: 'Original', lychee: 'Lychee Sparkling', yakult: 'Yakult' }

/* ---- pre-order: the Sheet is the source of truth for what's on sale and what it costs */
const ORDER_COLS = ['Waktu', 'Kode', 'ID', 'Nama', 'WhatsApp', 'Pesanan', 'Total (Rp)', 'Catatan', 'Status', 'Detail (JSON)']
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
  return { enabled: !!saved.enabled, cutoff: Math.min(Number(saved.cutoff) || PREORDER_CUTOFF, PREORDER_CUTOFF), items: items }
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
  // many phones at once: one writer at a time so rows never collide
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const b = JSON.parse(e.postData.contents)
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
      if (!b.pin || b.pin !== props.getProperty('CREW_PIN')) return json_({ ok: false, error: 'pin' })
      props.setProperty('MENU', JSON.stringify({ state: b.state, at: Date.now() }))
      CacheService.getScriptCache().remove('stats')
      return json_({ ok: true })
    }

    // admin (/hasil): open / close the feedback form for every phone — 'auto' follows the schedule
    if (b.type === 'feedback-mode') {
      if (!b.pin || b.pin !== props.getProperty('CREW_PIN')) return json_({ ok: false, error: 'pin' })
      if (['auto', 'open', 'closed'].indexOf(b.mode) === -1) return json_({ ok: false, error: 'mode' })
      props.setProperty('FEEDBACK_MODE', b.mode)
      CacheService.getScriptCache().remove('stats')
      return json_({ ok: true })
    }

    // a customer's pre-order — everything re-checked here, the phone only says what and how many
    if (b.type === 'preorder') {
      if (b.hp) return json_({ ok: true, code: 'PLT-000' })
      const cfg = preorderConfig_()
      if (!cfg.enabled || Date.now() > cfg.cutoff) return json_({ ok: false, error: 'closed' })
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

      const sh = sheet_('Preorder', ORDER_COLS)
      const last = sh.getLastRow()
      // a retry of the same order gets its first code back instead of a duplicate
      if (last > 1) {
        const ids = sh.getRange(2, 3, last - 1, 1).getValues().flat()
        const i = ids.indexOf(b.id)
        if (i !== -1) return json_({ ok: true, code: sh.getRange(i + 2, 2).getValue(), total: Number(sh.getRange(i + 2, 7).getValue()) / 1000 })
      }
      const code = 'PLT-' + ('00' + last).slice(-3)
      sh.appendRow([now, code, clip_(b.id, 64), name, "'" + wa, lines.map((l) => l.qty + '× ' + l.name).join(', '), total * 1000, clip_(b.note, 300), 'baru', JSON.stringify(lines)])
      return json_({ ok: true, code: code, total: total })
    }

    // admin (/hasil): what's on sale, prices, open/closed, cut-off
    if (b.type === 'preorder-config') {
      if (!b.pin || b.pin !== props.getProperty('CREW_PIN')) return json_({ ok: false, error: 'pin' })
      const c = b.config || {}
      const items = {}
      Object.keys(PREORDER_ITEMS).forEach((id) => {
        const s = (c.items || {})[id] || {}
        items[id] = { on: s.on !== false, price: Math.max(1, Math.min(500, Math.round(Number(s.price) || PREORDER_ITEMS[id].price))) }
      })
      props.setProperty('PREORDER', JSON.stringify({ enabled: !!c.enabled, cutoff: Math.min(Number(c.cutoff) || PREORDER_CUTOFF, PREORDER_CUTOFF), items: items }))
      CacheService.getScriptCache().remove('stats')
      return json_({ ok: true })
    }

    // admin: mark an order done / not done
    if (b.type === 'preorder-status') {
      if (!b.pin || b.pin !== props.getProperty('CREW_PIN')) return json_({ ok: false, error: 'pin' })
      const sh = sheet_('Preorder', ORDER_COLS)
      if (sh.getLastRow() < 2) return json_({ ok: false, error: 'code' })
      const codes = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat()
      const i = codes.indexOf(b.code)
      if (i === -1) return json_({ ok: false, error: 'code' })
      sh.getRange(i + 2, 9).setValue(b.done ? 'selesai' : 'baru')
      return json_({ ok: true })
    }

    if (b.type === 'pin') return json_({ ok: b.pin === props.getProperty('CREW_PIN') })

    // crew-only: every answer (incl. contacts) for the /hasil page — PIN in the body, never in a URL
    if (b.type === 'results') {
      if (!b.pin || b.pin !== props.getProperty('CREW_PIN')) return json_({ ok: false, error: 'pin' })
      const ss = SpreadsheetApp.getActiveSpreadsheet()
      const fb = sheet_('Feedback', FEEDBACK_COLS)
      const sc = sheet_('Scans', SCAN_COLS)
      const rows = fb.getLastRow() > 1 ? fb.getRange(2, 1, fb.getLastRow() - 1, FEEDBACK_COLS.length).getValues() : []
      const scans = sc.getLastRow() > 1 ? sc.getRange(2, 1, sc.getLastRow() - 1, 2).getValues() : []
      return json_({
        ok: true,
        sheetUrl: ss.getUrl(),
        responses: rows.map((r) => ({
          at: new Date(r[0]).getTime(), rating: Number(r[2]) || null, favorites: String(r[3]),
          like: String(r[4]), wish: String(r[5]), question: String(r[6]), idea: String(r[7]),
          name: String(r[8]), contact: String(r[9]), consent: r[10] === 'ya', source: String(r[11]),
        })),
        scans: scans.map((r) => ({ at: new Date(r[0]).getTime(), target: String(r[1]) })),
        orders: (() => {
          const po = sheet_('Preorder', ORDER_COLS)
          if (po.getLastRow() < 2) return []
          return po.getRange(2, 1, po.getLastRow() - 1, ORDER_COLS.length).getValues().map((r) => ({
            at: new Date(r[0]).getTime(), code: String(r[1]), name: String(r[3]), wa: String(r[4]), summary: String(r[5]),
            total: Number(r[6]) / 1000, note: String(r[7]), done: r[8] === 'selesai', lines: JSON.parse(String(r[9]) || '[]'),
          }))
        })(),
      })
    }
    return json_({ ok: false, error: 'type' })
  } catch (err) {
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
  })
  cache.put('stats', out, 10)
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
