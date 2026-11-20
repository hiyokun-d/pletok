/*
 * Short beeps made on the spot (no sound file to load). Browsers only play sound after a tap on the
 * page, so a toggle/button calls unlockAudio() once; after that chime() works from timers too.
 */

let ac: AudioContext | null = null
// older Safari only has the webkit- name
const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
const ctx = () => {
  if (!AC) throw new Error('no audio')
  return (ac ??= new AC())
}

export function unlockAudio() {
  try {
    void ctx().resume()
  } catch {
    /* no audio on this device */
  }
}

/** notes in Hz, played one after another */
export function chime(notes = [880, 1320], gap = 0.22) {
  try {
    const a = ctx()
    if (a.state === 'suspended') void a.resume()
    notes.forEach((f, i) => {
      const o = a.createOscillator()
      const g = a.createGain()
      const t = a.currentTime + i * gap
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      o.connect(g).connect(a.destination)
      o.start(t)
      o.stop(t + 0.55)
    })
  } catch {
    /* no audio — the screen still says it */
  }
}
