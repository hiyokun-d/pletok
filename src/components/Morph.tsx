import { AnimatePresence, motion } from 'motion/react'

/**
 * Text that changes like iOS numeric text: only the characters that differ roll — the old one
 * lifts away into a blur, the new one rises out of it with a soft spring. Counted from the right,
 * so "18K" → "15K" rolls just the 8, and "9K" → "15K" keeps the K and grows a digit.
 * Strike-throughs on the parent carry into each character.
 */
export function Morph({ text, className = '' }: { text: string | number; className?: string }) {
  const chars = String(text).split('')
  return (
    <span className={`inline-flex whitespace-pre [text-decoration:inherit] ${className}`} aria-label={String(text)}>
      {chars.map((c, i) => {
        const fromRight = chars.length - i
        return (
          <span key={fromRight} aria-hidden className="relative inline-block [text-decoration:inherit]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={c}
                className="inline-block [text-decoration:inherit]"
                initial={{ y: '60%', opacity: 0, scale: 0.8, filter: 'blur(6px)' }}
                animate={{ y: '0%', opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ y: '-60%', opacity: 0, scale: 0.8, filter: 'blur(6px)' }}
                transition={{ type: 'spring', stiffness: 260, damping: 24, delay: (fromRight - 1) * 0.05 }}
              >
                {c}
              </motion.span>
            </AnimatePresence>
          </span>
        )
      })}
    </span>
  )
}
