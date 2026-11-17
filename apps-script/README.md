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
6. On the booth laptop, open **A + C**, enter the PIN, then press **Sambung**. Sold-out changes now reach every phone.
7. Admins: open **`/hasil`** with the PIN to see results and to open or close the feedback form remotely. The switch is saved as the script property `FEEDBACK_MODE`.

Changed `Code.gs` later? Go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.

## What lands in the Sheet

| Tab | One row = | Columns |
|---|---|---|
| **Feedback** | one person | time, ID, rating 1–5, favourite drinks (can be several, e.g. "Original, Yakult"), **Like, Wishes, Questions, Ideas**, name, contact, OK to contact, source, device |
| **Scans** | one QR scan | time, target (`link` = booth QR), device |

## Exporting

- **Excel / CSV / PDF:** File → Download → .xlsx / .csv / .pdf
- **Google Docs report:** menu **Pletok → Buat laporan Google Docs**. This creates a doc grouped by the Feedback-Capture Grid (Like, Wishes, Questions, Ideas), plus the list of people who agreed to be contacted. It's saved in Drive, and its link pops up.
- **Charts / pivot:** it's an ordinary Sheet, so use Insert → Chart, or Data → Pivot table.
- **Share with the team:** Share the Sheet as *Viewer* for people who only read it.

## About personal data

Name and contact are **optional**, and contact is only stored if the person ticks "Boleh dihubungi". This follows Indonesia's personal data protection law (UU PDP No. 27/2022): ask for consent, collect only what's needed, and use it only for that purpose. Keep the Sheet private to the team, and don't share the contact column.
