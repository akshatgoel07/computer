import { useEffect, useState } from 'react'
import { images } from '@/assets'
import { play } from '@/lib/sound'
import { useShellStore } from '@/stores/shellStore'
import BootScreen from './BootScreen'
import WelcomeScreen from './WelcomeScreen'
import './boot.css'

export default function BootSequence({ welcomeOnly = false }: { welcomeOnly?: boolean }) {
  const [elapsed, setElapsed] = useState<number | null>(null)
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setInterval> | undefined
    let sounded = false
    const preload = [images.bootActivity, images.logonBackground].map(src => {
      const image = new Image()
      image.src = src
      return image.decode()
    })
    void Promise.allSettled(preload).then(() => {
      if (disposed) return
      const started = performance.now() - (welcomeOnly ? 7000 : 0)
      setElapsed(welcomeOnly ? 7000 : 0)
      timer = setInterval(() => {
        const time = performance.now() - started
        if (time >= 7000 && !sounded) {
          sounded = true
          if (!welcomeOnly && time < 9000) void play('startup', started + 9000)
        }
        if (time >= 9500) {
          clearInterval(timer)
          useShellStore.getState().setSession('desktop')
        } else setElapsed(time)
      }, 1000 / 15)
    })
    return () => { disposed = true; clearInterval(timer) }
  }, [welcomeOnly])

  if (elapsed === null) return <div className="boot-preload" />
  if (elapsed < 7000) return <BootScreen elapsed={elapsed} />
  return <WelcomeScreen reveal={elapsed >= 9000} />
}
