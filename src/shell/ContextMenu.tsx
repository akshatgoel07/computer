import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cancelPreviews } from './aero'
import { icons } from '@/assets'
import type { IconKey } from '@/fs/types'
export type MenuEntry = { label: string; action?: () => void; checked?: boolean; children?: MenuEntry[]; icon?: IconKey } | { separator: true }
const accelerator = (label: string) => ({ View: 0, 'Sort by': 1, Refresh: 1, Paste: 0, 'Paste shortcut': 6, New: 2, 'Screen resolution': 7, Gadgets: 0, Personalize: 8, Open: 0, 'Open in new window': 8, Cut: 2, Copy: 0, Delete: 0, Rename: 4, Properties: 1, Restore: 0 }[label] ?? Math.max(0, label.search(/[A-Za-z]/)))
type Props = { x: number; y: number; entries: MenuEntry[]; close: () => void; width?: number; slider?: { value: number; change: (value: number) => void }; accelerators?: boolean }
function Panel({ x, y, entries, close, width = 208, back, submenu = false, slider, accelerators = false }: Props & { back?: () => void; submenu?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const [child, setChild] = useState<{ index: number; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useLayoutEffect(() => {
    const element = panel.current
    if (!element) return
    element.style.width = `${width}px`
    const required = Math.max(width, ...Array.from(element.querySelectorAll<HTMLButtonElement>(':scope > button')).map(button => button.scrollWidth + 2))
    element.style.width = `${slider ? 180 : Math.ceil(required / 8) * 8}px`
    const rect = element.getBoundingClientRect()
    const left = submenu && x + rect.width > innerWidth - 2 ? x - rect.width - (element.parentElement?.closest('.context-panel')?.clientWidth ?? 208) + 6 : x
    element.style.left = `${Math.max(2, Math.min(left, innerWidth - rect.width - 2))}px`
    element.style.top = `${Math.max(2, Math.min(y, innerHeight - rect.height - 2))}px`
    element.focus({ preventScroll: true })
    return () => clearTimeout(timer.current)
  }, [x, y, width, submenu])
  const reveal = (index: number) => {
    const element = panel.current?.querySelector<HTMLElement>(`[data-menu-index="${index}"]`)
    if (!element) return
    const rect = element.getBoundingClientRect()
    const menuRect = panel.current!.getBoundingClientRect()
    setChild({ index, x: menuRect.right - 3, y: rect.top - 3 })
  }
  return <div ref={panel} className={`explorer-popup context-menu context-panel${slider ? ' views-panel' : ''}`} role="menu" tabIndex={-1} style={{ left: x, top: y }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (['Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); event.stopPropagation() }
    if (event.key === 'Escape') close()
    if (event.key === 'ArrowLeft') back?.()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') buttons[index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && /[a-z]/i.test(event.key)) { const matching = buttons.find(button => { const entry = entries[Number(button.dataset.menuIndex)]; return entry && 'label' in entry && entry.label[accelerator(entry.label)]?.toLowerCase() === event.key.toLowerCase() }); if (matching) { event.preventDefault(); event.stopPropagation(); matching.click() } }
    if (event.key === 'Home') buttons[0]?.focus()
    if (event.key === 'End') buttons.at(-1)?.focus()
    if (event.key === 'ArrowRight') { const row = Number(document.activeElement?.getAttribute('data-menu-index')); const entry = entries[row]; if (entry && 'children' in entry && entry.children?.length) reveal(row) }
  }}>{slider && <input className="views-slider" onKeyDown={event => event.stopPropagation()} aria-label="Icon size" type="range" min={0} max={7} step={1} value={slider.value} onChange={event => slider.change(Number(event.target.value))} />}{entries.map((entry, index) => 'separator' in entry ? <div className="menu-separator" role="separator" key={index} /> : <button className="shell-button" role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={entry.checked} aria-haspopup={entry.children ? 'menu' : undefined} aria-expanded={entry.children ? child?.index === index : undefined} data-menu-index={index} key={index} disabled={!entry.action && !entry.children?.length} onPointerEnter={() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => entry.children?.length ? reveal(index) : setChild(null), 400)
  }} onClick={() => { if (entry.children?.length) reveal(index); else { close(); entry.action?.() } }}>
    {entry.checked && <span className="menu-check"><img src={icons.check} alt="" /></span>}{entry.icon && <img className="menu-icon" src={icons[entry.icon]} alt="" />}<span>{accelerators ? <>{entry.label.slice(0, accelerator(entry.label))}<u>{entry.label[accelerator(entry.label)]}</u>{entry.label.slice(accelerator(entry.label) + 1)}</> : entry.label}</span>{entry.children?.length ? <span className="submenu-arrow" /> : null}
  </button>)}{child && (() => { const entry = entries[child.index]; return entry && 'children' in entry && entry.children ? <Panel {...child} entries={entry.children} accelerators={accelerators} close={close} width={208} submenu back={() => { const index = child.index; setChild(null); panel.current?.querySelector<HTMLButtonElement>(`[data-menu-index="${index}"]`)?.focus() }} /> : null })()}</div>
}
export default function ContextMenu(props: Props) {
  const [accelerators, setAccelerators] = useState(false)
  const family = useRef<HTMLDivElement>(null)
  const close = useRef(props.close)
  close.current = props.close
  useEffect(() => {
    cancelPreviews()
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !family.current?.contains(event.target)) close.current() }
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [])
  return createPortal(<div ref={family} className="win7 context-family" onKeyDown={event => { if (event.key === 'Alt') { event.preventDefault(); event.stopPropagation(); setAccelerators(true) } }}><Panel {...props} accelerators={accelerators} close={() => close.current()} /></div>, document.body)
}
