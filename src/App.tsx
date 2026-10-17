import { lazy, Suspense, useEffect } from 'react'
import { cursors, images } from '@/assets'
import { unlockAudio } from '@/lib/sound'
import BootSequence from '@/boot/BootSequence'
import WelcomeScreen from '@/boot/WelcomeScreen'
const Desktop = lazy(() => import('@/shell/Desktop'))
import { useShellStore } from '@/stores/shellStore'
import { useWindows } from '@/stores/windows'

export default function App() {
  const session = useShellStore(state => state.session)
  const setSession = useShellStore(state => state.setSession)
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  useEffect(() => {
    if (session !== 'shutdown' && session !== 'restart' && session !== 'logoff') return
    useWindows.getState().reset()
    const timer = setTimeout(() => setSession(session === 'restart' ? 'boot' : session === 'logoff' ? 'welcome' : 'idle'), 1500)
    return () => clearTimeout(timer)
  }, [session, setSession])
  const style = {
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
    '--boot-activity': `url("${images.bootActivity}")`,
    '--logon-background': `url("${images.logonBackground}")`,
    '--wallpaper': `url("${images.wallpaper}")`,
    '--start-orb': `url("${images.startOrb}")`,
    '--cursor-arrow': `url("${cursors.arrow}"), default`,
    '--cursor-link': `url("${cursors.link}"), pointer`,
    '--cursor-busy': `url("${cursors.busy}"), wait`,
  }
  return <div className="computer" style={style}>
    {(session === 'desktop' || session === 'boot' || session === 'welcome' || session === 'locked') && <Suspense fallback={null}><Desktop enabled={session === 'desktop'} /></Suspense>}
    {session === 'idle' && <button className="start-screen" onClick={() => { unlockAudio(); setSession('boot') }}>Click to start</button>}
    {(session === 'boot' || session === 'welcome') && <BootSequence key={session} welcomeOnly={session === 'welcome'} />}
    {(session === 'shutdown' || session === 'restart' || session === 'logoff') && <WelcomeScreen text={session === 'logoff' ? 'Logging off...' : 'Shutting down...'} />}
    {session === 'locked' && <WelcomeScreen locked onUnlock={() => setSession('desktop')} />}
  </div>
}
