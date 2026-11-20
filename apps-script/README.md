# Pletok backend: a Google Sheet (about 10 minutes, free)

Every feedback, every QR scan and the sold-out state are saved in **one Google Sheet that the team owns**. Nothing else is needed: no server and no paid plan.

## Setup (once)

1. Use the team's Google account (not a personal one) to create a new Google Sheet named **Pletok — Data Booth**.
2. In the Sheet, open **Extensions → Apps Script**. Delete what's there, paste in all of [`Code.gs`](Code.gs), then **Save**.
3. Open **Project Settings** (gear icon) → **Script properties** → **Add property**:
   - Property `CREW_PIN`
   - Value: a PIN only the crew knows (e.g. 6 digits)
4. Click **Deploy → New deployment**, then the gear → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy** and allow the permissions it asks for. Google warns "unverified app" because it's our own script: **Advanced → Go to …**.
5. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`) and paste it to Claude, or set it yourself:
   - in Vercel → Project → Settings → Environment Variables: `VITE_BACKEND_URL` = that URL, then **Redeploy**;
   - locally, in `.env.local` (not committed): `VITE_BACKEND_URL=…`
6. Crew: open **`/config`** on your phone and enter the PIN (`/hasil` has a big button to it, and a tab switch at the top of both). The **Menu hari ini** card marks drinks sold out, swaps bundle cups, changes **menu prices** (*Harga menu*), closes early or restocks. The booth screen and every phone follow — the changed prices roll in and the top island says what changed; the Sheet keeps it as the script property `MENU`.
7. Admins, also on **`/config`**:
   - open or close the feedback form remotely (saved as the script property `FEEDBACK_MODE`);
   - switch pre-order on or off, set the cut-off (24 Nov 23:59 WIB at the latest — it can be moved earlier, never into the event day; with pre-order switched on 18 Nov that is a 7-day window), and turn each item on or off. Pre-order prices go in as a number **or** a % off the menu price; *Semua item: diskon X% → Terapkan* does every item at once, *Samakan dengan harga menu* resets them (saved as `PREORDER`). A %-price is saved as a number, so after changing a menu price press *Terapkan* again.
8. Admins, on **`/hasil`** (same PIN): the results and every pre-order. New orders are **Hold** (no pickup code). Check the BCA mutasi (search by name, kode cek or *nama rekening pengirim*), tap **Verifikasi** → the order gets its code (`PLT-001`…; type just the digits in the /hasil search) and becomes **Process**; **Kirim kode** opens WhatsApp with the code written out, **Tandai terkirim** marks it sent, **Diambil** at pickup, **Tolak** if no transfer. Set the account customers pay to on `/config` → *Rekening BCA*. The Sheet's *Preorder* tab gets four new columns on the first new order (Bayar via, Nama rekening pengirim, Kode terkirim, Kode cek); old orders keep working (their status *baru* counts as Process). A fifth column, *Bukti transfer*, holds the Drive link of the customer's screenshot.
9. **Proof-of-transfer upload (one time):** in the Apps Script editor pick `setupProofFolder` in the function dropdown → **▶ Run** → allow the Drive permission it asks for. It creates the private Drive folder *Pletok · Bukti transfer pre-order* (link in the log). Then **Deploy → Manage deployments → ✏️ → New version** so the web app gets Drive access too.

   Every admin control turns **yellow with a spinner** while it waits for the Sheet, and goes back to normal once every phone sees the change.

Changed `Code.gs` later? Go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.

## What lands in the Sheet

| Tab | One row = | Columns |
|---|---|---|
| **Feedback** | one person | time, ID, rating 1–5, favourite drinks (can be several, e.g. "Original, Yakult"), **Like, Wishes, Questions, Ideas**, name, contact, OK to contact, source, device |
| **Scans** | one QR scan | time, target (`link` = booth QR), device |
| **Kasir** | one booth sale (/cashier) | time, code (B-001…), ID, name, order, total (Rp), paid via (Tunai/QRIS/Transfer BCA), status (`diproses`/`selesai`/`batal`), detail JSON, note, picked-up time |
| **Keamanan** | one wrong PIN or decoy visit | time, what, where (endpoint or path), device, detail (PIN length / tries — never the PIN itself) |
| **Preorder** | one order | time, code (PLT-001…), ID, **name**, WhatsApp, order, total (Rp), note, status (`baru`/`selesai`), detail JSON |

## Exporting

- **Excel / CSV / PDF:** File → Download → .xlsx / .csv / .pdf
- **Google Docs report:** menu **Pletok → Buat laporan Google Docs**. This creates a doc grouped by the Feedback-Capture Grid (Like, Wishes, Questions, Ideas), plus the list of people who agreed to be contacted. It's saved in Drive, and its link pops up.
- **Charts / pivot:** it's an ordinary Sheet, so use Insert → Chart, or Data → Pivot table.
- **Share with the team:** Share the Sheet as *Viewer* for people who only read it.

## About personal data

Name and contact are **optional**, and contact is only stored if the person ticks "Boleh dihubungi". This follows Indonesia's personal data protection law (UU PDP No. 27/2022): ask for consent, collect only what's needed, and use it only for that purpose. Keep the Sheet private to the team, and don't share the contact column.

## When something breaks (Plan B)

Nothing a customer sends is lost while the Sheet is down. The site keeps working and catches up by itself:

| What breaks | What customers see | What happens to their data |
|---|---|---|
| Their phone loses signal | "Offline — data terkirim sendiri saat sinyal balik" | Kept on the phone, sent when the signal is back |
| The Sheet / Apps Script stops answering (crash, Google hiccup, too busy) | A yellow bar: "Sistem lagi gangguan — datamu aman", plus a button to chat the admin | **Pre-orders** wait on the phone as "Menunggu sistem" and are re-sent every 15 s. The Sheet ignores repeats by ID, so an order never lands twice. Orders sent before the cut-off still count for 6 h after it, and are marked `[masuk tertunda N mnt]` in Catatan. Customers are told **not to pay yet**, and can send the order to the admin on WhatsApp in one tap. **Feedback** and **cashier sales** go into the phone's outbox the same way. |
| The Sheet comes back | A green "Tersambung lagi" | Everything waiting is sent. The phone reports the outage: a "Gangguan terdeteksi" row appears in **Keamanan** (shown on /hasil) and you get an email |
| A phone that never loaded /preorder before opens it while the Sheet is down | "Sistem pre-order lagi gangguan" with a **Pesan lewat WhatsApp admin** button | The page keeps trying and opens by itself when the Sheet is back. Phones that loaded it before use their saved menu and settings, and can order as normal |
| The website itself is down (Vercel) | Phones that visited before still open the saved site (offline cache) | Post on Instagram / the WhatsApp group: "pesan lewat WA admin" with the admin's number |

**Crew pages** (/hasil, /config, /cashier, /pickup) show a red bar at the bottom while the Sheet isn't answering: since when, how many failures, and how much is waiting on that device.

### Alerts to the admins

- **Email:** errors and outages are emailed (at most one per 15 min). Setup: open Apps Script → choose `setupAlerts` → ▶ **Run** → allow. A test email arrives. To send alerts to several people, add a script property `ALERT_EMAIL` = `a@x.com,b@y.com` (Project Settings → Script properties). Otherwise the alert goes to the Sheet's owner.
- **When Google or Vercel is fully down:** the script can't email about its own outage. A free uptime monitor covers that. On [UptimeRobot](https://uptimerobot.com) (or Better Stack), add two HTTP checks every 5 min, alerting to email / Telegram:
  1. `https://pletok.hiyokun.dev/link`, which should answer 200
  2. the Web app URL + `?stats=1` (from `.env.local`), with keyword `preorder`

