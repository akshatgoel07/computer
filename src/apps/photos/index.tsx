import { useEffect, useRef, useState } from 'react'
import { images } from '@/assets'
import { displayName, inBin } from '@/fs/paths'
import { type NodeId } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
import { useWindows } from '@/stores/windows'
import { requestDelete } from '@/shell/DeleteDialog'
import ContextMenu, { type MenuEntry } from '@/shell/ContextMenu'
import './photos.css'
export default function Photos({ windowId }: { windowId: string }) {
  const context = useWindows(state => state.windows[windowId]?.launchContext)
  const files = useFilesStore()
  const initial = context?.kind === 'photo' ? context : null
  const [current, setCurrent] = useState<NodeId | null>(initial?.id ?? null)
  const [zoom, setZoom] = useState<number | null>(null)
  const [rotation, setRotation] = useState<Record<string, number>>({})
  const [slideShow, setSlideShow] = useState(initial?.slideShow ?? false)
  const [slider, setSlider] = useState(false)
  const [decoding, setDecoding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [natural, setNatural] = useState({ width: 1, height: 1 })
  const [space, setSpace] = useState({ width: 800, height: 480 })
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const ids = (initial?.ids ?? []).filter(id => { const node = files.nodes[id]; return node?.kind === 'file' && node.payload.kind === 'image' && !inBin(files, id) })
  const idsKey = JSON.stringify(ids)
  const node = current ? files.nodes[current] : null
  const live = node?.kind === 'file' && node.payload.kind === 'image' && !inBin(files, node.id) ? node : null
  useEffect(() => {
    setDecoding(Boolean(live))
    setBusy(false)
    const timer = setTimeout(() => setBusy(true), 100)
    return () => clearTimeout(timer)
  }, [live?.id])
  const next = (delta: number) => { if (ids.length) { const index = current ? ids.indexOf(current) : -1; setCurrent(ids[(index + delta + ids.length) % ids.length]); setZoom(null) } }
  useEffect(() => { stage.current?.closest<HTMLElement>('.photos-app')?.focus() }, [])
  useEffect(() => { if (!live && ids.length) setCurrent(ids[0]) }, [live, idsKey])
  useEffect(() => { useWindows.getState().setTitle(windowId, live ? `${displayName(live)} - Windows Photo Viewer` : 'Windows Photo Viewer') }, [windowId, live?.name])
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(() => setSpace({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { if (context?.kind === 'photo' && context.slideShow) setSlideShow(true) }, [context])
  useEffect(() => { if (!slideShow || !ids.length) return; const timer = setInterval(() => next(1), 5000); return () => clearInterval(timer) }, [slideShow, current, idsKey])
  useEffect(() => {
    const record = useWindows.getState().windows[windowId]
    if (current && record?.launchContext.kind === 'photo' && (record.launchContext.id !== current || record.launchContext.slideShow !== slideShow)) useWindows.getState().setContext(windowId, { ...record.launchContext, id: current, slideShow })
  }, [current, slideShow, windowId])
  const angle = current ? rotation[current] ?? 0 : 0
  const swapped = Math.abs(angle % 180) === 90
  const bounds = swapped ? { width: natural.height, height: natural.width } : natural
  const scale = zoom === null ? Math.min(space.width / bounds.width, space.height / bounds.height) : zoom / 100
  const rotate = (delta: number) => { if (current) setRotation(values => ({ ...values, [current]: (values[current] ?? 0) + delta })) }
  const button = (label: string, glyph: string, action: () => void, large = false) => <button key={label} className={`photo-button ${large ? 'photo-play' : ''}`} aria-label={label} data-tooltip={label} disabled={!live} onClick={action}><span className={`photo-glyph ${glyph}`} /></button>
  return <div className="photos-app" tabIndex={0} data-app-focus onKeyDown={event => {
    if (event.target instanceof HTMLInputElement) return
    if (event.key === 'ArrowRight') { event.preventDefault(); next(1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); next(-1) }
    if (event.key === 'Delete' && live) { event.preventDefault(); requestDelete([live.id]) }
    if (event.key === 'Escape') setSlideShow(false)
    if (event.key === 'F11') { event.preventDefault(); setSlideShow(!slideShow) }
  }}><div className="photo-menu">{['File', 'Print', 'E-mail', 'Burn', 'Open'].map(label => <button className="shell-button" key={label} disabled={label !== 'File'} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ x: rect.left, y: rect.bottom, entries: [{ label: 'Delete', action: live ? () => requestDelete([live.id]) : undefined }, { separator: true }, { label: 'Exit', action: () => useWindows.getState().close(windowId) }] }) }}>{label}</button>)}</div><div className="photo-stage" ref={stage} style={{ cursor: decoding && busy ? 'var(--cursor-busy)' : 'var(--cursor-arrow)' }} onDoubleClick={() => setZoom(zoom === null ? 100 : null)}>{live && live.payload.kind === 'image' ? <div className="photo-bounds" style={{ width: bounds.width * scale, height: bounds.height * scale }}><img src={images[live.payload.key]} alt={displayName(live)} onError={() => setDecoding(false)} onLoad={event => { setDecoding(false); setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }) }} style={{ width: natural.width * scale, height: natural.height * scale, transform: `translate(-50%,-50%) rotate(${angle}deg)` }} /></div> : <p>No picture is available.</p>}</div><div className="photo-controls">{button('Zoom', 'zoom', () => setSlider(!slider))}{slider && <input aria-label="Zoom level" type="range" min={10} max={400} step={10} value={zoom ?? Math.max(10, Math.min(400, Math.round(scale * 10) * 10))} onChange={event => setZoom(Number(event.target.value))} />}{button(zoom === null ? 'Actual size' : 'Fit', 'fit', () => setZoom(zoom === null ? 100 : null))}<span className="photo-control-gap" />{button('Previous', 'previous', () => next(-1))}{button(slideShow ? 'Pause slide show' : 'Play slide show', slideShow ? 'pause' : 'play', () => setSlideShow(!slideShow), true)}{button('Next', 'next', () => next(1))}<span className="photo-control-gap" />{button('Rotate counterclockwise', 'rotate-left', () => rotate(-90))}{button('Rotate clockwise', 'rotate-right', () => rotate(90))}{button('Delete', 'delete', () => live && requestDelete([live.id]))}</div>{menu && <ContextMenu {...menu} close={() => setMenu(null)} />}</div>
}
