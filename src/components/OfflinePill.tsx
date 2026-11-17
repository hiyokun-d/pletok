import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { WifiOff } from 'lucide-react'

const subscribe = (f: () => void) => {
  window.addEventListener('online', f)
  window.addEventListener('offline', f)
  return () => {
    window.removeEventListener('online', f)
    window.removeEventListener('offline', f)
  }
}

/** a quiet note while the phone has no signal — the saved menu keeps working underneath */
export function OfflinePill() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  return (
    <AnimatePresence>
      {!online && (
        <motion.p
          role="status"
          className="fixed left-1/2 top-3 z-[60] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-brown px-4 py-2 font-display text-sm font-semibold text-cream shadow-lg"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
        >
          <WifiOff className="size-4 text-yakult" /> Offline — menu tetap bisa dilihat
        </motion.p>
      )}
    </AnimatePresence>
  )
}
