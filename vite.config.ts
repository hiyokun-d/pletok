import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), tailwindcss(), seo(env.SITE_URL || SITE_URL)],
    server: { host: true },
  }
})
