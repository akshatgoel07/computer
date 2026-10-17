import { Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useExplorerStore } from '@/stores/explorerStore'
import { useFilesStore } from '@/stores/filesStore'
import { locationName } from '@/fs/paths'
import { apps, appSizes } from '@/lib/apps'
import { resizeRect, visibleRect, workArea, type Rect, type ResizeEdge } from '@/lib/windowGeometry'
import { useWindows, type WindowRecord } from '@/stores/windows'
import { Spinner } from '@/boot/WelcomeScreen'

const edges: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
type Gesture = { pointer: number; x: number; y: number; rect: Rect; edge: ResizeEdge | 'move'; target: HTMLElement }

export default function WindowFrame({ record, zIndex, peek }: { record: WindowRecord; zIndex: number; peek: boolean }) {
  const active = useWindows(state => state.activeId === record.id)
  const frame = useRef<HTMLElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const raf = useRef(0)
  const draft = useRef<Rect | null>(null)
  const [viewport, setViewport] = useState(workArea)
  const location = useExplorerStore(state => state.sessions[record.id]?.location)
  const files = useFilesStore()
  const explorer = record.launchContext.kind === 'explorer'
  const title = location ? locationName(files, location) : record.title
  const app = apps[record.appId]
  const Content = app.component
  const minimum = { width: appSizes[record.appId]?.minWidth ?? 320, height: appSizes[record.appId]?.minHeight ?? 200 }
  const rect = record.mode === 'maximized' ? { x: 0, y: 0, ...viewport } : visibleRect(record.normalRect, viewport, minimum)
  useEffect(() => {
    const resize = () => setViewport(workArea())
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf.current) }
  }, [])
  useEffect(() => {
    if (active && !record.minimized) (frame.current?.querySelector<HTMLElement>('[data-app-focus]') ?? frame.current)?.focus({ preventScroll: true })
  }, [active, record.minimized])
  const paint = () => {
    const node = frame.current
    const next = draft.current
    if (!node || !next) return
    node.style.left = `${next.x}px`
    node.style.top = `${next.y}px`
    node.style.width = `${next.width}px`
    node.style.height = `${next.height}px`
  }
  const begin = (event: ReactPointerEvent<HTMLElement>, edge: Gesture['edge']) => {
    if (event.button !== 0 || record.mode === 'maximized') return
    if (event.target instanceof Element && event.target.closest('.title-bar-controls')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, rect, edge, target: event.currentTarget }
    draft.current = rect
    frame.current?.classList.add('geometry-active')
  }
  const update = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = gesture.current
    if (!drag || event.pointerId !== drag.pointer) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    draft.current = drag.edge === 'move' ? visibleRect({ ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy }) : resizeRect(drag.rect, drag.edge, dx, dy, minimum)
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(paint)
  }
  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = gesture.current
    if (!drag || event.pointerId !== drag.pointer) return
    cancelAnimationFrame(raf.current)
    paint()
    if (draft.current) useWindows.getState().move(record.id, draft.current)
    gesture.current = null
    draft.current = null
    frame.current?.classList.remove('geometry-active')
    if (drag.target.hasPointerCapture(event.pointerId)) drag.target.releasePointerCapture(event.pointerId)
  }
  const style: CSSProperties = {
    left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex,
    display: record.minimized ? 'none' : undefined,
  }
  return <section ref={frame} className={`window glass shell-window${explorer ? ' explorer-window' : ''}${active ? ' active' : ''}${record.mode === 'maximized' ? ' maximized' : ''}`}
    style={style} role="dialog" aria-label={title} tabIndex={-1} data-peek={peek}
    inert={record.minimized} onPointerDown={() => useWindows.getState().focus(record.id)}
    onPointerMove={update} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
    <div className="title-bar" onPointerDown={event => begin(event, 'move')}
      onDoubleClick={event => {
        if (!(event.target instanceof Element && event.target.closest('.title-bar-controls'))) useWindows.getState().toggleMaximize(record.id)
      }}>
      {!explorer && <img className="window-icon" src={app.icon} alt="" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden' }} />}
      <div className="title-bar-text">{explorer ? '' : title}</div>
      <div className="title-bar-controls">
        <button aria-label="Minimize" onClick={() => useWindows.getState().minimize(record.id)} />
        <button aria-label={record.mode === 'maximized' ? 'Restore' : 'Maximize'} onClick={() => useWindows.getState().toggleMaximize(record.id)} />
        <button aria-label="Close" onClick={() => useWindows.getState().close(record.id)} />
      </div>
    </div>
    <div className="window-body"><Suspense fallback={<div className="app-loading" role="status" aria-label="Please wait"><Spinner /></div>}><Content windowId={record.id} /></Suspense></div>
    {record.mode === 'normal' && edges.map(edge => <div key={edge} className={`resize-edge edge-${edge}`} onPointerDown={event => begin(event, edge)} />)}
  </section>
}
