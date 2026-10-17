import { Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useExplorerStore } from '@/stores/explorerStore'
import { useFilesStore } from '@/stores/filesStore'
import { locationName } from '@/fs/paths'
import { apps, appSizes } from '@/lib/apps'
import { resizeRect, visibleRect, workArea, type Rect, type ResizeEdge } from '@/lib/windowGeometry'
import { useWindows, type WindowRecord } from '@/stores/windows'
import { Spinner } from '@/boot/WelcomeScreen'
import { cancelPreviews, duration, easing, modeRect, rectangleTransform, taskRectangle, useAero } from './aero'
const edges: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
type Gesture = { pointer: number; x: number; y: number; rect: Rect; edge: ResizeEdge | 'move'; target: HTMLElement; anchor: number; direction: number; reversals: number; since: number }
function Loading() {
  const [busy, setBusy] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setBusy(true), 100); return () => clearTimeout(timer) }, [])
  return <div className="app-loading" data-busy={busy} role="status" aria-label="Please wait"><Spinner /></div>
}
export default function WindowFrame({ record, zIndex, peek }: { record: WindowRecord; zIndex: number; peek: boolean }) {
  const peekTarget = useAero(state => state.peek === record.id)
  const active = useWindows(state => state.activeId === record.id)
  const frame = useRef<HTMLElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const raf = useRef(0)
  const cooldown = useRef(0)
  const draft = useRef<Rect | null>(null)
  const animation = useRef<Animation | null>(null)
  const base = useRef<Rect>(record.normalRect)
  const previous = useRef<Rect>(record.normalRect)
  const lastToken = useRef(0)
  const [hidden, setHidden] = useState(record.minimized)
  const [dragNormal, setDragNormal] = useState(false)
  const [viewport, setViewport] = useState(workArea)
  const location = useExplorerStore(state => state.sessions[record.id]?.location)
  const files = useFilesStore()
  const explorer = record.launchContext.kind === 'explorer'
  const title = location ? locationName(files, location) : record.title
  const app = apps[record.appId]
  const Content = app.component
  const minimum = { width: appSizes[record.appId]?.minWidth ?? 320, height: appSizes[record.appId]?.minHeight ?? 200 }
  const rect = modeRect(record.mode, visibleRect(record.normalRect, viewport, minimum), viewport)
  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    if (lastToken.current === record.transition.token) { previous.current = rect; return }
    let source = record.transition.from ?? previous.current
    let opacity = 1
    if (animation.current?.playState === 'running') {
      const computed = getComputedStyle(element)
      const matrix = new DOMMatrix(computed.transform)
      const origin = computed.transformOrigin.split(' ').map(Number.parseFloat)
      source = { x: base.current.x + matrix.e + origin[0] * (1 - matrix.a), y: base.current.y + matrix.f + origin[1] * (1 - matrix.d), width: base.current.width * matrix.a, height: base.current.height * matrix.d }
      opacity = Number(computed.opacity)
    }
    animation.current?.cancel()
    lastToken.current = record.transition.token
    previous.current = rect
    base.current = rect
    const kind = record.transition.kind
    if (kind !== 'close' || !record.minimized) setHidden(false)
    const center = kind === 'open' || kind === 'close'
    element.style.transformOrigin = center ? 'center center' : '0px 0px'
    const frames: Keyframe[] = kind === 'open' ? [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'scale(1)' }]
      : kind === 'close' ? [{ opacity, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.95)' }]
      : kind === 'minimize' ? [{ opacity, transform: rectangleTransform(rect, source) }, { opacity: 0, transform: rectangleTransform(rect, taskRectangle(record.id)) }]
      : [{ opacity: kind === 'restore' ? 0 : opacity, transform: rectangleTransform(rect, kind === 'restore' ? taskRectangle(record.id) : source) }, { opacity: 1, transform: 'none' }]
    const current = element.animate(frames, { duration: duration(center ? 150 : 200), easing, fill: 'both' })
    animation.current = current
    current.onfinish = () => {
      if (animation.current !== current) return
      if (kind === 'close') useWindows.getState().finishClose(record.id)
      else if (kind === 'minimize') setHidden(true)
      element.style.transform = ''
      current.cancel()
      animation.current = null
    }
  }, [record.transition.token, rect.x, rect.y, rect.width, rect.height])
  useEffect(() => {
    const resize = () => setViewport(workArea())
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf.current); animation.current?.cancel(); lastToken.current = 0 }
  }, [])
  useEffect(() => {
    if (active && !record.minimized && !record.closing) (frame.current?.querySelector<HTMLElement>('[data-app-focus]') ?? frame.current)?.focus({ preventScroll: true })
  }, [active, record.minimized, record.closing])
  const paint = () => {
    const node = frame.current
    const next = draft.current
    if (!node || !next) return
    Object.assign(node.style, { left: `${next.x}px`, top: `${next.y}px`, width: `${next.width}px`, height: `${next.height}px` })
  }
  const begin = (event: ReactPointerEvent<HTMLElement>, edge: Gesture['edge']) => {
    if (event.button !== 0 || (edge !== 'move' && record.mode === 'maximized')) return
    if (event.target instanceof Element && event.target.closest('.title-bar-controls')) return
    cancelPreviews()
    animation.current?.cancel()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    let start = rect
    if (edge === 'move' && record.mode !== 'normal') {
      const normal = visibleRect(record.normalRect, viewport, minimum)
      start = { ...normal, x: event.clientX - (event.clientX - rect.x) / rect.width * normal.width, y: Math.max(0, event.clientY - 15) }
      setDragNormal(true)
    }
    gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, rect: start, edge, target: event.currentTarget, anchor: event.clientX, direction: 0, reversals: 0, since: performance.now() }
    draft.current = start
    frame.current?.classList.add('geometry-active')
    paint()
  }
  const update = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = gesture.current
    if (!drag || event.pointerId !== drag.pointer) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    draft.current = drag.edge === 'move' ? visibleRect({ ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy }) : resizeRect(drag.rect, drag.edge, dx, dy, minimum)
    if (drag.edge === 'move') {
      const snap = event.clientY <= 1 ? 'maximized' : event.clientX <= 1 ? 'left' : event.clientX >= viewport.width - 1 ? 'right' : null
      if (useAero.getState().snap !== snap) useAero.setState({ snap })
      const now = performance.now()
      if (now - drag.since > 500) { drag.since = now; drag.reversals = 0; drag.direction = 0; drag.anchor = event.clientX }
      const travel = event.clientX - drag.anchor
      if (Math.abs(travel) >= 20) {
        const direction = Math.sign(travel)
        if (drag.direction && direction !== drag.direction) drag.reversals++
        drag.direction = direction
        drag.anchor = event.clientX
        if (drag.reversals >= 3 && now >= cooldown.current) { useWindows.getState().shake(record.id); cooldown.current = now + 1000; drag.reversals = 0 }
      }
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(paint)
  }
  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = gesture.current
    if (!drag || event.pointerId !== drag.pointer) return
    cancelAnimationFrame(raf.current)
    paint()
    const snap = useAero.getState().snap
    if (draft.current) {
      if (snap && drag.edge === 'move' && event.type !== 'pointercancel') {
        const source = draft.current
        useWindows.getState().geometry(record.id, snap, source)
        draft.current = modeRect(snap, record.normalRect, viewport)
        paint()
      }
      else useWindows.getState().move(record.id, draft.current)
    }
    useAero.setState({ snap: null })
    gesture.current = null
    draft.current = null
    setDragNormal(false)
    frame.current?.classList.remove('geometry-active')
    if (drag.target.hasPointerCapture(event.pointerId)) drag.target.releasePointerCapture(event.pointerId)
  }
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: peekTarget ? 1040 : zIndex, display: record.minimized && hidden && !peekTarget ? 'none' : undefined }
  return <section ref={frame} className={`window glass shell-window${explorer ? ' explorer-window' : ''}${active ? ' active' : ''}${record.mode === 'maximized' && !dragNormal ? ' maximized' : ''}`}
    style={style} data-window-id={record.id} data-mode={dragNormal ? 'normal' : record.mode} role="dialog" aria-label={title} tabIndex={-1} data-peek={peek}
    inert={record.minimized || record.closing || peek} onPointerDown={() => useWindows.getState().focus(record.id)}
    onPointerMove={update} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
    <div className="title-bar" onPointerDown={event => begin(event, 'move')} onDoubleClick={event => {
      if (!(event.target instanceof Element && event.target.closest('.title-bar-controls'))) useWindows.getState().toggleMaximize(record.id)
    }}>
      {!explorer && <img className="window-icon" src={app.icon} alt="" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden' }} />}
      <div className="title-bar-text">{explorer ? '' : title}</div>
      <div className="title-bar-controls">
        <button aria-label="Minimize" data-tooltip="Minimize" onClick={() => useWindows.getState().minimize(record.id)} />
        <button aria-label={record.mode === 'maximized' ? 'Restore' : 'Maximize'} data-tooltip={record.mode === 'maximized' ? 'Restore' : 'Maximize'} onClick={() => useWindows.getState().toggleMaximize(record.id)} />
        <button aria-label="Close" data-tooltip="Close" onClick={() => useWindows.getState().close(record.id)} />
      </div>
    </div>
    <div className="window-body"><Suspense fallback={<Loading />}><Content windowId={record.id} /></Suspense></div>
    {record.mode !== 'maximized' && edges.map(edge => <div key={edge} className={`resize-edge edge-${edge}`} onDoubleClick={() => { if (edge === 'n' || edge === 's') useWindows.getState().geometry(record.id, record.mode === 'vertical' ? 'normal' : 'vertical') }} onPointerDown={event => begin(event, edge)} />)}
  </section>
}
