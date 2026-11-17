/// <reference types="node" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const SITE_URL = 'https://pletok.hiyokun.dev'

/**
 * SEO bits that need the site's real address: absolute og:image / canonical (WhatsApp & Facebook
 * need absolute URLs), robots.txt and sitemap.xml. Override with SITE_URL for another deploy.
 */
function seo(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/+$/, '')
  return {
    name: 'pletok-seo',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', base),
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', ...(base ? [`Sitemap: ${base}/sitemap.xml`] : [])].join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots}\n` })
      if (!base) return
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n</urlset>\n`,
      })
    },
  }
}

/**
 * Emits /sw.js (template: src/sw.js) with this build's files to save for offline use: the app,
 * its CSS, every picture and the Latin fonts (~1.6 MB). Other font subsets get cached when used.
 */
function offline(): Plugin {
  return {
    name: 'pletok-offline',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|png|jpe?g|svg|webp)$/.test(f) || /latin-\d+-normal.*\.woff2$/.test(f))
        .filter((f) => !/^(sw\.js|robots\.txt|sitemap\.xml)$/.test(f) && !/(cyrillic|vietnamese|greek|latin-ext)/.test(f))
        .map((f) => `/${f}`)
      const extra = ['/favicon.svg', '/icon-192.png', '/manifest.webmanifest']
      const list = [...files, ...extra]
      const version = createHash('sha1').update(list.join()).digest('hex').slice(0, 10)
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(list))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), tailwindcss(), seo(env.SITE_URL || SITE_URL), offline()],
    server: { host: true },
  }
})
