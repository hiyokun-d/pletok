/**
 * Saves a file from the page. Safari needs the link in the document and the blob URL alive until
 * the download has started (revoking it in the same tick cancels it there), so it's freed a minute later.
 */
export function saveFile(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 60_000)
}

/** a CSV that Excel / Google Sheets / Numbers open cleanly (BOM for Excel's UTF-8) */
export function csvBlob(rows: unknown[][]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
}
