import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { full, mediaSrc, videoSrc, type Media } from '../data/recap'
import { spring } from '../lib/motion'

/**
 * One photo or clip from the day, full screen: ← → / swipe to move, Esc or tap outside to close.
 * Videos only download once opened here (the grids show their poster).
 */
export function MediaLightbox({ items, at, onAt }: { items: Media[]; at: number | null; onAt: (i: number | null) => void }) {
  const m = at === null ? null : items[at]
  const go = (d: number) => at !== null && onAt((at + d + items.length) % items.length)

  useEffect(() => {
    if (at === null) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAt(null)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', key)
    // the page underneath stays put
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', key)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])

  return (
    <AnimatePresence>
      {m && (
        <motion.div
          key="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={m.caption}
          className="fixed inset-0 z-[80] flex flex-col bg-[#1d0f08]/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onAt(null)}
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] text-cream" onClick={(e) => e.stopPropagation()}>
            <p className="min-w-0 truncate font-display text-lg font-semibold">
              {m.caption} <span className="ml-1 font-cond text-sm italic text-cream/50">{at! + 1} / {items.length}</span>
            </p>
            <div className="flex shrink-0 gap-2">
              <a href={m.kind === 'video' ? videoSrc(m.file) : mediaSrc(m)} download className="grid size-11 place-items-center rounded-full bg-cream/10 hover:bg-cream/20" aria-label="Simpan">
                <Download className="size-5" />
              </a>
              <button onClick={() => onAt(null)} className="grid size-11 place-items-center rounded-full bg-cream/10 hover:bg-cream/20" aria-label="Tutup">
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={m.file}
                className="flex h-full w-full items-center justify-center"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring.snappy}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, i) => (i.offset.x < -70 ? go(1) : i.offset.x > 70 ? go(-1) : undefined)}
              >
                {m.kind === 'video' ? (
                  <video
                    src={videoSrc(m.file)}
                    poster={mediaSrc(m)}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full rounded-2xl bg-black shadow-2xl"
                    style={{ aspectRatio: `${m.w} / ${m.h}` }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <img
                    {...full(m)}
                    alt={m.caption}
                    draggable={false}
                    className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                    style={{ aspectRatio: `${m.w} / ${m.h}` }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {items.length > 1 && (
              <>
                <button onClick={(e) => (e.stopPropagation(), go(-1))} className="absolute left-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-cream/10 text-cream hover:bg-cream/20 sm:grid" aria-label="Sebelumnya">
                  <ChevronLeft className="size-6" />
                </button>
                <button onClick={(e) => (e.stopPropagation(), go(1))} className="absolute right-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-cream/10 text-cream hover:bg-cream/20 sm:grid" aria-label="Berikutnya">
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
          <p className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center font-cond text-sm italic text-cream/40 sm:hidden">geser untuk foto lain</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
