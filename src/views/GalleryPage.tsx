import { LayoutGroup, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Images, Play, Video } from 'lucide-react'
import { EVENT, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../data/event'
import { MEDIA, RECAP, STORY_VIDEO, thumb, videoSrc, type Media } from '../data/recap'
import { InstagramIcon } from '../components/InstagramIcon'
import { MediaLightbox } from '../components/MediaLightbox'
import { GigiBalang } from '../components/BetawiPattern'
import { spring } from '../lib/motion'

type Filter = 'all' | 'photo' | 'video'
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'photo', label: 'Foto' },
  { id: 'video', label: 'Video' },
]

/**
 * /gallery — every photo and clip from the day (public/gallery, made smaller from the originals),
 * plus the 9:16 story video to save and post. Grids load the small pictures only; full size and
 * videos download when one is opened.
 */
export function GalleryPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [at, setAt] = useState<number | null>(null)
  const [story, setStory] = useState(false)
  const items = MEDIA.filter((m) => filter === 'all' || m.kind === filter)
  useEffect(() => {
    document.title = 'Galeri · Pletok di BINUS Festival'
  }, [])

  return (
    <main className="paper min-h-[100svh] text-brown">
      <header className="relative bg-brown px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] text-cream sm:px-8">
        <div className="mx-auto max-w-6xl">
          <a href="/" className="inline-flex items-center gap-1.5 rounded-full py-2 pr-3 font-cond text-base font-semibold italic text-cream/60 hover:text-cream">
            <ArrowLeft className="size-4" /> Pletok
          </a>
          <div className="mt-6 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.3em] text-yakult sm:text-base">
                {EVENT.name} · 25.11.2026 · {EVENT.table}
              </p>
              <h1 className="mt-2 font-display text-[clamp(3rem,10vw,6rem)] font-bold leading-[0.9]">Galeri</h1>
              <p className="mt-3 max-w-xl font-display text-base text-cream/80 sm:text-lg">
                {RECAP.cups} cup, ludes jam {RECAP.soldOutAt}. Foto & video dari Meja 9, bebas disimpan.
              </p>
            </div>
            <StoryCard onOpen={() => setStory(true)} />
          </div>
        </div>
        <GigiBalang className="absolute inset-x-0 -bottom-px" color="#f5ebdd" accent="#a8572a" flip size={30} />
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-8">
        <LayoutGroup>
          <div className="flex gap-1 rounded-full bg-cream-deep p-1 ring-1 ring-brown/10 sm:w-fit" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className="relative flex-1 rounded-full px-2.5 py-2.5 font-display text-sm font-semibold min-[380px]:px-4 min-[380px]:text-base sm:flex-none sm:px-5">
                {filter === f.id && <motion.span layoutId="gal-filter" className="absolute inset-0 rounded-full bg-brown" transition={spring.snappy} />}
                <span className={`relative flex items-center justify-center gap-1.5 ${filter === f.id ? 'text-cream' : 'text-brown-soft'}`}>
                  {f.id === 'video' ? <Video className="hidden size-4 min-[380px]:block" /> : f.id === 'photo' ? <Images className="hidden size-4 min-[380px]:block" /> : null}
                  {f.label}
                  <span className="font-cond text-sm italic opacity-60">{MEDIA.filter((m) => f.id === 'all' || m.kind === f.id).length}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 columns-2 gap-2.5 sm:gap-4 md:columns-3 lg:columns-4 [&>*]:mb-2.5 sm:[&>*]:mb-4">
            {items.map((m, i) => (
              <Tile key={m.file} m={m} i={i} onOpen={() => setAt(i)} />
            ))}
          </div>
        </LayoutGroup>

        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="max-w-md font-display text-lg text-brown-soft">Ada kamu di foto? Tag @pletok._</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brown px-6 py-3.5 font-display text-lg font-bold text-cream">
              <InstagramIcon /> {INSTAGRAM_HANDLE}
            </a>
            <a href="/" className="inline-flex items-center gap-2 rounded-full border-2 border-brown/30 px-6 py-3 font-display text-lg font-semibold">
              Rekap lengkap
            </a>
          </div>
        </div>
      </section>

      <MediaLightbox items={items} at={at} onAt={setAt} />
      <MediaLightbox items={[STORY]} at={story ? 0 : null} onAt={(i) => setStory(i !== null)} />
    </main>
  )
}

function Tile({ m, i, onOpen }: { m: Media; i: number; onOpen: () => void }) {
  return (
    <motion.button
      layout
      onClick={onOpen}
      className="group relative block w-full break-inside-avoid overflow-hidden rounded-[1.25rem] bg-cream-deep shadow-[0_12px_30px_-18px_rgb(90_46_26/0.5)]"
      style={{ aspectRatio: `${m.w} / ${m.h}` }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.glide, delay: Math.min(i, 10) * 0.04 }}
    >
      <img {...thumb(m, '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw')} alt={m.caption} loading={i < 6 ? 'eager' : 'lazy'} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      {m.kind === 'video' && (
        <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream/85 text-brown shadow-lg transition-transform group-hover:scale-110">
          <Play className="ml-0.5 size-6 fill-brown" />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10 text-left font-display text-sm font-semibold text-cream opacity-90">{m.caption}</span>
    </motion.button>
  )
}

const STORY: Media = { kind: 'video', file: STORY_VIDEO.file, w: STORY_VIDEO.w, h: STORY_VIDEO.h, caption: 'Video story Pletok' }

/** the 9:16 video made for Instagram stories: watch it big, or save it and post */
function StoryCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-[1.75rem] bg-cream/[0.07] p-3 pr-5 ring-1 ring-cream/15">
      <button onClick={onOpen} className="group relative w-24 shrink-0 overflow-hidden rounded-2xl bg-black sm:w-28" style={{ aspectRatio: `${STORY_VIDEO.w} / ${STORY_VIDEO.h}` }} aria-label="Putar video story">
        <img src={`/gallery/${STORY.file}-xs.webp`} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
        <span className="absolute inset-0 grid place-items-center bg-black/20">
          <Play className="size-7 fill-cream text-cream" />
        </span>
      </button>
      <div>
        <p className="font-display text-lg font-bold leading-tight">Video story</p>
        <p className="font-cond text-sm italic text-cream/60">33 detik · 9:16 · siap buat IG</p>
        <a href={videoSrc(STORY_VIDEO.file)} download="pletok-story.mp4" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 font-display text-sm font-bold text-brown">
          <Download className="size-4" /> Simpan
        </a>
      </div>
    </div>
  )
}
