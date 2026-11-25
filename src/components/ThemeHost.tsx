import { Suspense, lazy, useEffect } from 'react'
import { usePath } from '../lib/nav'
import { useMenu } from '../hooks/useMenu'

/** the sunset scene is its own download — only screens showing the Neon Sunset look pull it in */
const SunsetScene = lazy(() => import('./SunsetTheme').then((m) => ({ default: m.SunsetScene })))

/** the look picked on /config "Tema layar" — see components/SunsetTheme */
const PATHS = ['', '/link', '/cashier']

export function ThemeHost() {
  const { theme } = useMenu()
  const path = usePath()
  const on = theme === 'sunset' && PATHS.includes(path)
  useEffect(() => {
    if (!on) return
    document.documentElement.dataset.theme = 'sunset'
    return () => void delete document.documentElement.dataset.theme
  }, [on])
  return on ? (
    <Suspense fallback={null}>
      <SunsetScene calm={path === '/cashier'} />
    </Suspense>
  ) : null
}

