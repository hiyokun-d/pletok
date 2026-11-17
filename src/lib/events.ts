/** Tiny app-wide signals (no state library needed): crew panel → booth screen. */
type Handler = () => void
type Name = 'grand-opening' | 'replay-intro'
const handlers = new Map<string, Set<Handler>>()

export const signal = {
  on(name: Name, fn: Handler) {
    if (!handlers.has(name)) handlers.set(name, new Set())
    handlers.get(name)!.add(fn)
    return () => handlers.get(name)!.delete(fn)
  },
  emit(name: Name) {
    handlers.get(name)?.forEach((fn) => fn())
  },
}
