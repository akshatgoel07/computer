import { useEffect, useRef, useState } from 'react'
import { duration, easing, modeRect, useAero } from './aero'
export default function AeroPreview() {
  const snap = useAero(state => state.snap)
  const [visible, setVisible] = useState(snap)
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (snap) { setVisible(snap); return }
    const animation = element.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration(100), fill: 'both' })
    if (animation) animation.onfinish = () => { setVisible(null); animation.cancel() }
    else setVisible(null)
    return () => animation?.cancel()
  }, [snap])
  useEffect(() => {
    if (!visible || !snap) return
    const animation = element.current?.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: duration(150), easing, fill: 'both' })
    if (animation) animation.onfinish = () => animation.cancel()
    return () => animation?.cancel()
  }, [visible, snap])
  if (!visible) return null
  const rect = modeRect(visible, { x: 0, y: 0, width: 0, height: 0 })
  return <div ref={element} className="aero-snap-preview" aria-hidden="true" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />
}
