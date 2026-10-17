import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { duration } from './aero'
type Tip = { text: string; x: number; y: number; open: boolean }
export default function Tooltip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = box.current
    if (!element || !tip) return
    const rect = element.getBoundingClientRect()
    element.style.left = `${Math.max(2, Math.min(tip.x + 12, innerWidth - rect.width - 2))}px`
    element.style.top = `${Math.max(2, Math.min(tip.y + 20, innerHeight - rect.height - 2))}px`
  }, [tip])
  useEffect(() => {
    let target: HTMLElement | null = null
    let open: ReturnType<typeof setTimeout> | undefined
    let close: ReturnType<typeof setTimeout> | undefined
    let maximum: ReturnType<typeof setTimeout> | undefined
    let shown = false
    let recent = 0
    let x = 0; let y = 0
    const hide = () => {
      clearTimeout(open); clearTimeout(close); clearTimeout(maximum)
      if (shown) recent = performance.now()
      shown = false
      setTip(value => value ? { ...value, open: false } : null)
      close = setTimeout(() => setTip(null), duration(100))
    }
    const over = (event: PointerEvent) => {
      const next = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tooltip],[title]') : null
      if (next === target) return
      hide()
      target = next
      if (!next) return
      const text = next.getAttribute('title') ?? next.dataset.tooltip
      if (!text) return
      if (next.hasAttribute('title')) { next.dataset.tooltip = text; next.removeAttribute('title') }
      x = event.clientX; y = event.clientY
      open = setTimeout(() => {
        if (!next.isConnected || next.closest('[inert]')) return
        clearTimeout(close)
        shown = true
        setTip({ text, x, y, open: true })
        maximum = setTimeout(hide, 5000)
      }, recent && performance.now() - recent < 5000 ? 100 : 500)
    }
    const out = (event: PointerEvent) => { if (target && (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget))) { target = null; hide() } }
    const move = (event: PointerEvent) => { x = event.clientX; y = event.clientY }
    window.addEventListener('pointerover', over)
    window.addEventListener('pointerout', out)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', hide)
    window.addEventListener('keydown', hide)
    return () => { clearTimeout(open); clearTimeout(close); clearTimeout(maximum); window.removeEventListener('pointerover', over); window.removeEventListener('pointerout', out); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', hide); window.removeEventListener('keydown', hide) }
  }, [])
  return tip ? <div ref={box} className="aero-tooltip" role="tooltip" data-open={tip.open} style={{ left: tip.x + 12, top: tip.y + 20 }}>{tip.text}</div> : null
}
