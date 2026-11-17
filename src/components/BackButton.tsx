import { ArrowLeft } from 'lucide-react'

/** back to where they came from (the links page, usually) — or to /link on a fresh open */
export function BackButton({ className = '' }: { className?: string }) {
  const back = () => {
    const fromUs = document.referrer && new URL(document.referrer).origin === window.location.origin
    if (fromUs && window.history.length > 1) window.history.back()
    else window.location.href = '/link'
  }
  return (
    <button type="button" onClick={back} className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-cream-deep/80 px-3.5 py-2 font-display text-sm font-semibold text-brown ${className}`}>
      <ArrowLeft className="size-4" /> Kembali
    </button>
  )
}