### If the red bar won't go away

1. Apps Script → **Executions**: look for red rows. The error text says what broke.
2. "Exceeded maximum execution time" or quota errors: wait a few minutes. Google resets it.
3. You changed Code.gs? Then **Deploy → Manage deployments → ✏️ → New version** (the URL stays the same).
4. Still broken: tell customers on Instagram / WhatsApp to order via the admin's WhatsApp. Everything already queued lands by itself once it's fixed.

## Event day: no internet at the booth (Plan B for BINUS wifi)

BINUS wifi drowns once the hall fills up. The booth runs without it. Before 13.00:

- **Every crew phone opens each crew page once on good signal** (/cashier, /pickup, /hasil, /financial, /config). After that the pages open from the phone's own cache, even with no signal.
- **Crew phones use mobile data or a hotspot**, not BINUS wifi. One crew phone with a good data plan acts as the hotspot for the laptop.
- **Don't change the crew PIN on event day.** Anything waiting in a phone's outbox is sealed with the old PIN and gets refused.
- Bring a power bank for each phone, the laptop charger, and a paper notebook (last-resort log: time, name, items, payment).

| Scenario | What the crew does | Where the data goes |
|---|---|---|
| Cashier phone offline | Sell as normal. Tunai ✓. QRIS ✓ — if the GoPay notification is late, check the buyer's success screen and tick "Notif telat". BCA only if someone can check the mutasi. | The sale is saved in the cashier phone's log and outbox; it reaches the Sheet by itself once there's signal (never twice). |
| Pickup phone can't see a new sale | Scan the buyer's struk QR with **Scan struk** on /pickup. On iPhone: the Camera app → tap the link → **Tambahkan ke pickup**. | The struk QR carries the whole sale, sealed with the PIN — a tampered QR is shown in red. Whichever phone gets signal first delivers the sale to the Sheet. |
| Pickup phone fully offline | Keep working: the queue shown is the last one loaded ("antrean per 14.05"). Taps on "Siap" / "Diambil" are kept on the phone. | Sent when the signal is back. |
| Buyer forgot their B-number | Ask them to open **/struk** on their phone (the struk is saved there). Otherwise type what they remember into the search, combined: name · drink (lychee) · payment (qris) · time (14.10) · total (35rb). | — |
| Buyer's struk won't load | It shows "Struk sementara" from the QR itself, with the temporary code (#0B6C) and the items. | Turns into the live struk once the Sheet answers. |
| Everything is down | Paper notebook. Type it into /cashier afterwards. | — |

### Money (Financial page)

The /financial page keeps costs and the closing cash count as script properties `FINANCE` and `CLOSING` (no new tabs in the Sheet). After pulling this version of Code.gs: **Deploy → Manage deployments → ✏️ → New version**.
